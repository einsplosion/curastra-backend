const express = require("express");
const mockAbhaController = require("./mockAbha.controller.js");
const auth = require("../middlewares/auth.middleware.js");
const { abhaLimiter } = require("../middlewares/ratelimiter.middleware.js");
const validate = require("../middlewares/validate.middleware.js");
const { enrollInitiateSchema } = require("../validations/abha.validation.js");

const router = express.Router();

// Single-step instant mock ABHA linking endpoint
router.post(
  "/enroll/initiate",
  auth,
  abhaLimiter,
  validate(enrollInitiateSchema),
  mockAbhaController.enrollInitiate
);

module.exports = router;
