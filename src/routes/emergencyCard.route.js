const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const emergencyCardController = require("../controllers/emergencyCard.controller");

router.use(auth);

// GET /api/emergency-card
router.get("/", emergencyCardController.getEmergencyCard);

module.exports = router;
