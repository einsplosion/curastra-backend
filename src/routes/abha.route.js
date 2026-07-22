const express = require("express");
const abhaController = require("../controllers/abha.controller.js");
const auth = require("../middlewares/auth.middleware.js");
const { abhaLimiter } = require("../middlewares/ratelimiter.middleware.js");
const validate = require("../middlewares/validate.middleware.js");
const { enrollInitiateSchema, enrollVerifySchema } = require("../validations/abha.validation.js");

const router = express.Router();

// request OTP (does not require ABHA yet, but requires login)
router.post(
    "/enroll/initiate",
    auth,
    abhaLimiter,
    validate(enrollInitiateSchema),
    abhaController.enrollInitiate
);

// verify OTP & enrol ABHA
router.post(
    "/enroll/verify",
    auth,
    validate(enrollVerifySchema),
    abhaController.enrollVerify
);

module.exports = router;