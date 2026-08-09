const medicationService = require("../services/medication.service");

// GET /api/medications
exports.getMedications = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;
    const { care_plan_id, is_active } = req.query;

    const medications = await medicationService.getUserMedications(req.user.id, profileId, {
      care_plan_id,
      is_active,
    });

    res.status(200).json({
      success: true,
      count: medications.length,
      medications,
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/medications
exports.createMedication = async (req, res, next) => {
  try {
    const profileId = req.profile?.id || null;

    const result = await medicationService.createMedication(req.user.id, profileId, req.body);

    res.status(201).json({
      success: true,
      message: "Medication added successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/medications/:medicationId
exports.updateMedication = async (req, res, next) => {
  try {
    const { medicationId } = req.params;

    const result = await medicationService.updateMedication(req.user.id, medicationId, req.body);

    res.status(200).json({
      success: true,
      message: "Medication updated successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/medications/:medicationId/toggle
exports.toggleMedication = async (req, res, next) => {
  try {
    const { medicationId } = req.params;

    const result = await medicationService.toggleMedicationActive(req.user.id, medicationId);

    res.status(200).json({
      success: true,
      message: `Medication reminder ${result.reminder_is_active ? "enabled" : "disabled"} successfully`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/medications/:medicationId
exports.deleteMedication = async (req, res, next) => {
  try {
    const { medicationId } = req.params;

    const result = await medicationService.deleteMedication(req.user.id, medicationId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};
