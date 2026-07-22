const axios = require("axios");
const { pool } = require("../config/db.js");
const logger = require("../config/logger.js");
const buildAbhaHeaders = require("../utils/abhaHeaders.js");
const { getGatewayToken } = require("./gatewayToken.service.js");
const { encryptForAbdm } = require("../utils/encryption.js");

// CONSTANTS
const BASE = process.env.ABDM_BASE_URL;
const ABDM_TIMEOUT = 30000; // 30s timeout — ABDM sandbox gateway can be slow

// HELPER FUNCTIONS

// formats current timestamp as "YYYY-MM-DD HH:MM:SS", abdm does not accept ISO
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


// resolves and verifies profile ownership
const resolveAndVerifyProfile = async (userId, targetProfileId = null, client = pool) => {
  let query;
  let params;

  if (targetProfileId) {
    query = `SELECT id, name, relationship, is_primary, abha_number, abha_address, abha_linked
             FROM profiles
             WHERE id = $1 AND owner_user_id = $2`;
    params = [targetProfileId, userId];
  } else {
    query = `SELECT id, name, relationship, is_primary, abha_number, abha_address, abha_linked
             FROM profiles
             WHERE owner_user_id = $1 AND is_primary = TRUE`;
    params = [userId];
  }

  const result = await client.query(query, params);

  if (result.rows.length === 0) {
    const error = new Error(
      targetProfileId
        ? "Target profile not found or access denied."
        : "Primary user profile not found. Please contact support."
    );
    error.status = targetProfileId ? 404 : 500;
    throw error;
  }

  return result.rows[0];
};


// checks if an ABHA number is already linked to a profile in Curastra
const checkAbhaAvailability = async (abhaNumber, targetProfileId, client = pool) => {
  const result = await client.query(
    `SELECT id, owner_user_id, name FROM profiles WHERE abha_number = $1`,
    [abhaNumber]
  );

  if (result.rows.length === 0) {
    return { status: "AVAILABLE" };
  }

  const existingProfile = result.rows[0];

  if (existingProfile.id === targetProfileId) {
    return { status: "ALREADY_LINKED_TO_SELF", profile: existingProfile };
  }

  return { status: "LINKED_TO_OTHER", profile: existingProfile };
};

// ENROLLMENT REQUEST OTP

// 1. validate inputs and verify profile ownership
// 2. encrypt Aadhaar number using RSA-OAEP SHA-1 spec
// 3. call ABDM Gateway to trigger OTP to Aadhaar-linked mobile
// 4. return txnId for Step 2

const enrollmentRequestOtp = async (userId, aadhaarNumber, profileId = null) => {
  if (!aadhaarNumber || aadhaarNumber.length !== 12) {
    const error = new Error("Valid 12-digit Aadhaar number is required");
    error.status = 400;
    throw error;
  }

  // pre-check profile ownership & existence before making gateway call
  const targetProfile = await resolveAndVerifyProfile(userId, profileId);

  if (targetProfile.abha_linked) {
    const error = new Error("This profile is already linked to an ABHA number.");
    error.status = 409;
    throw error;
  }

  try {
    const encryptedAadhaar = await encryptForAbdm(aadhaarNumber);
    const token = await getGatewayToken();

    logger.info("Requesting ABHA enrollment OTP", {
      userId,
      profileId: targetProfile.id,
      isPrimary: targetProfile.is_primary,
      // aadhaar omitted for PII compliance
    });

    const response = await axios.post(
      `${BASE}/v3/enrollment/request/otp`,
      {
        scope: ["abha-enrol"],
        loginHint: "aadhaar",
        loginId: encryptedAadhaar,
        otpSystem: "aadhaar",
      },
      {
        headers: buildAbhaHeaders(token),
        timeout: ABDM_TIMEOUT,
      }
    );

    return {
      txnId: response.data.txnId,
      message: "OTP sent to Aadhaar-linked mobile number",
    };

  } catch (err) {
    if (err.status && !err.isAxiosError) {
      throw err;
    }

    const rawMessage =
      err.response?.data?.errorDetails?.[0]?.message ||
      err.response?.data?.details?.[0]?.message ||
      err.response?.data?.message ||
      err.response?.data?.error?.message ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Failed to request ABHA OTP. Please try again.";

    const abdmMessage = typeof rawMessage === "string" ? rawMessage : "Failed to request ABHA OTP.";
    const abdmStatus = err.response?.status || err.status || 500;

    logger.error("ABHA OTP request failed", {
      userId,
      profileId: targetProfile?.id,
      abdmStatus,
      abdmMessage,
    });

    const error = new Error(abdmMessage);
    error.status = abdmStatus;
    throw error;
  }
};


