const reminderService = require("../services/reminder.service");


// GET /api/reminders
// retrieves all reminders for user/profile, with optional ?date=, ?is_active=, ?type=
exports.getReminders = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;
    const { date, is_active, type } = req.query;

    const reminders = await reminderService.getUserReminders(req.user.id, profileId, {
      date,
      is_active,
      type,
    });

    res.status(200).json({
      success: true,
      count: reminders.length,
      reminders,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/reminders/adherence
// returns 7-day and 30-day adherence statistics and medication breakdown
exports.getAdherenceSummary = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;

    const summary = await reminderService.getAdherenceSummary(req.user.id, profileId);

    res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/reminders
// creates a new custom or medication reminder
exports.createReminder = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;

    const reminder = await reminderService.createReminder(req.user.id, profileId, req.body);

    res.status(201).json({
      success: true,
      message: "Reminder created successfully",
      reminder,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/reminders/:reminderId
// updates an existing reminder
exports.updateReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;

    const reminder = await reminderService.updateReminder(req.user.id, reminderId, req.body);

    res.status(200).json({
      success: true,
      message: "Reminder updated successfully",
      reminder,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/reminders/:reminderId/toggle
// toggles is_active status on a reminder
exports.toggleReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;

    const reminder = await reminderService.toggleReminderActive(req.user.id, reminderId);

    res.status(200).json({
      success: true,
      message: `Reminder ${reminder.is_active ? "enabled" : "disabled"} successfully`,
      reminder,
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/reminders/:reminderId
// hard deletes a reminder and its adherence logs
exports.deleteReminder = async (req, res, next) => {
  try {
    const { reminderId } = req.params;

    const result = await reminderService.deleteReminder(req.user.id, reminderId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/reminders/:reminderId/log
// logs adherence status (taken, missed, snoozed, completed, skipped)
exports.logAdherence = async (req, res, next) => {
  try {
    const { reminderId } = req.params;

    const result = await reminderService.logAdherence(req.user.id, reminderId, req.body);

    res.status(201).json({
      success: true,
      message: "Adherence event logged successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};
