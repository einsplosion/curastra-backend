const mockAbhaService = require("./mockAbha.service.js");

// POST /abha/enroll/initiate (Single-step instant mock ABHA linking)
exports.enrollInitiate = async (req, res, next) => {
  try {
    const { aadhaarNumber, profile_id } = req.body;

    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      return res.status(400).json({ success: false, message: "Valid 12-digit Aadhaar number required" });
    }

    const targetProfileId = profile_id || req.profile?.id;

    const result = await mockAbhaService.mockInstantLink(
      req.user.id,
      aadhaarNumber,
      targetProfileId
    );

    return res.status(200).json({
      success: true,
      message: "ABHA card linked successfully.",
      data: {
        abhaNumber: result.abhaNumber,
        abhaAddress: result.abhaAddress,
        name: result.name,
        isNew: result.isNew,
        profile_id: targetProfileId,
      },
    });
  } catch (err) {
    next(err);
  }
};
