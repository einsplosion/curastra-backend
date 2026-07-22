const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware.js");
const { loginLimiter, registerLimiter, refreshLimiter } = require("../middlewares/ratelimiter.middleware.js");
const {
    registerSchema,
    loginSchema,
    refreshSchema,
    logoutSchema,
    onboardingSchema,
} = require("../validations/auth.validation.js");




// PUBLIC ROUTES

/**
   POST /auth/register
   creates a new user, primary profile, and authenticates
   rate limited: 5 attempts per hour per IP
*/
router.post(
    "/register",
    registerLimiter,
    validate(registerSchema),
    authController.register
);

/**
   POST /auth/login
   authenticates an existing user, rotates refresh token on each login
   rate limited: 10 attempts per 15 minutes per IP
*/
router.post(
    "/login",
    loginLimiter,
    validate(loginSchema),
    authController.login
);

/**
   POST /auth/refresh
   issues a new access token using a valid refresh token
   called automatically by android when access token expires (401 + TOKEN_EXPIRED)
   no rate limiter here - android handles this transparently
*/
router.post(
    "/refresh",
    refreshLimiter,
    validate(refreshSchema),
    authController.refresh
);



// PROTECTED ROUTES

/**
   POST /auth/logout
   invalidates the refresh token in the database.
   android must also clear tokens from EncryptedSharedPreferences.
   requires valid access token — ensures only authenticated users can logout.
*/
router.post(
    "/logout",
    authMiddleware,
    validate(logoutSchema),
    authController.logout
);

/**
   GET /auth/me
   returns the current authenticated user and their primary profile
   response is assembled from req.user and req.profile (set by auth middleware)
   no extra DB query needed
*/
router.get(
    "/me",
    authMiddleware,
    authController.me
);

/**
   PATCH /auth/onboarding
   updates the primary profile with health data collected during onboarding
   if weight is provided, stores it as the first vitals entry
   sets is_onboarding_complete = TRUE on the profile
*/
router.patch(
    "/onboarding",
    authMiddleware,
    validate(onboardingSchema),
    authController.onboarding
);

module.exports = router;