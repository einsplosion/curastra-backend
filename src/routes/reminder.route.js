const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const { ownership } = require("../middlewares/ownership.middleware");
const validate = require("../middlewares/validate.middleware");
const reminderController = require("../controllers/reminder.controller");
const {
  createReminderSchema,
  updateReminderSchema,
  logAdherenceSchema,
} = require("../validations/reminder.validation");

router.use(auth);

// GET /api/reminders/adherence (Must be registered before /:reminderId)
router.get("/adherence", reminderController.getAdherenceSummary);

// GET /api/reminders
router.get("/", reminderController.getReminders);

// POST /api/reminders
router.post("/", validate(createReminderSchema), reminderController.createReminder);

// PATCH /api/reminders/:reminderId
router.patch(
  "/:reminderId",
  ownership("reminders", "reminderId"),
  validate(updateReminderSchema),
  reminderController.updateReminder
);

// PATCH /api/reminders/:reminderId/toggle
router.patch(
  "/:reminderId/toggle",
  ownership("reminders", "reminderId"),
  reminderController.toggleReminder
);

// DELETE /api/reminders/:reminderId
router.delete(
  "/:reminderId",
  ownership("reminders", "reminderId"),
  reminderController.deleteReminder
);

// POST /api/reminders/:reminderId/log
router.post(
  "/:reminderId/log",
  ownership("reminders", "reminderId"),
  validate(logAdherenceSchema),
  reminderController.logAdherence
);

module.exports = router;
