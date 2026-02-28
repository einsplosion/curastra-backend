const express = require("express");
const abhaController = require("../controllers/abha.controller.js");
const auth = require("../middlewares/auth.middleware.js");

const router = express.Router();

// request OTP (does not require ABHA yet, but requires login)
router.post("/enroll/initiate", auth, abhaController.enrollInitiate);

// verify OTP & enrol ABHA
router.post("/enroll/verify", auth, abhaController.enrollVerify);

module.exports = router;