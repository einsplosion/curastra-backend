const { pool } = require("../config/db");
const aceService = require("./ace.service.js");
const logger = require("../config/logger.js");


// generates a care plan via ACE and atomically persists care plan, medications, reminders, and tasks
// uses a single database transaction to guarantee data integrity across table
const generateAndSaveCarePlan = async (userId, profileId, recordId, verifiedText, userNotes) => {

  // 1. fetch record file_name if recordId is provided
  let fileName = "prescription.pdf";
  if (recordId) {
    const recRes = await pool.query(
      `SELECT file_name FROM records WHERE id = $1 AND user_id = $2`,
      [recordId, userId]
    );
    if (recRes.rows.length > 0) {
      fileName = recRes.rows[0].file_name;
    }
  }

  // 2. call ACE care plan generation endpoint
  const acePlan = await aceService.generateCarePlan(verifiedText, fileName, userNotes);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // helper to extract array content safely
    const toArrayJson = (val) => {
      if (!val) return JSON.stringify([]);
      if (Array.isArray(val)) return JSON.stringify(val);
      return JSON.stringify([val]);
    };

    // 3. insert row into care_plans table
    const planResult = await client.query(
      `INSERT INTO care_plans (
         user_id, profile_id, record_id, status, summary, disclaimer, raw_ai_output,
         watch_for_symptoms, pending_questions, lifestyle_recommendations, follow_up_appointments
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        profileId || null,
        recordId || null,
        "active",
        acePlan.structured_summary?.notes || acePlan.structured_summary?.summary || acePlan.safety_disclaimer || "Care Plan Generated",
        acePlan.safety_disclaimer || null,
        JSON.stringify(acePlan),
        JSON.stringify(acePlan.red_flags || []),
        JSON.stringify(acePlan.clarification_questions || []),
        toArrayJson(acePlan.structured_summary?.lifestyle),
        toArrayJson(acePlan.structured_summary?.follow_up),
      ]
    );

    const carePlan = planResult.rows[0];

    // 4. save extracted medications & schedule reminders
    const savedMedications = [];
    const createdReminders = [];
    const savedTasks = [];

    const meds = acePlan.medications || [];
    for (const med of meds) {
      if (!med.name) continue;

      const medRes = await client.query(
        `INSERT INTO medications (
           user_id, profile_id, care_plan_id, name, dosage, frequency, timing, duration, source, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          profileId || null,
          carePlan.id,
          med.name,
          med.dosage || med.strength || null,
          med.frequency || null,
          med.timing || null,
          med.duration || null,
          "care_plan",
          true,
        ]
      );

      const savedMed = medRes.rows[0];
      savedMedications.push(savedMed);

      // auto-schedule a daily reminder for active medication
      try {
        const remRes = await client.query(
          `INSERT INTO reminders (
             user_id, profile_id, medication_id, care_plan_id, type, title, description, scheduled_time, recurrence, is_active
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            userId,
            profileId || null,
            savedMed.id,
            carePlan.id,
            "medication",
            `Take ${savedMed.name}`,
            med.timing ? `Timing: ${med.timing}` : `Dosage: ${savedMed.dosage || "As prescribed"}`,
            "09:00:00", // default morning reminder time
            "daily",
            true,
          ]
        );
        createdReminders.push(remRes.rows[0]);
      } catch (remErr) {
        logger.warn("Failed to auto-create reminder for medication", { medicationId: savedMed.id, error: remErr.message });
      }
    }

    // 5. save care plan tasks
    const planTasks = acePlan.tasks || [];
    let sortOrder = 0;
    for (const t of planTasks) {
      if (!t.instruction) continue;

      let category = "general";
      if (t.category === "lifestyle") category = "lifestyle";
      else if (t.category === "medication") category = "medication";
      else if (t.category === "monitoring" || t.category === "safety") category = "symptom_check";
      else if (t.category === "follow_up") category = "appointment";
      else if (t.category === "diet") category = "diet";

      const taskRes = await client.query(
        `INSERT INTO care_plan_tasks (
           care_plan_id, user_id, profile_id, title, description, category, sort_order
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          carePlan.id,
          userId,
          profileId || null,
          t.instruction.trim(),
          t.schedule ? `Schedule: ${t.schedule}` : null,
          category,
          sortOrder++,
        ]
      );

      savedTasks.push(taskRes.rows[0]);
    }

    await client.query("COMMIT");

    return {
      care_plan: carePlan,
      medications: savedMedications,
      reminders: createdReminders,
      tasks: savedTasks,
      raw_ai_output: acePlan,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Failed to generate and save care plan", { error: err.message, userId });
    throw err;
  } finally {
    client.release();
  }
};


