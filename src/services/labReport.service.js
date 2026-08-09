const { pool } = require("../config/db");
const { normalizeLabCategory, STANDARD_CATEGORIES } = require("../utils/labCategoryNormalizer.js");
const aceService = require("./ace.service.js");
const vitalsService = require("./vitals.service.js");
const logger = require("../config/logger.js");


// runs lab report analysis via ACE and persists extracted lab parameters to lab_results
const analyzeAndSaveLabReport = async (userId, profileId, recordId, verifiedText) => {
  // 1. call ACE lab analyze endpoint
  const aceResult = await aceService.analyzeLabReport(verifiedText);
  const flags = aceResult.flags || [];

  const savedResults = [];

  // delete old extracted parameters for this record if re-running analysis (idempotent)
  await pool.query(
    `DELETE FROM lab_results WHERE record_id = $1 AND user_id = $2`,
    [recordId, userId]
  );

  // 2. insert each extracted lab parameter into lab_results
  for (const flag of flags) {
    const stdCategory = normalizeLabCategory(flag.category);

    const insertResult = await pool.query(
      `INSERT INTO lab_results (
         user_id, profile_id, record_id, parameter, value, unit, reference_range,
         status, category, can_sync_to_metrics, suggested_metric_type,
         numeric_value_primary, numeric_value_secondary
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        userId,
        profileId || null,
        recordId,
        flag.name,
        flag.value || "",
        flag.unit || null,
        flag.reference_range || null,
        flag.status || "unknown",
        stdCategory,
        Boolean(flag.can_sync_to_metrics),
        flag.suggested_metric_type || null,
        flag.numeric_value_primary !== undefined ? flag.numeric_value_primary : null,
        flag.numeric_value_secondary !== undefined ? flag.numeric_value_secondary : null,
      ]
    );

    savedResults.push(insertResult.rows[0]);
  }

  return {
    summary: aceResult.summary,
    disclaimer: aceResult.disclaimer,
    simulated: aceResult.simulated || false,
    lab_results: savedResults,
  };
};


// retrieves all lab results for a user grouped by the 11 standard lab categories
const getGroupedLabResults = async (userId, profileId) => {
  let query = `
    SELECT id, record_id, parameter, value, unit, reference_range, status,
           category, can_sync_to_metrics, suggested_metric_type,
           numeric_value_primary, numeric_value_secondary, test_date, created_at
    FROM lab_results
    WHERE user_id = $1
  `;
  const params = [userId];

  if (profileId) {
    query += ` AND profile_id = $2`;
    params.push(profileId);
  }

  query += ` ORDER BY created_at DESC`;

  const result = await pool.query(query, params);

  // initialize grouped object with all 11 standard category keys
  const grouped = {};
  for (const cat of STANDARD_CATEGORIES) {
    grouped[cat] = [];
  }

  for (const row of result.rows) {
    const catKey = STANDARD_CATEGORIES.includes(row.category)
      ? row.category
      : "Other / General";
    grouped[catKey].push(row);
  }

  return grouped;
};


// retrieves lab results for a specific uploaded record
const getRecordLabResults = async (userId, recordId) => {
  const result = await pool.query(
    `SELECT id, record_id, parameter, value, unit, reference_range, status,
            category, can_sync_to_metrics, suggested_metric_type,
            numeric_value_primary, numeric_value_secondary, test_date, created_at
     FROM lab_results
     WHERE record_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [recordId, userId]
  );
  return result.rows;
};


// syncs a lab result parameter into the user's "My Metrics" (vitals) table upon user action
const syncLabResultToMetric = async (userId, profileId, labResultId) => {
  const labRes = await pool.query(
    `SELECT * FROM lab_results WHERE id = $1 AND user_id = $2`,
    [labResultId, userId]
  );

  if (labRes.rows.length === 0) {
    const error = new Error("Lab result parameter not found.");
    error.status = 404;
    throw error;
  }

  const item = labRes.rows[0];

  if (!item.suggested_metric_type) {
    const error = new Error("This lab result cannot be mapped to a self-monitored metric.");
    error.status = 400;
    throw error;
  }

  let primaryVal = item.numeric_value_primary;
  if (primaryVal === null || primaryVal === undefined) {
    primaryVal = parseFloat(item.value);
  }

  if (isNaN(primaryVal)) {
    const error = new Error("Unable to parse numeric value for metric sync.");
    error.status = 400;
    throw error;
  }

  const metricReading = await vitalsService.createMetricReading(userId, profileId || item.profile_id, {
    type: item.suggested_metric_type,
    value_primary: primaryVal,
    value_secondary: item.numeric_value_secondary || null,
    unit: item.unit || "unit",
    timing_context: "Lab Report Sync",
    notes: `Synced from Lab Report (${item.parameter}: ${item.value})`,
  });

  return {
    message: "Lab result successfully synced to My Metrics",
    metric: metricReading,
  };
};


module.exports = {
  analyzeAndSaveLabReport,
  getGroupedLabResults,
  getRecordLabResults,
  syncLabResultToMetric,
};
