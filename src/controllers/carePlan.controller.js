const carePlanService = require("../services/carePlan.service.js");

// generates a care plan from verified text 
exports.generateCarePlan = async (req, res, next) => {
  try {
    const { record_id, verified_text, user_notes } = req.body;

    if (!verified_text || typeof verified_text !== "string" || !verified_text.trim()) {
      return res.status(400).json({ error: "verified_text is required for care plan generation" });
    }

    const result = await carePlanService.generateAndSaveCarePlan(
      req.user.id,
      req.profile?.id || null,
      record_id || null,
      verified_text.trim(),
      user_notes || null
    );

    res.status(201).json({
      success: true,
      message: "Care plan generated successfully",
      care_plan: result.care_plan,
      medications: result.medications,
      reminders: result.reminders,
      tasks: result.tasks,
      raw_ai_output: result.raw_ai_output,
    });
  } catch (err) {
    next(err);
  }
};

// fetches all care plans for user
exports.getAllCarePlans = async (req, res, next) => {
  try {
    const { status } = req.query;
    const plans = await carePlanService.getAllCarePlans(
      req.user.id,
      req.profile?.id || null,
      status
    );
    res.json(plans);
  } catch (err) {
    next(err);
  }
};

// fetches full care plan detail by id
exports.getCarePlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await carePlanService.getCarePlanById(req.user.id, id);
    if (!plan) {
      return res.status(404).json({ error: "Care plan not found" });
    }
    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// updates care plan status
exports.updateCarePlanStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updatedPlan = await carePlanService.updateCarePlanStatus(req.user.id, id, status);
    if (!updatedPlan) {
      return res.status(404).json({ error: "Care plan not found or unauthorized" });
    }
    res.json({ success: true, care_plan: updatedPlan });
  } catch (err) {
    next(err);
  }
};

// marks or toggles individual task completion state
exports.completeTask = async (req, res, next) => {
  try {
    const { id, taskId } = req.params;
    const result = await carePlanService.completeTask(req.user.id, id, taskId);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.includes("not found"))) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

// deletes a care plan
exports.deleteCarePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedPlan = await carePlanService.deleteCarePlan(req.user.id, id);
    res.json({ success: true, message: "Care plan deleted successfully", care_plan: deletedPlan });
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.includes("not found"))) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

// simplifies medical instructions
exports.simplifyInstruction = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }
    const simplified = await carePlanService.simplifyInstruction(text.trim());
    res.json(simplified);
  } catch (err) {
    next(err);
  }
};
