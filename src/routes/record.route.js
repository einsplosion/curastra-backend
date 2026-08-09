const express = require("express");
const recordController = require("../controllers/records.controller.js");
const auth = require("../middlewares/auth.middleware.js");
const upload = require("../middlewares/upload.middleware.js");
const { ownership } = require("../middlewares/ownership.middleware.js");
const validate = require("../middlewares/validate.middleware.js");
const {
  uploadRecordSchema,
  analyzeLabRecordSchema,
} = require("../validations/record.validation.js");

const router = express.Router();

router.post("/upload", auth, upload.single("file"), validate(uploadRecordSchema), recordController.uploadRecord);
router.get("/", auth, recordController.getRecords);
router.get("/:recordId", auth, ownership("records", "recordId"), recordController.getRecordById);
router.post("/:recordId/extract", auth, ownership("records", "recordId"), recordController.extractRecordText);
router.post("/:recordId/analyze-lab", auth, ownership("records", "recordId"), validate(analyzeLabRecordSchema), recordController.analyzeLabRecord);
router.delete("/:recordId", auth, ownership("records", "recordId"), recordController.deleteRecord);

module.exports = router;