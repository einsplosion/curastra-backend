const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const caregiverController = require("../controllers/caregiver.controller");
const {
  inviteCaregiverSchema,
  updatePermissionsSchema,
} = require("../validations/caregiver.validation");

router.use(auth);

// caregiver dashboard for caregivers
router.get("/my-patients", caregiverController.getMyPatients);
router.get("/patient-data/:profileId", caregiverController.getPatientOverview);

// invitation accept / decline for caregiver
router.patch("/:accessId/accept", caregiverController.acceptInvitation);
router.patch("/:accessId/decline", caregiverController.declineInvitation);

// patient management of caregiver
router.get("/", caregiverController.getCaregivers);
router.post("/invite", validate(inviteCaregiverSchema), caregiverController.inviteCaregiver);
router.patch(
  "/:accessId/permissions",
  validate(updatePermissionsSchema),
  caregiverController.updatePermissions
);
router.delete("/:accessId", caregiverController.revokeAccess);

module.exports = router;
