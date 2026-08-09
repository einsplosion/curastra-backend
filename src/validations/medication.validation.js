const Joi = require("joi");

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

const createMedicationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Medication name is required",
    "any.required": "Medication name is required",
  }),
  dosage: Joi.string().trim().max(255).allow("", null),
  frequency: Joi.string().trim().max(255).allow("", null),
  timing: Joi.string().trim().max(255).allow("", null),
  duration: Joi.string().trim().max(255).allow("", null),
  instructions: Joi.string().trim().max(1000).allow("", null),
  source: Joi.string().valid("manual", "care_plan").default("manual"),
  is_active: Joi.boolean().default(true),
  start_date: Joi.string().isoDate().allow("", null),
  end_date: Joi.string().isoDate().allow("", null),
  scheduled_time: Joi.string().pattern(timeRegex).allow("", null).messages({
    "string.pattern.base": "Scheduled time must be in HH:MM format",
  }),
});

const updateMedicationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255),
  dosage: Joi.string().trim().max(255).allow("", null),
  frequency: Joi.string().trim().max(255).allow("", null),
  timing: Joi.string().trim().max(255).allow("", null),
  duration: Joi.string().trim().max(255).allow("", null),
  instructions: Joi.string().trim().max(1000).allow("", null),
  source: Joi.string().valid("manual", "care_plan"),
  is_active: Joi.boolean(),
  start_date: Joi.string().isoDate().allow("", null),
  end_date: Joi.string().isoDate().allow("", null),
  scheduled_time: Joi.string().pattern(timeRegex).allow("", null),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

module.exports = {
  createMedicationSchema,
  updateMedicationSchema,
};