// ENROLL BY AADHAAR

// 1. validate inputs and resolve target profile
// 2. encrypt OTP using RSA-OAEP SHA-1 spec
// 3. submit to ABDM for verification
// 4. extract ABHA details from gateway response
// 5. open atomic database transaction
// 6. verify ABHA number availability (prevent cross-profile duplicates / account takeover)
// 7. update target profile with abha_number, abha_address, abha_linked = TRUE
// 8. commit transaction and return updated profile data

const enrolByAadhaar = async (userId, txnId, otp, mobile, profileId = null) => {
  if (!txnId || !otp) {
    const error = new Error("txnId and OTP are required");
    error.status = 400;
    throw error;
  }

  // pre-check profile ownership & existence
  const targetProfile = await resolveAndVerifyProfile(userId, profileId);

  if (targetProfile.abha_linked) {
    const error = new Error("This profile is already linked to an ABHA number.");
    error.status = 409;
    throw error;
  }

  try {
    const encryptedOtp = await encryptForAbdm(otp);
    const token = await getGatewayToken();

    logger.info("Verifying ABHA enrollment OTP", {
      userId,
      profileId: targetProfile.id,
    });

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
      {
        headers: buildAbhaHeaders(token),
        timeout: ABDM_TIMEOUT,
      }
    );

    const data = response.data;

    // extract abha details from abdm gateway response
    const abhaNumber = data?.ABHAProfile?.ABHANumber;
    const abhaAddress = data?.ABHAProfile?.phrAddress?.[0] || null;
    const isNew = data?.isNew || false;
    const name = `${data?.ABHAProfile?.firstName || ""} ${data?.ABHAProfile?.lastName || ""}`.trim();

    if (!abhaNumber) {
      logger.error("ABHA number not returned by ABDM gateway", {
        userId,
        profileId: targetProfile.id,
      });
      const error = new Error("ABHA enrollment completed but no ABHA number was returned.");
      error.status = 502;
      throw error;
    }

    // using transaction for DB writes
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // check ABHA number status in curastra DB
      const availability = await checkAbhaAvailability(abhaNumber, targetProfile.id, client);

      if (availability.status === "LINKED_TO_OTHER") {
        await client.query("ROLLBACK");
        const error = new Error("This ABHA number is already linked to another profile in Curastra.");
        error.status = 409;
        throw error;
      }

      if (availability.status === "ALREADY_LINKED_TO_SELF") {
        await client.query("ROLLBACK");
        logger.info("ABHA already linked to target profile", {
          userId,
          profileId: targetProfile.id,
        });
        return {
          abhaNumber,
          abhaAddress,
          isNew: false,
          name,
          profile: targetProfile,
          message: "ABHA is already linked to this profile",
        };
      }

      // update target profile with ABHA details
      const updateResult = await client.query(
        `UPDATE profiles
         SET
           abha_number = $1,
           abha_address = $2,
           abha_linked = TRUE
         WHERE id = $3 AND owner_user_id = $4
         RETURNING id, owner_user_id, name, relationship, is_primary, abha_number, abha_address, abha_linked`,
        [abhaNumber, abhaAddress, targetProfile.id, userId]
      );

      await client.query("COMMIT");

      logger.info("ABHA enrollment successful", {
        userId,
        profileId: targetProfile.id,
        isNew,
      });

      return {
        abhaNumber,
        abhaAddress,
        isNew,
        name,
        profile: updateResult.rows[0],
      };

    } catch (err) {
      await client.query("ROLLBACK");

      // failsafe for PostgreSQL unique constraint violation (code 23505)
      if (err.code === "23505") {
        const error = new Error("This ABHA number is already linked to another profile in Curastra.");
        error.status = 409;
        throw error;
      }

      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    if (err.status && !err.isAxiosError) {
      throw err;
    }

    const rawMessage =
      err.response?.data?.errorDetails?.[0]?.message ||
      err.response?.data?.details?.[0]?.message ||
      err.response?.data?.message ||
      err.response?.data?.error?.message ||
      (typeof err.response?.data === "string" ? err.response.data : null) ||
      err.message ||
      "Failed to complete ABHA enrollment. Please try again.";

    const abdmMessage = typeof rawMessage === "string" ? rawMessage : "Failed to complete ABHA enrollment.";
    const abdmStatus = err.response?.status || err.status || 500;

    logger.error("ABHA enrollment failed", {
      userId,
      profileId: targetProfile?.id,
      abdmStatus,
      abdmMessage,
    });

    const error = new Error(abdmMessage);
    error.status = abdmStatus;
    throw error;
  }
};


// EXPORTS

module.exports = {
  enrollmentRequestOtp,
  enrolByAadhaar,
};