const abhaService = require("../services/abha.service.js");

// POST /abha/enroll/initiate 
exports.enrollInitiate = async (req, res, next) => {
  try {
    const { aadhaarNumber } = req.body;

    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      return res.status(400).json({ error: "Valid 12-digit Aadhaar number required" });
    }

    const data = await abhaService.enrollmentRequestOtp(aadhaarNumber);

    res.json({
      txnId: data.txnId,
      message: "OTP sent to Aadhaar-linked mobile number",
    });
  } catch (err) {
    next(err);
  }
};


// POST /abha/enroll/verify
exports.enrollVerify = async (req, res, next) => {
  try {
    const { txnId, otp, mobileNumber } = req.body;

    if (!txnId || !otp || !mobileNumber) {
      return res.status(400).json({ error: "txnId, otp and mobileNumber are required" });
    }

    const result = await abhaService.enrolByAadhaar(
      req.user.id,
      txnId,
      otp,
      mobileNumber
    );

    res.json({
      message: "ABHA enrollment successful",
      abhaNumber: result.abhaNumber,
      abhaAddress: result.abhaAddress,
      name: result.name,
      isNew: result.isNew,
    });
  } catch (err) {
    next(err);
  }
};