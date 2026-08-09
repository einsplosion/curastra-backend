const Joi = require("joi");

const generateCarePlanSchema = Joi.object({
  record_id: Joi.string().uuid().allow("", null),
  verified_text: Joi.string().trim().min(1).required().messages({
    "string.empty": "verified_text is required for care plan generation",
    "any.required": "verified_text is required for care plan generation",
  }),
  user_notes: Joi.string().trim().max(1000).allow("", null),
});

const updateCarePlanStatusSchema = Joi.object({
  status: Joi.string()
    .valid("active", "completed", "archived")
    .required()
    .messages({
      "any.only": "Status must be one of: active, completed, archived",
      "any.required": "Status is required",
    }),
});

const simplifyInstructionSchema = Joi.object({
  text: Joi.string().trim().min(1).required().messages({
    "string.empty": "text is required",
    "any.required": "text is required",
  }),
});

module.exports = {
  generateCarePlanSchema,
  updateCarePlanStatusSchema,
  simplifyInstructionSchema,
};
