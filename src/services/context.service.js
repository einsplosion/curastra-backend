const { pool } = require("../config/db");
const logger = require("../config/logger");


// individual module fetchers
const getProfileSummary = async (userId, profileId) => {
  let query = `
    SELECT 
      p.name, p.gender, p.date_of_birth, p.blood_group,
      p.height_cm, p.allergies, p.abha_linked,
      EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
    FROM profiles p
    WHERE p.owner_user_id = $1 AND (p.is_archived = FALSE OR p.is_archived IS NULL)
  `;
  const params = [userId];

  if (profileId) {
    query += ` AND p.id = $2`;
    params.push(profileId);
  } else {
    query += ` AND p.is_primary = TRUE`;
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
};


const getConversationHistory = async (conversationId) => {
  if (!conversationId) return [];

  const result = await pool.query(
    `SELECT role, content, created_at
     FROM chat_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [conversationId]
  );

  return result.rows.reverse();
};


const getActiveMedications = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT name, dosage, frequency, timing, instructions, duration
     FROM medications
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND is_active = TRUE
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId, profileId || null]
  );

  return result.rows;
};


const getActiveCarePlanSummary = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT 
       id, summary, duration_days, start_date, end_date,
       progress_percentage, status,
       (end_date - CURRENT_DATE) AS days_remaining
     FROM care_plans
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, profileId || null]
  );

  return result.rows[0] || null;
};


const getActiveCarePlanFull = async (userId, profileId) => {
  const plan = await getActiveCarePlanSummary(userId, profileId);
  if (!plan) return null;

  const tasks = await pool.query(
    `SELECT title, category, is_completed, due_date
     FROM care_plan_tasks
     WHERE care_plan_id = $1
     ORDER BY sort_order ASC
     LIMIT 15`,
    [plan.id]
  );

  return {
    ...plan,
    tasks: tasks.rows,
  };
};


const getTodayTasks = async (userId, profileId) => {
  const plan = await getActiveCarePlanSummary(userId, profileId);
  if (!plan) return [];

  const result = await pool.query(
    `SELECT title, category, is_completed
     FROM care_plan_tasks
     WHERE care_plan_id = $1
       AND (due_date = CURRENT_DATE OR due_date IS NULL)
       AND is_completed = FALSE
     ORDER BY sort_order ASC
     LIMIT 5`,
    [plan.id]
  );

  return result.rows;
};


const getWatchSymptoms = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT watch_for_symptoms
     FROM care_plans
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, profileId || null]
  );

  return result.rows[0]?.watch_for_symptoms || [];
};


const getDietRecommendations = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT diet_recommendations
     FROM care_plans
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, profileId || null]
  );

  return result.rows[0]?.diet_recommendations || [];
};

const getLifestyleRecommendations = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT lifestyle_recommendations
     FROM care_plans
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, profileId || null]
  );

  return result.rows[0]?.lifestyle_recommendations || [];
};


const getFollowUpAppointments = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT follow_up_appointments
     FROM care_plans
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, profileId || null]
  );

  return result.rows[0]?.follow_up_appointments || [];
};


const getRecentVitals = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT DISTINCT ON (type)
       type, value_primary, value_secondary, unit, timing_context, recorded_at
     FROM vitals
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
     ORDER BY type, recorded_at DESC`,
    [userId, profileId || null]
  );

  return result.rows;
};


const getLabResultsSummary = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT parameter, value, unit, reference_range, status, test_date
     FROM lab_results
     WHERE user_id = $1
       AND (profile_id = $2 OR profile_id IS NULL)
       AND status IN ('abnormal', 'high', 'low', 'borderline')
     ORDER BY test_date DESC
     LIMIT 10`,
    [userId, profileId || null]
  );

  return result.rows;
};


// master context builder
// dynamically executes queries only for modules requested by intent classifier
// always includes profile_summary and conversation_history
const buildChatContext = async (userId, profileId, conversationId, modules = []) => {
  const moduleMap = {
    profile_summary: () => getProfileSummary(userId, profileId),
    conversation_history: () => getConversationHistory(conversationId),
    medications: () => getActiveMedications(userId, profileId),
    active_care_plan_summary: () => getActiveCarePlanSummary(userId, profileId),
    active_care_plan_full: () => getActiveCarePlanFull(userId, profileId),
    tasks: () => getTodayTasks(userId, profileId),
    active_care_plan_watch_symptoms: () => getWatchSymptoms(userId, profileId),
    diet_recommendations: () => getDietRecommendations(userId, profileId),
    lifestyle_recommendations: () => getLifestyleRecommendations(userId, profileId),
    follow_up_appointments: () => getFollowUpAppointments(userId, profileId),
    recent_vitals: () => getRecentVitals(userId, profileId),
    lab_results_summary: () => getLabResultsSummary(userId, profileId),
  };

  const fetchPromises = modules
    .filter((m) => moduleMap[m])
    .map(async (m) => {
      try {
        const data = await moduleMap[m]();
        return [m, data];
      } catch (err) {
        logger.error(`Failed to fetch context module: ${m}`, { error: err.message });
        return [m, null];
      }
    });

  const results = await Promise.all(fetchPromises);
  return Object.fromEntries(results);
};

module.exports = {
  buildChatContext,
  getProfileSummary,
  getConversationHistory,
  getActiveMedications,
  getActiveCarePlanSummary,
  getActiveCarePlanFull,
  getTodayTasks,
  getWatchSymptoms,
  getDietRecommendations,
  getLifestyleRecommendations,
  getFollowUpAppointments,
  getRecentVitals,
  getLabResultsSummary,
};
