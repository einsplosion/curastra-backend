const { pool } = require("../config/db");
const logger = require("../config/logger");

const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// helper to normalize day strings (e.g., 'Monday' -> 'Mon', 'mon' -> 'Mon')
const normalizeDay = (dayStr) => {
  if (!dayStr) return null;
  const lower = dayStr.trim().toLowerCase();
  const fullIdx = DAY_FULL_NAMES.indexOf(lower);
  if (fullIdx !== -1) return DAY_SHORT_NAMES[fullIdx];
  const shortIdx = DAY_SHORT_NAMES.map((d) => d.toLowerCase()).indexOf(lower);
  if (shortIdx !== -1) return DAY_SHORT_NAMES[shortIdx];
  return null;
};

// check if reminder is scheduled on a given target date
const isReminderScheduledOnDate = (reminder, targetDateStr) => {
  const targetDate = new Date(`${targetDateStr}T00:00:00Z`);
  if (isNaN(targetDate.getTime())) return true;

  // check start date constraint
  if (reminder.start_date) {
    const startDate = new Date(reminder.start_date);
    startDate.setUTCHours(0, 0, 0, 0);
    if (targetDate < startDate) return false;
  }

  // check end date constraint
  if (reminder.end_date) {
    const endDate = new Date(reminder.end_date);
    endDate.setUTCHours(23, 59, 59, 999);
    if (targetDate > endDate) return false;
  }

  const dayOfWeekIdx = targetDate.getUTCDay(); // 0=Sun, 1=Mon...
  const targetShortDay = DAY_SHORT_NAMES[dayOfWeekIdx];

  const recurrence = reminder.recurrence || "daily";
  const daysOfWeek = Array.isArray(reminder.days_of_week)
    ? reminder.days_of_week.map(normalizeDay).filter(Boolean)
    : [];

  if (recurrence === "once") {
    if (reminder.start_date) {
      const startDateStr = new Date(reminder.start_date)
        .toISOString()
        .split("T")[0];
      return startDateStr === targetDateStr;
    }
    return true;
  }

  if (daysOfWeek.length > 0) {
    return daysOfWeek.includes(targetShortDay);
  }

  if (recurrence === "weekly" && reminder.start_date) {
    const startDate = new Date(reminder.start_date);
    return startDate.getUTCDay() === dayOfWeekIdx;
  }

  if (recurrence === "monthly" && reminder.start_date) {
    const startDate = new Date(reminder.start_date);
    return startDate.getUTCDate() === targetDate.getUTCDate();
  }

  return true;
};


// GET /reminders
// retrieves all reminders for a user/profile with optional date filtering & log status 
const getUserReminders = async (userId, profileId, filters = {}) => {
  const { date, is_active, type } = filters;

  let query = `
    SELECT 
      r.id,
      r.user_id,
      r.profile_id,
      r.medication_id,
      r.care_plan_id,
      r.care_plan_task_id,
      r.type,
      r.title,
      r.description,
      r.scheduled_time,
      r.days_of_week,
      r.recurrence,
      r.start_date,
      r.end_date,
      r.is_active,
      r.created_at,
      m.name AS medication_name,
      m.dosage AS medication_dosage,
      m.instructions AS medication_instructions
  `;

  if (date) {
    query += `,
      rl.id AS log_id,
      rl.status AS log_status,
      rl.logged_at,
      rl.notes AS log_notes
    `;
  }

  query += `
    FROM reminders r
    LEFT JOIN medications m ON r.medication_id = m.id
  `;

  const values = [userId];
  let paramCount = 1;

  if (date) {
    paramCount++;
    query += ` LEFT JOIN LATERAL (
      SELECT id AS log_id, status AS log_status, logged_at, notes AS log_notes
      FROM reminder_logs
      WHERE reminder_id = r.id AND DATE(scheduled_at) = $${paramCount}::date
      ORDER BY logged_at DESC
      LIMIT 1
    ) rl ON true`;
    values.push(date);
  }

  query += ` WHERE r.user_id = $1`;

  if (profileId) {
    paramCount++;
    query += ` AND (r.profile_id = $${paramCount} OR r.profile_id IS NULL)`;
    values.push(profileId);
  }

  if (is_active !== undefined && is_active !== null) {
    paramCount++;
    query += ` AND r.is_active = $${paramCount}`;
    values.push(is_active === "true" || is_active === true);
  }

  if (type) {
    paramCount++;
    query += ` AND r.type = $${paramCount}`;
    values.push(type);
  }

  query += ` ORDER BY r.scheduled_time ASC, r.created_at DESC`;

  const result = await pool.query(query, values);
  let reminders = result.rows;

  // filter by date if requested
  if (date) {
    reminders = reminders.filter((r) => isReminderScheduledOnDate(r, date));
    reminders = reminders.map((r) => ({
      ...r,
      is_logged: !!r.log_status,
      log_status: r.log_status || null,
    }));
  }

  return reminders;
};


