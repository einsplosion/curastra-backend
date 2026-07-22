const abhaService = require("../services/abha.service.js");


// POST /abha/enroll/initiate 
exports.enrollInitiate = async (req, res, next) => {
  try {
    const { aadhaarNumber, profile_id } = req.body;

    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      return res.status(400).json({ success: false, message: "Valid 12-digit Aadhaar number required" });
    }

    const targetProfileId = profile_id || req.profile?.id;

    const data = await abhaService.enrollmentRequestOtp(
      req.user.id,
      aadhaarNumber,
      targetProfileId
    );

    return res.status(200).json({
      success: true,
      message: "OTP sent to Aadhaar-linked mobile number.",
      data: {
        txnId: data.txnId,
        profile_id: targetProfileId,
        // send back profile_id so android can pass it to the verify step without storing separately
      },
    });
  } catch (err) {
    next(err);
  }
};


// POST /abha/enroll/verify
exports.enrollVerify = async (req, res, next) => {
  try {
    const { txnId, otp, mobileNumber, profile_id } = req.body;

    if (!txnId || !otp || !mobileNumber) {
      return res.status(400).json({ success: false, message: "txnId, otp and mobileNumber are required" });
    }

    const targetProfileId = profile_id || req.profile?.id;

    const result = await abhaService.enrolByAadhaar(
      req.user.id,
      txnId,
      otp,
      mobileNumber,
      targetProfileId
    );

    return res.status(200).json({
      success: true,
      message: result.message || "ABHA enrollment successful.",
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