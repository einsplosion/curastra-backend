const profileService = require("../services/profile.service");

// GET /api/profiles
// lists all family member profiles for current user
exports.getProfiles = async (req, res, next) => {
  try {
    const profiles = await profileService.getUserProfiles(req.user.id);

    res.status(200).json({
      success: true,
      count: profiles.length,
      profiles,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/profiles/active
// gets currently active profile in session (from X-Profile-ID header or primary fallback)
exports.getActiveProfile = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      profile: req.profile,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/profiles/:profileId
// gets specific profile by ID
exports.getProfileById = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const profile = await profileService.getProfileById(
      req.user.id,
      profileId
    );

    res.status(200).json({
      success: true,
      profile,
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/profiles
// creates a new family member profile
exports.createProfile = async (req, res, next) => {
  try {
    const profile = await profileService.createFamilyProfile(
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Family profile created successfully",
      profile,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/profiles/:profileId
// updates an existing profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const profile = await profileService.updateProfile(
      req.user.id,
      profileId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile,
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/profiles/:profileId
// deletes a family member profile (primary profile protected)
exports.deleteProfile = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const result = await profileService.deleteProfile(
      req.user.id,
      profileId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// POST /api/profiles/switch/:profileId
// switches active profile for session
exports.switchProfile = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const result = await profileService.switchActiveProfile(
      req.user.id,
      profileId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};
