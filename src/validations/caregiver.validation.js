const Joi = require("joi");

const permissionsSchema = Joi.object({
  view_records: Joi.boolean().default(true),
  add_records: Joi.boolean().default(false),
  view_care_plans: Joi.boolean().default(true),
  manage_reminders: Joi.boolean().default(false),
});

const inviteCaregiverSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.email": "Please provide a valid email address for the caregiver",
    "any.required": "Caregiver email is required",
  }),
  permissions: permissionsSchema.default({
    view_records: true,
    add_records: false,
    view_care_plans: true,
    manage_reminders: false,
  }),
});

const updatePermissionsSchema = Joi.object({
  permissions: Joi.object({
    view_records: Joi.boolean(),
    add_records: Joi.boolean(),
    view_care_plans: Joi.boolean(),
    manage_reminders: Joi.boolean(),
  })
    .min(1)
    .required()
    .messages({
      "any.required": "Permissions object is required",
      "object.min": "At least one permission field must be specified",
    }),
});

module.exports = {
  inviteCaregiverSchema,
  updatePermissionsSchema,
  permissionsSchema,
};
