const express = require("express");
const vitalsController = require("../controllers/vitals.controller.js");
const auth = require("../middlewares/auth.middleware.js");
const { ownership } = require("../middlewares/ownership.middleware.js");
const validate = require("../middlewares/validate.middleware.js");
const {
  createMetricReadingSchema,
  syncLabResultSchema,
} = require("../validations/vitals.validation.js");

const router = express.Router();

router.get("/summary", auth, vitalsController.getMetricsSummary);
router.get("/history/:type", auth, vitalsController.getMetricHistoryByType);

router.post(
  "/",
  auth,
  validate(createMetricReadingSchema),
  vitalsController.createMetricReading
);

router.post(
  "/sync-from-lab",
  auth,
  validate(syncLabResultSchema),
  vitalsController.syncLabResultToMetric
);

router.delete("/:id", auth, ownership("vitals", "id"), vitalsController.deleteMetricReading);

module.exports = router;
