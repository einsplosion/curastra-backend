const express = require("express");
const recordController = require("../controllers/records.controller.js");
const auth = require("../middlewares/auth.middleware.js");

const router = express.Router();

// GET /api/lab-parameters/grouped & GET /api/lab-results/grouped
router.get("/grouped", auth, recordController.getGroupedLabResults);

module.exports = router;
