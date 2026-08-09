const { pool } = require("../config/db");
const { evaluateMetricStatus, METRIC_RANGES } = require("../utils/metricRanges.js");
const logger = require("../config/logger.js");

const METRIC_TYPES = [
  "blood_pressure",
  "blood_glucose",
  "weight",
  "temperature",
  "heart_rate",
  "oxygen_saturation",
];


// creates a new metric reading in vitals table
const createMetricReading = async (userId, profileId, data) => {
  const { type, value_primary, value_secondary, unit, timing_context, notes } = data;

  if (!type || !METRIC_TYPES.includes(type)) {
    const error = new Error(`Invalid metric type. Must be one of: ${METRIC_TYPES.join(", ")}`);
    error.status = 400;
    throw error;
  }

  if (value_primary === undefined || value_primary === null) {
    const error = new Error("Primary value is required for metric entry.");
    error.status = 400;
    throw error;
  }

  const metricUnit = unit || METRIC_RANGES[type]?.unit || "";

  const result = await pool.query(
    `INSERT INTO vitals (user_id, profile_id, type, value_primary, value_secondary, unit, timing_context, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      profileId || null,
      type,
      value_primary,
      value_secondary || null,
      metricUnit,
      timing_context || "manual",
      notes || null,
    ]
  );

  const row = result.rows[0];
  row.status = evaluateMetricStatus(row.type, row.value_primary, row.value_secondary);
  return row;
};


// retrieves the dashboard summary cards for all metrics
// includes latest reading, status badge (in_range/high/low), and 7-day sparkline points
const getMetricsSummary = async (userId, profileId) => {
  const summary = {};

  for (const type of METRIC_TYPES) {
    // 1. fetch latest reading
    let latestQuery = `
      SELECT id, type, value_primary, value_secondary, unit, timing_context, notes, recorded_at
      FROM vitals
      WHERE user_id = $1 AND type = $2
    `;
    const params = [userId, type];

    if (profileId) {
      latestQuery += ` AND profile_id = $3`;
      params.push(profileId);
    }

    latestQuery += ` ORDER BY recorded_at DESC LIMIT 1`;
    const latestRes = await pool.query(latestQuery, params);

    // 2. fetch last 7 days points for mini sparkline graph
    let sparklineQuery = `
      SELECT id, value_primary, value_secondary, recorded_at
      FROM vitals
      WHERE user_id = $1 AND type = $2 AND recorded_at >= NOW() - INTERVAL '7 days'
    `;
    const sparkParams = [userId, type];
    if (profileId) {
      sparklineQuery += ` AND profile_id = $3`;
      sparkParams.push(profileId);
    }
    sparklineQuery += ` ORDER BY recorded_at ASC`;
    const sparkRes = await pool.query(sparklineQuery, sparkParams);

    const latest = latestRes.rows[0] || null;

    if (latest) {
      latest.status = evaluateMetricStatus(latest.type, latest.value_primary, latest.value_secondary);
    }

    summary[type] = {
      type,
      name: METRIC_RANGES[type]?.name || type,
      unit: latest?.unit || METRIC_RANGES[type]?.unit || "",
      has_data: Boolean(latest),
      latest_reading: latest,
      weekly_sparkline: sparkRes.rows,
    };
  }

  return summary;
};


// retrieves the detailed history view for a single metric type
// returns 7-day trend chart points + full scrollable history log list
const getMetricHistoryByType = async (userId, profileId, type) => {
  if (!METRIC_TYPES.includes(type)) {
    const error = new Error(`Invalid metric type: ${type}`);
    error.status = 400;
    throw error;
  }

  // 1. fetch 7-day chart trend points
  let chartQuery = `
    SELECT id, value_primary, value_secondary, recorded_at
    FROM vitals
    WHERE user_id = $1 AND type = $2 AND recorded_at >= NOW() - INTERVAL '7 days'
  `;
  const params = [userId, type];
  if (profileId) {
    chartQuery += ` AND profile_id = $3`;
    params.push(profileId);
  }
  chartQuery += ` ORDER BY recorded_at ASC`;
  const chartRes = await pool.query(chartQuery, params);

  // 2. fetch full history list ordered DESC by recorded_at
  let historyQuery = `
    SELECT id, type, value_primary, value_secondary, unit, timing_context, notes, recorded_at
    FROM vitals
    WHERE user_id = $1 AND type = $2
  `;
  const histParams = [userId, type];
  if (profileId) {
    historyQuery += ` AND profile_id = $3`;
    histParams.push(profileId);
  }
  historyQuery += ` ORDER BY recorded_at DESC`;
  const historyRes = await pool.query(historyQuery, histParams);

  // attach evaluate status to each log item
  const historyList = historyRes.rows.map((row) => ({
    ...row,
    status: evaluateMetricStatus(row.type, row.value_primary, row.value_secondary),
  }));

  const latest = historyList[0] || null;

  return {
    type,
    name: METRIC_RANGES[type]?.name || type,
    unit: latest?.unit || METRIC_RANGES[type]?.unit || "",
    latest_reading: latest,
    status: latest ? latest.status : "in_range",
    weekly_chart: chartRes.rows,
    history_logs: historyList,
  };
};


// deletes a metric reading
const deleteMetricReading = async (userId, id) => {
  const result = await pool.query(
    `DELETE FROM vitals WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Metric reading not found");
    error.status = 404;
    throw error;
  }

  return { message: "Metric reading deleted successfully" };
};


// fetches all metric readings for user and returns a filtered/consolidated summary
// instead of raw individual rows
const getAllMetricsData = async (userId, profileId) => {
  // fetch all vitals data for the user
  const query = `
    SELECT id, type, value_primary, value_secondary, unit, timing_context, notes, recorded_at
    FROM vitals
    WHERE user_id = $1
    ${profileId ? "AND profile_id = $2" : ""}
    ORDER BY recorded_at DESC
  `;

  const params = [userId];
  if (profileId) {
    params.push(profileId);
  }

  const result = await pool.query(query, params);

  // group readings by type for clean summary
  const grouped = {};

  result.rows.forEach(row => {
    const type = row.type;

    if (!grouped[type]) {
      grouped[type] = {
        type,
        name: METRIC_RANGES[type]?.name || type,
        unit: row.unit || METRIC_RANGES[type]?.unit || "",
        latest_reading: null,
        trend_7d: [],  // last 7 days for simple visualization
        history: []     // all readings in reverse chronological order
      };
    }

    const entry = {
      id: row.id,
      value_primary: row.value_primary,
      value_secondary: row.value_secondary,
      unit: row.unit,
      timing_context: row.timing_context,
      recorded_at: row.recorded_at,
      status: evaluateMetricStatus(type, row.value_primary, row.value_secondary)
    };

    // keep only the latest reading
    if (!grouped[type].latest_reading) {
      grouped[type].latest_reading = entry;
    }

    // collect last 7 days trend (chronological for chart rendering)
    if (grouped[type].trend_7d.length < 7) {
      grouped[type].trend_7d.push(entry);
    }

    // collect full history (already reverse chronological because we process DESC)
    grouped[type].history.push(entry);
  });

  // return summary format matching controller expectations
  return Object.keys(grouped).map(type => {
    const data = grouped[type];
    data.trend_7d.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

    return {
      type: data.type,
      name: data.name,
      unit: data.unit,
      has_data: !!data.latest_reading,
      latest_reading: data.latest_reading,
      weekly_sparkline: data.trend_7d,
      history_logs: data.history
    };
  });
};

module.exports = {
  createMetricReading,
  getMetricsSummary,
  getMetricHistoryByType,
  deleteMetricReading,
  getAllMetricsData
};
