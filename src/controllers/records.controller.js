const recordService = require("../services/record.service.js");
const labReportService = require("../services/labReport.service.js");


// uploads a record
exports.uploadRecord = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const { type, notes } = req.body;

    if (!type || typeof type !== "string" || !type.trim()) {
      return res.status(400).json({ error: "Record type is required" });
    }

    const record = await recordService.createRecord(
      req.user.id,
      req.profile?.id || null,
      req.file,
      type.trim(),
      notes
    );

    res.status(201).json({
      success: true,
      message: "Record uploaded successfully",
      record,
    });
  } catch (err) {
    next(err);
  }
};


// gets all records for a user
exports.getRecords = async (req, res, next) => {
  try {
    const { type } = req.query;

    const records = await recordService.getUserRecords(
      req.user.id,
      req.profile?.id || null,
      type
    );

    res.json({
      success: true,
      records,
    });
  } catch (err) {
    next(err);
  }
};


// gets a record by ID
exports.getRecordById = async (req, res, next) => {
  try {
    const { recordId } = req.params;

    const record = await recordService.getRecordById(req.user.id, recordId);
    const labResults = await labReportService.getRecordLabResults(req.user.id, recordId);

    res.json({
      success: true,
      record: {
        ...record,
        lab_results: labResults,
      },
    });
  } catch (err) {
    next(err);
  }
};


// extracts text from a record
exports.extractRecordText = async (req, res, next) => {
  try {
    const { recordId } = req.params;

    const extraction = await recordService.extractRecordText(req.user.id, recordId);

    res.json({
      success: true,
      message: "Text extracted and PII scrubbed successfully",
      extraction,
    });
  } catch (err) {
    next(err);
  }
};


// analyzes a lab record
exports.analyzeLabRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const { verified_text } = req.body;

    if (!verified_text || typeof verified_text !== "string" || !verified_text.trim()) {
      return res.status(400).json({ error: "verified_text is required for lab report analysis" });
    }

    const analysis = await labReportService.analyzeAndSaveLabReport(
      req.user.id,
      req.profile?.id || null,
      recordId,
      verified_text.trim()
    );

    res.json({
      success: true,
      message: "Lab report analyzed successfully",
      analysis,
    });
  } catch (err) {
    next(err);
  }
};


// gets grouped lab results
exports.getGroupedLabResults = async (req, res, next) => {
  try {
    const grouped = await labReportService.getGroupedLabResults(
      req.user.id,
      req.profile?.id || null
    );

    res.json({
      success: true,
      categories: grouped,
    });
  } catch (err) {
    next(err);
  }
};


// deletes a record
exports.deleteRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const result = await recordService.deleteRecord(req.user.id, recordId);
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};