const Joi = require("joi");

const RECORD_TYPES = ["prescription", "lab_report"];

const uploadRecordSchema = Joi.object({
  type: Joi.string()
    .valid(...RECORD_TYPES)
    .required()
    .messages({
      "any.only": `Record type must be one of: ${RECORD_TYPES.join(", ")}`,
      "any.required": "Record type is required",
    }),

  notes: Joi.string().trim().max(1000).allow("", null),
});

const analyzeLabRecordSchema = Joi.object({
  verified_text: Joi.string().trim().min(1).required().messages({
    "string.empty": "verified_text is required for lab report analysis",
    "any.required": "verified_text is required for lab report analysis",
  }),
});

module.exports = {
  uploadRecordSchema,
  analyzeLabRecordSchema,
  RECORD_TYPES,
};
