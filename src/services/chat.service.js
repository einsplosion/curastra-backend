const { pool } = require("../config/db");
const logger = require("../config/logger");
const aceService = require("./ace.service");
const { buildChatContext } = require("./context.service");
const { classifyIntent } = require("../utils/chatIntentClassifier");
const { screenMessage } = require("../utils/chatSafety");
const { buildSystemPrompt, buildMessageHistory } = require("../utils/chatPromptBuilder");

const DISCLAIMER = "\n\nThis is not medical advice. Consult your doctor for medical decisions.";

const DIAGNOSIS_PATTERNS = [
  /you have/i,
  /you are diagnosed/i,
  /you suffer from/i,
  /i recommend you take/i,
  /you should take/i,
  /you should stop/i,
  /this is likely/i,
  /this sounds like/i,
  /this could be/i,
];


// post-processes AI reply to prevent unauthorized diagnosis and enforce disclaimer
const postProcessReply = (reply) => {
  if (!reply || typeof reply !== "string") {
    return "I am here to help you understand your care plan and health data." + DISCLAIMER;
  }

  const attemptedDiagnosis = DIAGNOSIS_PATTERNS.some((p) => p.test(reply));
  if (attemptedDiagnosis) {
    logger.warn("AI attempted diagnosis — replacing response with safety guardrail");
    return (
      "I can help you understand your care plan and medications, but I'm not able to provide diagnoses or medical recommendations. Please discuss this with your doctor." +
      DISCLAIMER
    );
  }

  if (!reply.includes("not medical advice")) {
    return reply.trim() + DISCLAIMER;
  }

  return reply.trim();
};


// saves a user message and assistant response pair to chat_messages
const saveMessagePair = async (conversationId, userId, userMessage, assistantReply, wasFlagged = false) => {
  await pool.query(
    `INSERT INTO chat_messages (conversation_id, user_id, role, content, was_flagged)
     VALUES 
       ($1, $2, 'user', $3, FALSE),
       ($1, $2, 'assistant', $4, $5)`,
    [conversationId, userId, userMessage, assistantReply, wasFlagged]
  );
};


// auto-generates a truncated title for the conversation on the first exchange
const autoGenerateTitle = async (conversationId, firstMessage) => {
  const check = await pool.query(
    `SELECT title, 
       (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = $1) AS message_count
     FROM chat_conversations WHERE id = $1`,
    [conversationId]
  );

  const row = check.rows[0];
  if (!row) return;

  if (row.title || parseInt(row.message_count, 10) > 2) {
    return;
  }

  const title =
    firstMessage.length > 50
      ? firstMessage.substring(0, 47) + "..."
      : firstMessage;

  await pool.query(
    `UPDATE chat_conversations SET title = $1 WHERE id = $2`,
    [title, conversationId]
  );
};


// creates a new chat conversation
const createConversation = async (userId, profileId, options = {}) => {
  const { title, related_care_plan_id, related_record_id, conversation_type } = options;

  const result = await pool.query(
    `INSERT INTO chat_conversations
     (user_id, profile_id, title, related_care_plan_id, related_record_id, conversation_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      profileId || null,
      title ? title.trim() : null,
      related_care_plan_id || null,
      related_record_id || null,
      conversation_type || "general",
    ]
  );

  return result.rows[0];
};


// gets all conversations for user / profile
const getConversations = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT 
       c.id,
       c.user_id,
       c.profile_id,
       c.title,
       c.conversation_type,
       c.related_care_plan_id,
       c.related_record_id,
       c.created_at,
       c.last_message_at,
       (
         SELECT content FROM chat_messages
         WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1
       ) AS last_message,
       (
         SELECT COUNT(*) FROM chat_messages
         WHERE conversation_id = c.id
       )::int AS message_count
     FROM chat_conversations c
     WHERE c.user_id = $1
       AND (c.profile_id = $2 OR (c.profile_id IS NULL AND $2 IS NULL))
     ORDER BY c.last_message_at DESC
     LIMIT 30`,
    [userId, profileId || null]
  );

  return result.rows;
};