// fetches all care plans for a user with aggregated medication and task progress counts.
const getAllCarePlans = async (userId, profileId, statusFilter) => {
  let query = `
    SELECT cp.*,
           (SELECT COUNT(*)::integer FROM medications m WHERE m.care_plan_id = cp.id) as medication_count,
           (SELECT COUNT(*)::integer FROM care_plan_tasks cpt WHERE cpt.care_plan_id = cp.id) as total_tasks,
           (SELECT COUNT(*)::integer FROM care_plan_tasks cpt WHERE cpt.care_plan_id = cp.id AND cpt.is_completed = true) as completed_tasks
    FROM care_plans cp
    WHERE cp.user_id = $1
  `;
  const params = [userId];
  let paramCount = 1;

  if (profileId) {
    paramCount++;
    query += ` AND cp.profile_id = $${paramCount}`;
    params.push(profileId);
  }

  if (statusFilter) {
    paramCount++;
    query += ` AND cp.status = $${paramCount}`;
    params.push(statusFilter);
  }

  query += ` ORDER BY cp.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};


// fetches full care plan detail including attached tasks and medications
const getCarePlanById = async (userId, carePlanId) => {
  const planResult = await pool.query(
    `SELECT * FROM care_plans WHERE id = $1 AND user_id = $2`,
    [carePlanId, userId]
  );

  if (planResult.rows.length === 0) {
    return null;
  }

  const carePlan = planResult.rows[0];

  const tasksResult = await pool.query(
    `SELECT * FROM care_plan_tasks WHERE care_plan_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [carePlanId]
  );
  
  const medsResult = await pool.query(
    `SELECT * FROM medications WHERE care_plan_id = $1 ORDER BY created_at ASC`,
    [carePlanId]
  );

  carePlan.tasks = tasksResult.rows;
  carePlan.medications = medsResult.rows;

  return carePlan;
};


// updates status of a care plan (active, completed, archived).
const updateCarePlanStatus = async (userId, carePlanId, status) => {
  const result = await pool.query(
    `UPDATE care_plans 
     SET status = $1, updated_at = NOW() 
     WHERE id = $2 AND user_id = $3 
     RETURNING *`,
    [status, carePlanId, userId]
  );
  
  return result.rows[0] || null;
};


// toggles or marks completion state of a task and recalculates progress percentage on the parent care plan.
const completeTask = async (userId, carePlanId, taskId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // toggle completion state: if completed set to false, else set to true
    const taskResult = await client.query(
      `UPDATE care_plan_tasks 
       SET is_completed = NOT is_completed, 
           completed_at = CASE WHEN is_completed = false THEN NOW() ELSE NULL END
       WHERE id = $1 AND care_plan_id = $2 AND user_id = $3 
       RETURNING *`,
      [taskId, carePlanId, userId]
    );

    if (taskResult.rows.length === 0) {
      const error = new Error("Task not found or unauthorized");
      error.status = 404;
      throw error;
    }
    const updatedTask = taskResult.rows[0];

    // recalculate progress percentage
    const countsResult = await client.query(
      `SELECT 
         COUNT(*)::integer as total, 
         SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END)::integer as completed 
       FROM care_plan_tasks 
       WHERE care_plan_id = $1`,
      [carePlanId]
    );

    const total = countsResult.rows[0].total || 0;
    const completed = countsResult.rows[0].completed || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    const planResult = await client.query(
      `UPDATE care_plans 
       SET progress_percentage = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [progress, carePlanId]
    );

    await client.query("COMMIT");
    
    return {
      task: updatedTask,
      care_plan: planResult.rows[0],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// atomically deletes a care plan along with linked reminders, medications, and tasks.
const deleteCarePlan = async (userId, carePlanId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Ensure the plan exists and belongs to the user
    const checkRes = await client.query(
      `SELECT id FROM care_plans WHERE id = $1 AND user_id = $2`,
      [carePlanId, userId]
    );

    if (checkRes.rows.length === 0) {
      const error = new Error("Care plan not found or unauthorized");
      error.status = 404;
      throw error;
    }

    // Cascade delete associated entities
    await client.query(`DELETE FROM reminders WHERE care_plan_id = $1`, [carePlanId]);
    await client.query(`DELETE FROM medications WHERE care_plan_id = $1`, [carePlanId]);
    await client.query(`DELETE FROM care_plan_tasks WHERE care_plan_id = $1`, [carePlanId]);
    
    const result = await client.query(`DELETE FROM care_plans WHERE id = $1 RETURNING *`, [carePlanId]);

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


// delegates instruction simplification to the ACE service
const simplifyInstruction = async (text) => {
  return await aceService.simplifyInstruction(text);
};

module.exports = {
  generateAndSaveCarePlan,
  getAllCarePlans,
  getCarePlanById,
  updateCarePlanStatus,
  completeTask,
  deleteCarePlan,
  simplifyInstruction,
};
