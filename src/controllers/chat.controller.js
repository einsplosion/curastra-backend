const chatService = require("../services/chat.service");

// POST /api/chat/conversations
// creates a new conversation topic/session
exports.createConversation = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;

    const conversation = await chatService.createConversation(
      req.user.id,
      profileId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Conversation created successfully",
      conversation,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/chat/conversations
// lists all conversations for the user/profile
exports.getConversations = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;

    const conversations = await chatService.getConversations(
      req.user.id,
      profileId
    );

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/chat/conversations/:conversationId
// gets single conversation details
exports.getConversationById = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const conversation = await chatService.getConversationById(
      req.user.id,
      conversationId
    );

    res.status(200).json({
      success: true,
      conversation,
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/chat/conversations/:conversationId
// deletes conversation and all message history
exports.deleteConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const result = await chatService.deleteConversation(
      req.user.id,
      conversationId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/chat/conversations/:conversationId/messages
// retrieves message history for a conversation
exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const messages = await chatService.getMessages(
      req.user.id,
      conversationId
    );

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/chat/conversations/:conversationId/messages OR POST /api/chat/send
// sends a message and receives AI reply with personalized context injection
exports.sendMessage = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;
    const conversationId = req.params.conversationId || req.body.conversation_id || null;
    const { message } = req.body;

    const result = await chatService.sendMessage(
      req.user.id,
      profileId,
      conversationId,
      message
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};
