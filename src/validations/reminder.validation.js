const Joi = require("joi");

const REMINDER_TYPES = [
  "medication",
  "appointment",
  "lifestyle",
  "water_intake",
  "exercise",
  "symptom_check",
  "custom",
];

const RECURRENCE_TYPES = ["once", "daily", "weekly", "monthly"];

const LOG_STATUSES = ["taken", "missed", "snoozed", "completed", "skipped"];

const VALID_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

const createReminderSchema = Joi.object({
  type: Joi.string()
    .valid(...REMINDER_TYPES)
    .default("custom")
    .messages({
      "any.only": `Type must be one of: ${REMINDER_TYPES.join(", ")}`,
    }),

  title: Joi.string().trim().min(1).max(255).required().messages({
    "string.empty": "Title is required",
    "any.required": "Title is required",
  }),

  description: Joi.string().trim().max(1000).allow("", null),

  scheduled_time: Joi.string().pattern(timeRegex).required().messages({
    "string.pattern.base": "Scheduled time must be in HH:MM or HH:MM:SS format (e.g. 09:00 or 14:30:00)",
    "any.required": "Scheduled time is required",
  }),

  days_of_week: Joi.array()
    .items(Joi.string().valid(...VALID_DAYS))
    .unique()
    .allow(null),

  recurrence: Joi.string()
    .valid(...RECURRENCE_TYPES)
    .default("daily")
    .messages({
      "any.only": `Recurrence must be one of: ${RECURRENCE_TYPES.join(", ")}`,
    }),

  start_date: Joi.string()
    .isoDate()
    .allow("", null),

  end_date: Joi.string()
    .isoDate()
    .allow("", null),

  is_active: Joi.boolean().default(true),

  medication_id: Joi.string().uuid().allow(null),
  care_plan_id: Joi.string().uuid().allow(null),
  care_plan_task_id: Joi.string().uuid().allow(null),
});

const updateReminderSchema = Joi.object({
  type: Joi.string().valid(...REMINDER_TYPES),
  title: Joi.string().trim().min(1).max(255),
  description: Joi.string().trim().max(1000).allow("", null),
  scheduled_time: Joi.string().pattern(timeRegex).messages({
    "string.pattern.base": "Scheduled time must be in HH:MM or HH:MM:SS format",
  }),
  days_of_week: Joi.array().items(Joi.string().valid(...VALID_DAYS)).unique().allow(null),
  recurrence: Joi.string().valid(...RECURRENCE_TYPES),
  start_date: Joi.string().isoDate().allow("", null),
  end_date: Joi.string().isoDate().allow("", null),
  is_active: Joi.boolean(),
  medication_id: Joi.string().uuid().allow(null),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

const logAdherenceSchema = Joi.object({
  status: Joi.string()
    .valid(...LOG_STATUSES)
    .required()
    .messages({
      "any.only": `Status must be one of: ${LOG_STATUSES.join(", ")}`,
      "any.required": "Adherence status is required",
    }),

  scheduled_at: Joi.date().iso().allow("", null),

  notes: Joi.string().trim().max(1000).allow("", null),
});

module.exports = {
  createReminderSchema,
  updateReminderSchema,
  logAdherenceSchema,
  REMINDER_TYPES,
  RECURRENCE_TYPES,
  LOG_STATUSES,
};
