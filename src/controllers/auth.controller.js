const authService = require("../services/auth.service");
const logger = require("../config/logger");


// REGISTER
/**
   POST /auth/register
   creates a new user account, primary profile, and authenticates the user
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const data = await authService.registerUser(name, email, password);

    return res.status(201).json(data);

  } catch (err) {
    next(err);
  }
};


// LOGIN
/**
   POST /auth/login
   authenticates an existing user and returns standardized auth response
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const data = await authService.loginUser(email, password);

    return res.status(200).json(data);

  } catch (err) {
    next(err);
  }
};


// REFRESH
/**
   POST /auth/refresh
   issues a new access token and rotated refresh token
   called automatically by Android when access token expires
*/
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const data = await authService.refreshAccessToken(refreshToken);

    return res.status(200).json(data);

  } catch (err) {
    next(err);
  }
};


// LOGOUT
/**
   POST /auth/logout
   invalidates the refresh token
   android must also clear tokens from EncryptedSharedPreferences
*/
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const data = await authService.logoutUser(refreshToken);

    return res.status(200).json(data);

  } catch (err) {
    next(err);
  }
};

// ME
/**
   GET /auth/me
   returns the current authenticated user and their primary profile
   uses req.user attached by auth middleware — no extra DB query needed
   since middleware already fetched the profile
*/
exports.me = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",
      data: {
        user: req.user,
        profile: req.profile,
      },
    });

  } catch (err) {
    next(err);
  }
};

// ONBOARDING

/**
   PATCH /auth/onboarding
   updates the user's primary profile with health information
   collected during the onboarding screen
   if weight is provided, stores it as the first vitals entry
*/
exports.onboarding = async (req, res, next) => {
  try {
    const { date_of_birth, gender, blood_group, height_cm, weight } = req.body;

    const updatedProfile = await authService.completeOnboarding(
      req.user.id,
      req.profile.id,
      { date_of_birth, gender, blood_group, height_cm, weight }
    );

    return res.status(200).json(updatedProfile);

  } catch (err) {
    next(err);
  }
};