// POST /reminders
// creates a custom or medication reminder
const createReminder = async (userId, profileId, data) => {
  const {
    type = "custom",
    title,
    description,
    scheduled_time,
    days_of_week,
    recurrence = "daily",
    start_date,
    end_date,
    is_active = true,
    medication_id,
    care_plan_id,
    care_plan_task_id,
  } = data;

  const normalizedDays = Array.isArray(days_of_week)
    ? days_of_week.map(normalizeDay).filter(Boolean)
    : null;

  const query = `
    INSERT INTO reminders 
    (user_id, profile_id, medication_id, care_plan_id, care_plan_task_id, type, title, description, scheduled_time, days_of_week, recurrence, start_date, end_date, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `;

  const values = [
    userId,
    profileId || null,
    medication_id || null,
    care_plan_id || null,
    care_plan_task_id || null,
    type,
    title.trim(),
    description ? description.trim() : null,
    scheduled_time,
    normalizedDays,
    recurrence,
    start_date || new Date().toISOString().split("T")[0],
    end_date || null,
    is_active,
  ];

  const result = await pool.query(query, values);
  const reminder = result.rows[0];

  // fetch joined medication name if applicable
  if (reminder.medication_id) {
    const medRes = await pool.query(
      `SELECT name, dosage, instructions FROM medications WHERE id = $1`,
      [reminder.medication_id]
    );
    if (medRes.rows.length > 0) {
      reminder.medication_name = medRes.rows[0].name;
      reminder.medication_dosage = medRes.rows[0].dosage;
      reminder.medication_instructions = medRes.rows[0].instructions;
    }
  }

  return reminder;
};


// PATCH /reminders/:reminderId
// updates reminder details
const updateReminder = async (userId, reminderId, data) => {
  const allowedFields = [
    "type",
    "title",
    "description",
    "scheduled_time",
    "days_of_week",
    "recurrence",
    "start_date",
    "end_date",
    "is_active",
    "medication_id",
  ];

  const updates = [];
  const values = [];
  let paramIdx = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      let val = data[field];
      if (field === "days_of_week" && Array.isArray(val)) {
        val = val.map(normalizeDay).filter(Boolean);
      }
      if (typeof val === "string" && (field === "title" || field === "description")) {
        val = val.trim();
      }
      updates.push(`${field} = $${paramIdx}`);
      values.push(val);
      paramIdx++;
    }
  }

  if (updates.length === 0) {
    const error = new Error("No valid fields provided for update");
    error.status = 400;
    throw error;
  }

  values.push(reminderId, userId);
  const query = `
    UPDATE reminders 
    SET ${updates.join(", ")}
    WHERE id = $${paramIdx} AND user_id = $${paramIdx + 1}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  if (result.rows.length === 0) {
    const error = new Error("Reminder not found or access denied");
    error.status = 404;
    throw error;
  }

  const reminder = result.rows[0];

  if (reminder.medication_id) {
    const medRes = await pool.query(
      `SELECT name, dosage, instructions FROM medications WHERE id = $1`,
      [reminder.medication_id]
    );
    if (medRes.rows.length > 0) {
      reminder.medication_name = medRes.rows[0].name;
      reminder.medication_dosage = medRes.rows[0].dosage;
      reminder.medication_instructions = medRes.rows[0].instructions;
    }
  }

  return reminder;
};


// PATCH /reminders/:reminderId/toggle
// flips active status
const toggleReminderActive = async (userId, reminderId) => {
  const result = await pool.query(
    `UPDATE reminders 
     SET is_active = NOT is_active 
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [reminderId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Reminder not found or access denied");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
};


// DELETE /reminders/:reminderId
// deletes a reminder and clean up logs
const deleteReminder = async (userId, reminderId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM reminder_logs WHERE reminder_id = $1 AND user_id = $2`,
      [reminderId, userId]
    );

    const result = await client.query(
      `DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id`,
      [reminderId, userId]
    );

    if (result.rows.length === 0) {
      const error = new Error("Reminder not found or access denied");
      error.status = 404;
      throw error;
    }

    await client.query("COMMIT");
    return { message: "Reminder deleted successfully", id: reminderId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// POST /reminders/:reminderId/log
// logs adherence event (taken, missed, snoozed, completed, skipped)
const logAdherence = async (userId, reminderId, data) => {
  const { status, scheduled_at, notes } = data;

  const remCheck = await pool.query(
    `SELECT r.*, m.name AS medication_name 
     FROM reminders r 
     LEFT JOIN medications m ON r.medication_id = m.id 
     WHERE r.id = $1 AND r.user_id = $2`,
    [reminderId, userId]
  );

  if (remCheck.rows.length === 0) {
    const error = new Error("Reminder not found or access denied");
    error.status = 404;
    throw error;
  }

  const reminder = remCheck.rows[0];
  const scheduledTime = scheduled_at ? new Date(scheduled_at) : new Date();

  // check if a log already exists for this reminder on this date
  const existingLog = await pool.query(
    `SELECT id FROM reminder_logs 
     WHERE reminder_id = $1 AND user_id = $2 AND DATE(scheduled_at) = DATE($3::timestamp)`,
    [reminderId, userId, scheduledTime.toISOString()]
  );

  let logRes;
  if (existingLog.rows.length > 0) {
    logRes = await pool.query(
      `UPDATE reminder_logs 
       SET status = $1, notes = $2, logged_at = NOW(), scheduled_at = $3
       WHERE id = $4
       RETURNING *`,
      [status, notes ? notes.trim() : null, scheduledTime.toISOString(), existingLog.rows[0].id]
    );
  } else {
    logRes = await pool.query(
      `INSERT INTO reminder_logs (reminder_id, user_id, scheduled_at, status, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        reminderId,
        userId,
        scheduledTime.toISOString(),
        status,
        notes ? notes.trim() : null,
      ]
    );
  }

  return {
    log: logRes.rows[0],
    reminder: {
      id: reminder.id,
      title: reminder.title,
      type: reminder.type,
      medication_id: reminder.medication_id,
      medication_name: reminder.medication_name,
    },
  };
};


