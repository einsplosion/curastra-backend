const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const { ownership } = require("../middlewares/ownership.middleware");
const validate = require("../middlewares/validate.middleware");
const { chatLimiter } = require("../middlewares/ratelimiter.middleware");
const chatController = require("../controllers/chat.controller");
const {
  createConversationSchema,
  sendMessageSchema,
} = require("../validations/chat.validation");

router.use(auth);

// conversations CRUD
router.post(
  "/conversations",
  validate(createConversationSchema),
  chatController.createConversation
);

router.get("/conversations", chatController.getConversations);

router.get(
  "/conversations/:conversationId",
  ownership("chat_conversations", "conversationId"),
  chatController.getConversationById
);

router.delete(
  "/conversations/:conversationId",
  ownership("chat_conversations", "conversationId"),
  chatController.deleteConversation
);

// messages & AI Chat
router.get(
  "/conversations/:conversationId/messages",
  ownership("chat_conversations", "conversationId"),
  chatController.getMessages
);

router.post(
  "/conversations/:conversationId/messages",
  ownership("chat_conversations", "conversationId"),
  chatLimiter,
  validate(sendMessageSchema),
  chatController.sendMessage
);

// shortcut endpoint: POST /api/chat/send or POST /api/chat
router.post(
  "/send",
  chatLimiter,
  validate(sendMessageSchema),
  chatController.sendMessage
);

router.post(
  "/",
  chatLimiter,
  validate(sendMessageSchema),
  chatController.sendMessage
);

module.exports = router;
