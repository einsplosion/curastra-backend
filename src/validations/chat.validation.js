const Joi = require("joi");

const CONVERSATION_TYPES = [
  "general",
  "care_plan",
  "lab_report",
  "medication",
  "symptoms",
];

const createConversationSchema = Joi.object({
  title: Joi.string().trim().max(255).allow("", null),
  related_care_plan_id: Joi.string().uuid().allow(null),
  related_record_id: Joi.string().uuid().allow(null),
  conversation_type: Joi.string()
    .valid(...CONVERSATION_TYPES)
    .default("general"),
});

const sendMessageSchema = Joi.object({
  conversation_id: Joi.string().uuid().allow("", null),
  message: Joi.string().trim().min(1).max(2000).required().messages({
    "string.empty": "Message text cannot be empty",
    "any.required": "Message text is required",
  }),
});

module.exports = {
  createConversationSchema,
  sendMessageSchema,
  CONVERSATION_TYPES,
};
