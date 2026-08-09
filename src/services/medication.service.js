const { pool } = require("../config/db");
const logger = require("../config/logger");
const aceService = require("./ace.service");
const { checkLocalDuplicates } = require("../utils/medicationSafety");

// gets all medications for a user/profile with optional filters
const getUserMedications = async (userId, profileId, filters = {}) => {
  let query = `
    SELECT 
      m.id,
      m.user_id,
      m.profile_id,
      m.care_plan_id,
      m.name,
      m.dosage,
      m.frequency,
      m.timing,
      m.duration,
      m.instructions,
      m.source,
      m.is_active,
      m.start_date,
      m.end_date,
      m.created_at,
      cp.summary AS care_plan_summary,
      r.file_name AS record_file_name,
      rem.id AS reminder_id,
      rem.scheduled_time AS reminder_scheduled_time,
      rem.is_active AS reminder_is_active
    FROM medications m
    LEFT JOIN care_plans cp ON m.care_plan_id = cp.id
    LEFT JOIN records r ON cp.record_id = r.id
    LEFT JOIN reminders rem ON rem.medication_id = m.id
    WHERE m.user_id = $1
  `;

  const values = [userId];
  let paramCount = 1;

  if (profileId) {
    paramCount++;
    query += ` AND m.profile_id = $${paramCount}`;
    values.push(profileId);
  } else {
    query += ` AND m.profile_id IS NULL`;
  }

  if (filters.care_plan_id) {
    paramCount++;
    query += ` AND m.care_plan_id = $${paramCount}`;
    values.push(filters.care_plan_id);
  }

  if (filters.is_active !== undefined && filters.is_active !== null) {
    paramCount++;
    query += ` AND m.is_active = $${paramCount}`;
    values.push(filters.is_active === "true" || filters.is_active === true);
  }

  query += ` ORDER BY m.created_at DESC`;

  const result = await pool.query(query, values);
  return result.rows;
};