// gets conversation by ID and checks ownership
const getConversationById = async (userId, conversationId) => {
  const result = await pool.query(
    `SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Conversation not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
};


// deletes a conversation and its messages
const deleteConversation = async (userId, conversationId) => {
  const check = await pool.query(
    `SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );

  if (check.rows.length === 0) {
    const error = new Error("Conversation not found");
    error.status = 404;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM chat_messages WHERE conversation_id = $1`, [conversationId]);
    await client.query(`DELETE FROM chat_conversations WHERE id = $1`, [conversationId]);
    await client.query("COMMIT");
    return { message: "Conversation deleted successfully", id: conversationId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// gets messages in a conversation
const getMessages = async (userId, conversationId) => {
  await getConversationById(userId, conversationId);

  const result = await pool.query(
    `SELECT id, role, content, was_flagged, created_at
     FROM chat_messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );

  return result.rows;
};


// core chat handler: processes message through safety pre-screen, intent classifier,
// context builder, prompt assembler, ace api, post-processor, and db storage
const sendMessage = async (userId, profileId, conversationId, message) => {
  let convId = conversationId;

  // 1. verify or auto-create conversation
  if (convId) {
    await getConversationById(userId, convId);
  } else {
    const newConv = await createConversation(userId, profileId, { conversation_type: "general" });
    convId = newConv.id;
  }

  const cleanMessage = message.trim();

  // 2. safety pre-screen 
  const safetyResult = screenMessage(cleanMessage);
  if (safetyResult.blocked) {
    await saveMessagePair(convId, userId, cleanMessage, safetyResult.response, true);
    await autoGenerateTitle(convId, cleanMessage);

    return {
      conversation_id: convId,
      reply: safetyResult.response,
      was_flagged: true,
      context_modules_used: [],
      ace_available: true,
    };
  }

  // 3. classify intent
  const { intents, context_modules } = classifyIntent(cleanMessage);
  logger.info("Chat intent classified", {
    userId,
    conversationId: convId,
    intents,
    context_modules,
  });

  // 4. build personalized health context (parallel DB queries)
  const context = await buildChatContext(userId, profileId, convId, context_modules);

  // 5. assemble prompt & message history
  const systemPrompt = buildSystemPrompt(context);
  const messageHistory = buildMessageHistory(context.conversation_history || [], cleanMessage);

  // 6. call ACE service with fallback protection
  let rawReply;
  let aceAvailable = true;

  try {
    const aceResponse = await aceService.chat(
      cleanMessage,
      context,
      context.conversation_history || [],
      systemPrompt
    );
    rawReply = typeof aceResponse === "object" ? aceResponse.reply || aceResponse.response || JSON.stringify(aceResponse) : aceResponse;
  } catch (err) {
    aceAvailable = false;
    logger.error("ACE chat service unavailable, delivering fallback message", { error: err.message });
    rawReply =
      "I'm having trouble connecting to my AI service right now. Please try again in a moment.\n\n" +
      DISCLAIMER;
  }

  // 7. post-process response
  const finalReply = postProcessReply(rawReply);

  // 8. save exchange to database
  await saveMessagePair(convId, userId, cleanMessage, finalReply, false);

  // 9. update last_message_at on conversation
  await pool.query(
    `UPDATE chat_conversations SET last_message_at = NOW() WHERE id = $1`,
    [convId]
  );

  // 10. auto-generate title if first message
  await autoGenerateTitle(convId, cleanMessage);

  return {
    conversation_id: convId,
    reply: finalReply,
    was_flagged: false,
    context_modules_used: context_modules,
    ace_available: aceAvailable,
  };
};


module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  deleteConversation,
  getMessages,
  sendMessage,
};
