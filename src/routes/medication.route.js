const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const { ownership } = require("../middlewares/ownership.middleware");
const validate = require("../middlewares/validate.middleware");
const medicationController = require("../controllers/medication.controller");
const {
  createMedicationSchema,
  updateMedicationSchema,
} = require("../validations/medication.validation");

router.use(auth);

// GET /api/medications
router.get("/", medicationController.getMedications);

// POST /api/medications
router.post("/", validate(createMedicationSchema), medicationController.createMedication);

// PATCH /api/medications/:medicationId
router.patch(
  "/:medicationId",
  ownership("medications", "medicationId"),
  validate(updateMedicationSchema),
  medicationController.updateMedication
);

// PATCH /api/medications/:medicationId/toggle
router.patch(
  "/:medicationId/toggle",
  ownership("medications", "medicationId"),
  medicationController.toggleMedication
);

// DELETE /api/medications/:medicationId
router.delete(
  "/:medicationId",
  ownership("medications", "medicationId"),
  medicationController.deleteMedication
);

module.exports = router;
