const Joi = require("joi");

const RELATIONSHIPS = ["self", "spouse", "parent", "child", "sibling", "other"];
const GENDERS = ["male", "female", "other", "prefer_not_to_say"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];

const createProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),

  relationship: Joi.string()
    .valid(...RELATIONSHIPS)
    .required()
    .messages({
      "any.only": `Relationship must be one of: ${RELATIONSHIPS.join(", ")}`,
      "any.required": "Relationship is required",
    }),

  gender: Joi.string()
    .valid(...GENDERS)
    .allow("", null),

  date_of_birth: Joi.string()
    .isoDate()
    .allow("", null),

  blood_group: Joi.string()
    .valid(...BLOOD_GROUPS)
    .allow("", null),

  height_cm: Joi.number().positive().max(300).allow(null),

  weight: Joi.number().positive().max(500).allow(null),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  relationship: Joi.string().valid(...RELATIONSHIPS),
  gender: Joi.string().valid(...GENDERS).allow("", null),
  date_of_birth: Joi.string().isoDate().allow("", null),
  blood_group: Joi.string().valid(...BLOOD_GROUPS).allow("", null),
  height_cm: Joi.number().positive().max(300).allow(null),
  is_onboarding_complete: Joi.boolean(),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

module.exports = {
  createProfileSchema,
  updateProfileSchema,
  RELATIONSHIPS,
  GENDERS,
  BLOOD_GROUPS,
};
