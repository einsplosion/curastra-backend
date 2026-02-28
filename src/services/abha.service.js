const axios = require("axios");
const buildAbhaHeaders = require("../utils/abhaHeaders.js");
const { getGatewayToken } = require("./gatewayToken.service.js");
const { encryptForAbdm } = require("../utils/encryption.js");
const { pool } = require("../config/db.js");

const BASE = process.env.ABDM_BASE_URL;


// step 1: send OTP to adhaar-linked mobile
const enrollmentRequestOtp = async (aadhaarNumber) => {
    if (!aadhaarNumber) {
      const error = new Error("Aadhaar number is required");
      error.status = 400;
      throw error;
    }
  
    try {
      const encryptedAadhaar = await encryptForAbdm(aadhaarNumber);
      const token = await getGatewayToken();
  
      const response = await axios.post(
        `${BASE}/v3/enrollment/request/otp`,
        {
          scope: ["abha-enrol"],
          loginHint: "aadhaar",
          loginId: encryptedAadhaar,
          otpSystem: "aadhaar",
        },
        { headers: buildAbhaHeaders(token), timeout: 30000 }
      );
  
      return response.data;
    } catch (err) {
      console.error("ABHA OTP request failed:", err.response?.data || err.message);
  
      const abdmMessage =
        err.response?.data?.errorDetails?.[0]?.message ||
        err.response?.data?.message ||
        "Failed to request ABHA OTP";
  
      const error = new Error(abdmMessage);
      error.status = err.response?.status || 500;
      throw error;
    }
};


// step 2: verify OTP and create ABHA
const getSimpleTimestamp = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return (
      now.getFullYear() +
      "-" +
      pad(now.getMonth() + 1) +
      "-" +
      pad(now.getDate()) +
      " " +
      pad(now.getHours()) +
      ":" +
      pad(now.getMinutes()) +
      ":" +
      pad(now.getSeconds())
    );
};
  
const enrolByAadhaar = async (userId, txnId, otp, mobile) => {
    if (!txnId || !otp) {
      const error = new Error("txnId and OTP are required");
      error.status = 400;
      throw error;
    }
  
    try {
      const encryptedOtp = await encryptForAbdm(otp);
      const token = await getGatewayToken();
  
      const response = await axios.post(
        `${BASE}/v3/enrollment/enrol/byAadhaar`,
        {
          authData: {
            authMethods: ["otp"],
            otp: {
              timeStamp: getSimpleTimestamp(),
              txnId,
              otpValue: encryptedOtp,
              mobile: mobile || "",
            },
          },
          consent: {
            code: "abha-enrollment",
            version: "1.4",
          },
        },
        { headers: buildAbhaHeaders(token), timeout: 15000 }
      );
  
      const data = response.data;
  
      // Extract ABHA details from correct response structure
      const abhaNumber = data?.ABHAProfile?.ABHANumber;
      const abhaAddress = data?.ABHAProfile?.phrAddress?.[0] || null;
  
      if (!abhaNumber) {
        throw new Error("ABHA number not returned in response");
      }
  
      // Link ABHA to Curastra user
      await pool.query(
        `UPDATE users
         SET abha_number = $1,
             abha_address = $2,
             abha_linked = TRUE
         WHERE id = $3`,
        [abhaNumber, abhaAddress, userId]
      );
  
      return {
        abhaNumber,
        abhaAddress,
        isNew: data?.isNew || false,
        name: `${data?.ABHAProfile?.firstName || ""} ${data?.ABHAProfile?.lastName || ""}`.trim(),
      };
    } catch (err) {
      console.error("ABHA enrol failed:", err.response?.data || err.message);
  
      const abdmMessage =
        err.response?.data?.errorDetails?.[0]?.message ||
        err.response?.data?.message ||
        "Failed to enrol ABHA";
  
      const error = new Error(abdmMessage);
      error.status = err.response?.status || 500;
      throw error;
    }
};

module.exports = {
    enrollmentRequestOtp,
    enrolByAadhaar,
};