// GET /reminders/adherence
// returns 7-day and 30-day adherence stats, medication breakdown, and daily trends
const getAdherenceSummary = async (userId, profileId) => {
  let query = `
    SELECT 
      rl.id,
      rl.reminder_id,
      rl.scheduled_at,
      rl.status,
      rl.logged_at,
      r.title,
      r.type,
      r.medication_id,
      m.name AS medication_name
    FROM reminder_logs rl
    JOIN reminders r ON rl.reminder_id = r.id
    LEFT JOIN medications m ON r.medication_id = m.id
    WHERE rl.user_id = $1
      AND rl.scheduled_at >= NOW() - INTERVAL '30 days'
  `;

  const params = [userId];
  if (profileId) {
    query += ` AND (r.profile_id = $2 OR r.profile_id IS NULL)`;
    params.push(profileId);
  }

  query += ` ORDER BY rl.scheduled_at DESC`;

  const result = await pool.query(query, params);
  const logs = result.rows;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats = {
    last_7_days: { total: 0, taken: 0, missed: 0, snoozed: 0, skipped: 0, adherence_rate: 0 },
    last_30_days: { total: 0, taken: 0, missed: 0, snoozed: 0, skipped: 0, adherence_rate: 0 },
  };

  const medicationMap = {};
  const dailyMap = {};

  // pre-fill daily map for last 7 days
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split("T")[0];
    dailyMap[dateStr] = { date: dateStr, taken: 0, missed: 0, total: 0 };
  }

  for (const log of logs) {
    const logDate = new Date(log.scheduled_at);
    const isTaken = log.status === "taken" || log.status === "completed";
    const isMissed = log.status === "missed";
    const isSnoozed = log.status === "snoozed";
    const isSkipped = log.status === "skipped";

    // 30 days accumulator
    stats.last_30_days.total++;
    if (isTaken) stats.last_30_days.taken++;
    if (isMissed) stats.last_30_days.missed++;
    if (isSnoozed) stats.last_30_days.snoozed++;
    if (isSkipped) stats.last_30_days.skipped++;

    // 7 days accumulator
    if (logDate >= sevenDaysAgo) {
      stats.last_7_days.total++;
      if (isTaken) stats.last_7_days.taken++;
      if (isMissed) stats.last_7_days.missed++;
      if (isSnoozed) stats.last_7_days.snoozed++;
      if (isSkipped) stats.last_7_days.skipped++;

      const dateStr = logDate.toISOString().split("T")[0];
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].total++;
        if (isTaken) dailyMap[dateStr].taken++;
        if (isMissed) dailyMap[dateStr].missed++;
      }
    }

    // medication breakdown
    if (log.medication_id) {
      const key = log.medication_id;
      if (!medicationMap[key]) {
        medicationMap[key] = {
          medication_id: key,
          medication_name: log.medication_name || "Unknown Medication",
          taken: 0,
          missed: 0,
          total: 0,
        };
      }
      medicationMap[key].total++;
      if (isTaken) medicationMap[key].taken++;
      if (isMissed) medicationMap[key].missed++;
    }
  }

  // calculate percentages
  const calcRate = (taken, total) =>
    total > 0 ? parseFloat(((taken / total) * 100).toFixed(1)) : 0;

  stats.last_7_days.adherence_rate = calcRate(
    stats.last_7_days.taken,
    (stats.last_7_days.taken + stats.last_7_days.missed) || stats.last_7_days.total
  );
  stats.last_30_days.adherence_rate = calcRate(
    stats.last_30_days.taken,
    (stats.last_30_days.taken + stats.last_30_days.missed) || stats.last_30_days.total
  );

  const medication_breakdown = Object.values(medicationMap).map((m) => ({
    ...m,
    adherence_rate: calcRate(m.taken, (m.taken + m.missed) || m.total),
  }));

  return {
    stats,
    medication_breakdown,
    daily_trends: Object.values(dailyMap),
  };
};

module.exports = {
  getUserReminders,
  createReminder,
  updateReminder,
  toggleReminderActive,
  deleteReminder,
  logAdherence,
  getAdherenceSummary,
};
