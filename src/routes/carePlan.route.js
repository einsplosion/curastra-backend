const express = require("express");
const carePlanController = require("../controllers/carePlan.controller.js");
const auth = require("../middlewares/auth.middleware.js");
const { ownership } = require("../middlewares/ownership.middleware.js");
const validate = require("../middlewares/validate.middleware.js");
const {
  generateCarePlanSchema,
  updateCarePlanStatusSchema,
  simplifyInstructionSchema,
} = require("../validations/carePlan.validation.js");

const router = express.Router();

router.post("/generate", auth, validate(generateCarePlanSchema), carePlanController.generateCarePlan);
router.post("/simplify", auth, validate(simplifyInstructionSchema), carePlanController.simplifyInstruction);

router.get("/", auth, carePlanController.getAllCarePlans);
router.get("/:id", auth, ownership("care_plans", "id"), carePlanController.getCarePlanById);
router.patch("/:id/status", auth, ownership("care_plans", "id"), validate(updateCarePlanStatusSchema), carePlanController.updateCarePlanStatus);
router.patch("/:id/tasks/:taskId/complete", auth, ownership("care_plans", "id"), carePlanController.completeTask);
router.delete("/:id", auth, ownership("care_plans", "id"), carePlanController.deleteCarePlan);

module.exports = router;
