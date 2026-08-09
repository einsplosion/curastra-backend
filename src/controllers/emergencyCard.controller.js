const emergencyCardService = require("../services/emergencyCard.service");

// GET /api/emergency-card
// retrieves read-only consolidated emergency card data
exports.getEmergencyCard = async (req, res, next) => {
  try {
    const targetProfileId = req.query.profile_id || req.profile?.id;

    if (!targetProfileId) {
      return res.status(400).json({
        success: false,
        message: "No active profile found.",
      });
    }

    const cardData = await emergencyCardService.getEmergencyCardData(
      req.user.id,
      targetProfileId
    );

    res.status(200).json({
      success: true,
      emergency_card: cardData,
    });
  } catch (err) {
    next(err);
  }
};
