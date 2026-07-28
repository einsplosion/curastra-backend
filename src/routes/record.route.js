const express = require("express");
const recordController = require("../controllers/records.controller.js");
const auth = require("../middlewares/auth.middleware.js");
const upload = require("../middlewares/upload.middleware.js");
const { ownership } = require("../middlewares/ownership.middleware.js");

const router = express.Router();

router.post("/upload", auth, upload.single("file"), recordController.uploadRecord);
router.get("/", auth, recordController.getRecords);
router.get("/:recordId", auth, ownership("records", "recordId"), recordController.getRecordById);
router.delete("/:recordId", auth, ownership("records", "recordId"), recordController.deleteRecord);

module.exports = router;