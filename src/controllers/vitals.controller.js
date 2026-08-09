const vitalsService = require("../services/vitals.service.js");
const labReportService = require("../services/labReport.service.js");

// gets metrics summary
exports.getMetricsSummary = async (req, res, next) => {
  try {
    const summary = await vitalsService.getMetricsSummary(
      req.user.id,
      req.profile?.id || null
    );

    res.json({
      success: true,
      metrics: summary,
    });
  } catch (err) {
    next(err);
  }
};


// gets metric history by type
exports.getMetricHistoryByType = async (req, res, next) => {
  try {
    const { type } = req.params;

    const history = await vitalsService.getMetricHistoryByType(
      req.user.id,
      req.profile?.id || null,
      type
    );

    res.json({
      success: true,
      metric_detail: history,
    });
  } catch (err) {
    next(err);
  }
};


// creates a metric reading
exports.createMetricReading = async (req, res, next) => {
  try {
    const reading = await vitalsService.createMetricReading(
      req.user.id,
      req.profile?.id || null,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Metric reading logged successfully",
      metric: reading,
    });
  } catch (err) {
    next(err);
  }
};


// syncs lab result to metric
exports.syncLabResultToMetric = async (req, res, next) => {
  try {
    const { lab_result_id } = req.body;

    if (!lab_result_id) {
      return res.status(400).json({ error: "lab_result_id is required" });
    }

    const result = await labReportService.syncLabResultToMetric(
      req.user.id,
      req.profile?.id || null,
      lab_result_id
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// deletes a metric reading
exports.deleteMetricReading = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await vitalsService.deleteMetricReading(req.user.id, id);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};
