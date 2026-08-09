const { pool } = require("../config/db");
const logger = require("../config/logger");
const vitalsService = require("./vitals.service");

// retrieves consolidated emergency card data for a given profile
const getEmergencyCardData = async (userId, targetProfileId) => {
  // 1. resolve profile details (checking ownership or active caregiver delegation)
  const profileRes = await pool.query(
    `SELECT 
       p.id,
       p.owner_user_id,
       p.name,
       p.relationship,
       p.gender,
       p.date_of_birth,
       p.blood_group,
       p.height_cm,
       p.allergies,
       p.abha_number,
       p.abha_address,
       p.abha_linked,
       p.is_primary,
       EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
     FROM profiles p
     WHERE p.id = $1 AND (p.owner_user_id = $2 OR p.id IN (
       SELECT profile_id FROM caregiver_access WHERE caregiver_user_id = $2 AND status = 'active'
     )) AND (p.is_archived = FALSE OR p.is_archived IS NULL)`,
    [targetProfileId, userId]
  );

  if (profileRes.rows.length === 0) {
    const error = new Error("Profile not found or access denied");
    error.status = 404;
    throw error;
  }

  const profile = profileRes.rows[0];

  // 2. fetch active medications (name + dosage + timing + frequency, max 10)
  const medsRes = await pool.query(
    `SELECT id, name, dosage, frequency, timing, instructions, source
     FROM medications
     WHERE user_id = $1 AND profile_id = $2 AND is_active = TRUE
     ORDER BY created_at DESC
     LIMIT 10`,
    [profile.owner_user_id, profile.id]
  );

  // 3. fetch active care plan summary & extract known allergies
  const planRes = await pool.query(
    `SELECT id, summary, disclaimer, watch_for_symptoms, start_date, end_date, created_at
     FROM care_plans
     WHERE profile_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [profile.id]
  );

  const activeCarePlan = planRes.rows[0] || null;
  const knownAllergies = Array.isArray(profile.allergies) ? [...profile.allergies] : [];

  // parse allergies from active care plan (or past care plans if active has none)
  const allPlansRes = await pool.query(
    `SELECT watch_for_symptoms FROM care_plans WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [profile.id]
  );

  for (const row of allPlansRes.rows) {
    let symptoms = row.watch_for_symptoms;
    if (typeof symptoms === "string") {
      try {
        symptoms = JSON.parse(symptoms);
      } catch (e) {
        symptoms = [];
      }
    }
    if (Array.isArray(symptoms)) {
      for (const item of symptoms) {
        const itemStr = typeof item === "string" ? item : JSON.stringify(item);
        if (/allergy|allergies/i.test(itemStr) && !knownAllergies.includes(itemStr)) {
          knownAllergies.push(itemStr);
        }
      }
    }
  }

  // 4. fetch latest vitals summary for emergency triage
  let latestVitals = null;
  try {
    latestVitals = await vitalsService.getMetricsSummary(profile.owner_user_id, profile.id);
  } catch (vErr) {
    logger.warn("Could not fetch vitals for emergency card", { error: vErr.message });
  }

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      relationship: profile.relationship,
      gender: profile.gender,
      date_of_birth: profile.date_of_birth,
      age: profile.age ? parseInt(profile.age) : null,
      blood_group: profile.blood_group || "Unknown",
      allergies: profile.allergies || [],
      abha_number: profile.abha_number || null,
      abha_address: profile.abha_address || null,
      abha_linked: profile.abha_linked || false,
    },
    active_medications: medsRes.rows,
    known_allergies: knownAllergies,
    active_care_plan: activeCarePlan
      ? {
          id: activeCarePlan.id,
          summary: activeCarePlan.summary,
          disclaimer: activeCarePlan.disclaimer,
          start_date: activeCarePlan.start_date,
          end_date: activeCarePlan.end_date,
        }
      : null,
    latest_vitals: latestVitals,
    emergency_contacts: [], // reserved for future schema addition
  };
};

module.exports = {
  getEmergencyCardData,
};