// creates a new manual medication and linked reminder, triggering duplicate and safety checks
const createMedication = async (userId, profileId, data) => {
  const {
    name,
    dosage,
    frequency,
    timing,
    instructions,
    duration,
    start_date,
    end_date,
    scheduled_time,
  } = data;

  if (!name || !name.trim()) {
    const error = new Error("Medication name is required");
    error.status = 400;
    throw error;
  }

  // 1. fetch current active medications for duplicate and safety checks
  const activeMeds = await getUserMedications(userId, profileId, { is_active: true });

  // 2. local duplicate detection
  const duplicateCheck = checkLocalDuplicates(name.trim(), activeMeds);

  // 3. ace cross-medication safety check
  const allMedsForSafety = [
    ...activeMeds.map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
    { name: name.trim(), dosage: dosage || null, frequency: frequency || null },
  ];
  let safetyOutput = { alerts: [], disclaimer: "" };
  try {
    safetyOutput = await aceService.checkMedicationSafety(allMedsForSafety);
  } catch (err) {
    logger.warn("ACE med-safety check failed during creation, proceeding", { error: err.message });
  }

  // 4. insert medication row (source: 'manual')
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const medRes = await client.query(
      `INSERT INTO medications 
       (user_id, profile_id, name, dosage, frequency, timing, instructions, duration, source, is_active, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual', true, $9, $10)
       RETURNING *`,
      [
        userId,
        profileId || null,
        name.trim(),
        dosage || null,
        frequency || "daily",
        timing || null,
        instructions || null,
        duration || null,
        start_date || new Date().toISOString().split("T")[0],
        end_date || null,
      ]
    );

    const newMed = medRes.rows[0];

    // 5. auto-create linked reminder row
    const timeVal = scheduled_time || "09:00:00";
    const remRes = await client.query(
      `INSERT INTO reminders 
       (user_id, profile_id, medication_id, type, title, description, scheduled_time, recurrence, start_date, end_date, is_active)
       VALUES ($1, $2, $3, 'medication', $4, $5, $6, 'daily', $7, $8, true)
       RETURNING *`,
      [
        userId,
        profileId || null,
        newMed.id,
        `Take ${newMed.name}`,
        `${newMed.dosage || ""} - ${newMed.instructions || "As prescribed"}`.trim(),
        timeVal,
        newMed.start_date,
        newMed.end_date,
      ]
    );

    const newReminder = remRes.rows[0];

    await client.query("COMMIT");

    return {
      medication: newMed,
      reminder: newReminder,
      duplicate_warning: duplicateCheck.is_duplicate ? duplicateCheck : null,
      safety_alerts: safetyOutput.alerts || [],
      safety_disclaimer: safetyOutput.disclaimer || null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// updates a medication and syncs its linked reminder
const updateMedication = async (userId, medicationId, data) => {
  const {
    name,
    dosage,
    frequency,
    timing,
    instructions,
    duration,
    start_date,
    end_date,
    scheduled_time,
  } = data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // fetch existing
    const checkRes = await client.query(
      `SELECT * FROM medications WHERE id = $1 AND user_id = $2`,
      [medicationId, userId]
    );
    if (checkRes.rows.length === 0) {
      const error = new Error("Medication not found or access denied");
      error.status = 404;
      throw error;
    }

    const currentMed = checkRes.rows[0];

    const updatedName = name !== undefined ? name.trim() : currentMed.name;
    const updatedDosage = dosage !== undefined ? dosage : currentMed.dosage;
    const updatedFrequency = frequency !== undefined ? frequency : currentMed.frequency;
    const updatedTiming = timing !== undefined ? timing : currentMed.timing;
    const updatedInstructions = instructions !== undefined ? instructions : currentMed.instructions;
    const updatedDuration = duration !== undefined ? duration : currentMed.duration;
    const updatedStartDate = start_date !== undefined ? start_date : currentMed.start_date;
    const updatedEndDate = end_date !== undefined ? end_date : currentMed.end_date;

    const updateMedRes = await client.query(
      `UPDATE medications 
       SET name = $1, dosage = $2, frequency = $3, timing = $4, instructions = $5, duration = $6, start_date = $7, end_date = $8
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        updatedName,
        updatedDosage,
        updatedFrequency,
        updatedTiming,
        updatedInstructions,
        updatedDuration,
        updatedStartDate,
        updatedEndDate,
        medicationId,
        userId,
      ]
    );

    const updatedMed = updateMedRes.rows[0];

    // update linked reminder if present
    let updatedReminder = null;
    if (scheduled_time !== undefined || name !== undefined || dosage !== undefined) {
      const updateRemRes = await client.query(
        `UPDATE reminders 
         SET title = $1, description = $2, scheduled_time = COALESCE($3, scheduled_time), start_date = $4, end_date = $5
         WHERE medication_id = $6 AND user_id = $7
         RETURNING *`,
        [
          `Take ${updatedMed.name}`,
          `${updatedMed.dosage || ""} - ${updatedMed.instructions || "As prescribed"}`.trim(),
          scheduled_time || null,
          updatedMed.start_date,
          updatedMed.end_date,
          medicationId,
          userId,
        ]
      );
      updatedReminder = updateRemRes.rows[0] || null;
    }

    await client.query("COMMIT");

    // re-trigger safety check after update
    const activeMeds = await getUserMedications(userId, updatedMed.profile_id, { is_active: true });
    let safetyOutput = { alerts: [], disclaimer: "" };
    try {
      safetyOutput = await aceService.checkMedicationSafety(activeMeds);
    } catch (err) {
      logger.warn("ACE med-safety re-check failed, proceeding", { error: err.message });
    }

    return {
      medication: updatedMed,
      reminder: updatedReminder,
      safety_alerts: safetyOutput.alerts || [],
      safety_disclaimer: safetyOutput.disclaimer || null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// toggles the reminder notification status for a medication
const toggleMedicationActive = async (userId, medicationId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // check medication exists
    const medRes = await client.query(
      `SELECT * FROM medications WHERE id = $1 AND user_id = $2`,
      [medicationId, userId]
    );

    if (medRes.rows.length === 0) {
      const error = new Error("Medication not found or access denied");
      error.status = 404;
      throw error;
    }

    const med = medRes.rows[0];

    // check linked reminder
    const remCheck = await client.query(
      `SELECT * FROM reminders WHERE medication_id = $1 AND user_id = $2`,
      [medicationId, userId]
    );

    let updatedReminder = null;

    if (remCheck.rows.length > 0) {
      // flip reminder is_active status
      const newStatus = !remCheck.rows[0].is_active;
      const updatedRemRes = await client.query(
        `UPDATE reminders SET is_active = $1 WHERE medication_id = $2 AND user_id = $3 RETURNING *`,
        [newStatus, medicationId, userId]
      );
      updatedReminder = updatedRemRes.rows[0];
    } else {
      // if no reminder existed yet, create one in active state
      const createdRemRes = await client.query(
        `INSERT INTO reminders 
         (user_id, profile_id, medication_id, type, title, description, scheduled_time, recurrence, start_date, end_date, is_active)
         VALUES ($1, $2, $3, 'medication', $4, $5, '09:00:00', 'daily', $6, $7, true)
         RETURNING *`,
        [
          userId,
          med.profile_id || null,
          med.id,
          `Take ${med.name}`,
          `${med.dosage || ""} - ${med.instructions || "As prescribed"}`.trim(),
          med.start_date,
          med.end_date,
        ]
      );
      updatedReminder = createdRemRes.rows[0];
    }

    await client.query("COMMIT");

    return {
      medication_id: med.id,
      medication_name: med.name,
      reminder_id: updatedReminder.id,
      reminder_is_active: updatedReminder.is_active,
      reminder: updatedReminder,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// deletes a medication and syncs its linked reminder
const deleteMedication = async (userId, medicationId) => {
  const result = await pool.query(
    `DELETE FROM medications WHERE id = $1 AND user_id = $2 RETURNING *`,
    [medicationId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Medication not found or access denied");
    error.status = 404;
    throw error;
  }

  return {
    deleted_medication: result.rows[0],
    message: "Medication and associated reminders deleted successfully",
  };
};

module.exports = {
  getUserMedications,
  createMedication,
  updateMedication,
  toggleMedicationActive,
  deleteMedication,
};
