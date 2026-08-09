const express = require("express");
const router = express.Router();

const auth = require("../middlewares/auth.middleware");
const { ownership } = require("../middlewares/ownership.middleware");
const validate = require("../middlewares/validate.middleware");
const profileController = require("../controllers/profile.controller");
const {
  createProfileSchema,
  updateProfileSchema,
} = require("../validations/profile.validation");

router.use(auth);

// active profile & switching (registered before /:profileId)
router.get("/active", profileController.getActiveProfile);
router.post("/switch/:profileId", profileController.switchProfile);

// profiles CRUD
router.get("/", profileController.getProfiles);
router.post("/", validate(createProfileSchema), profileController.createProfile);

router.get("/:profileId", profileController.getProfileById);

router.patch(
  "/:profileId",
  ownership("profiles", "profileId"),
  validate(updateProfileSchema),
  profileController.updateProfile
);

router.delete(
  "/:profileId",
  ownership("profiles", "profileId"),
  profileController.deleteProfile
);

module.exports = router;
