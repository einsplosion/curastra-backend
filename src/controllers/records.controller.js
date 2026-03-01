const recordService = require("../services/record.service.js");

// upload a new health record
exports.uploadRecord = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const { type, notes } = req.body;

    if (!type || typeof type !== "string" || !type.trim()) {
      return res.status(400).json({
        error: "Record type is required",
      });
    }

    const record = await recordService.createRecord(
      req.user.id,
      req.file,
      type.trim(),
      notes
    );

    res.status(201).json({
      message: "Record uploaded successfully",
      record,
    });

  } catch (err) {
    next(err);
  }
};


exports.getRecords = async (req, res, next) => {
  try {
    const { type } = req.query;

    const records = await recordService.getUserRecords(
      req.user.id,
      type
    );

    res.json({ records });

  } catch (err) {
    next(err);
  }
};


exports.getRecordById = async (req, res, next) => {
  try {
    const { recordId } = req.params;

    if (!recordId) {
      return res.status(400).json({ error: "Record ID is required" });
    }

    const record = await recordService.getRecordById(
      req.user.id,
      recordId
    );

    res.json({ record });

  } catch (err) {
    next(err);
  }
};


exports.deleteRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    if (!recordId) {
      return res.status(400).json({ error: "Record ID is required" });
    }
    const result = await recordService.deleteRecord(
      req.user.id,
      recordId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};