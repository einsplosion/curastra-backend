const Joi = require("joi");

const VITAL_TYPES = [
  "blood_pressure",
  "blood_glucose",
  "weight",
  "temperature",
  "heart_rate",
  "oxygen_saturation",
];

const createMetricReadingSchema = Joi.object({
  type: Joi.string()
    .valid(...VITAL_TYPES)
    .required()
    .messages({
      "any.only": `Metric type must be one of: ${VITAL_TYPES.join(", ")}`,
      "any.required": "Metric type is required",
    }),

  value_primary: Joi.number().required().messages({
    "number.base": "Primary value must be a number",
    "any.required": "Primary value is required",
  }),

  value_secondary: Joi.number().allow(null),

  unit: Joi.string().trim().max(50).required().messages({
    "string.empty": "Unit is required",
    "any.required": "Unit is required",
  }),

  timing_context: Joi.string().trim().max(255).allow("", null),

  notes: Joi.string().trim().max(1000).allow("", null),

  recorded_at: Joi.string().isoDate().allow("", null),
});

const syncLabResultSchema = Joi.object({
  lab_result_id: Joi.string().uuid().required().messages({
    "string.guid": "lab_result_id must be a valid UUID",
    "any.required": "lab_result_id is required",
  }),
});

module.exports = {
  createMetricReadingSchema,
  syncLabResultSchema,
  VITAL_TYPES,
};
