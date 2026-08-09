const { verifyAccessToken } = require("../utils/token.util.js");
const { pool } = require("../config/db.js");
const logger = require("../config/logger.js");

/**
  Authentication middleware

  responsibilities:
   1. Extract Bearer token from Authorization header
   2. Verify JWT signature and expiry
   3. Fetch user from database (ensures deleted users are rejected)
   4. Fetch user's primary profile from database
   5. Attach req.user and req.profile for downstream controllers

  All protected routes receive both req.user and req.profile.
*/

const auth = async (req, res, next) => {
  try {
    // 1. extract token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access token is required.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required.",
      });
    }

    // 2. verify jwt
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Access token has expired.",
          code: "TOKEN_EXPIRED",
          // android uses this code to trigger token refresh
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid access token.",
        code: "TOKEN_INVALID",
      });
    }

    // 3. fetch user
    const userRes = await pool.query(
      `SELECT id, name, email, created_at FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
        code: "USER_NOT_FOUND",
      });
    }

    const user = userRes.rows[0];
    req.user = user;

    // 4. determine requested profile (X-Profile-ID header or fallback to Primary)
    const targetProfileId = req.headers["x-profile-id"] || req.headers["X-Profile-ID"];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    let profileRes;

    if (targetProfileId && uuidRegex.test(targetProfileId)) {
      profileRes = await pool.query(
        `SELECT 
           id AS profile_id, name AS profile_name, relationship, is_primary,
           gender, date_of_birth, blood_group, height_cm, allergies, abha_number,
           abha_address, abha_linked, is_onboarding_complete
         FROM profiles
         WHERE id = $1 AND (owner_user_id = $2 OR id IN (
           SELECT profile_id FROM caregiver_access WHERE caregiver_user_id = $2 AND status = 'active'
         )) AND (is_archived = FALSE OR is_archived IS NULL)`,
        [targetProfileId, user.id]
      );
    }

    // fallback to Primary Profile if header omitted or invalid
    if (!profileRes || profileRes.rows.length === 0) {
      profileRes = await pool.query(
        `SELECT 
           id AS profile_id, name AS profile_name, relationship, is_primary,
           gender, date_of_birth, blood_group, height_cm, allergies, abha_number,
           abha_address, abha_linked, is_onboarding_complete
         FROM profiles
         WHERE owner_user_id = $1 AND is_primary = TRUE AND (is_archived = FALSE OR is_archived IS NULL)`,
        [user.id]
      );
    }

    const pRow = profileRes.rows[0] || null;

    if (pRow) {
      req.profile = {
        id: pRow.profile_id,
        name: pRow.profile_name,
        relationship: pRow.relationship,
        is_primary: pRow.is_primary,
        gender: pRow.gender,
        date_of_birth: pRow.date_of_birth,
        blood_group: pRow.blood_group,
        height_cm: pRow.height_cm,
        allergies: pRow.allergies || [],
        abha_number: pRow.abha_number,
        abha_address: pRow.abha_address,
        abha_linked: pRow.abha_linked,
        is_onboarding_complete: pRow.is_onboarding_complete,
      };
    } else {
      req.profile = null;
    }

    next();

  } catch (err) {
    logger.error("Auth middleware error", { error: err.message });
    return res.status(500).json({
      success: false,
      message: "Authentication error. Please try again.",
    });
  }
};

module.exports = auth;