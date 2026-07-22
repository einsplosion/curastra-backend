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

    // 3. fetch user & primary profile
    const result = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.created_at,
         p.id AS profile_id,
         p.name AS profile_name,
         p.relationship,
         p.is_primary,
         p.gender,
         p.date_of_birth,
         p.blood_group,
         p.height_cm,
         p.abha_number,
         p.abha_address,
         p.abha_linked,
         p.is_onboarding_complete
       FROM users u
       LEFT JOIN profiles p
         ON p.owner_user_id = u.id AND p.is_primary = TRUE
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      // user was deleted after token was issued
      return res.status(401).json({
        success: false,
        message: "User no longer exists.",
        code: "USER_NOT_FOUND",
      });
    }

    const row = result.rows[0];

    // 4. attach user to request
    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at,
    };

    // 5. attach primary profile to request
    req.profile = {
      id: row.profile_id,
      name: row.profile_name,
      relationship: row.relationship,
      is_primary: row.is_primary,
      gender: row.gender,
      date_of_birth: row.date_of_birth,
      blood_group: row.blood_group,
      height_cm: row.height_cm,
      abha_number: row.abha_number,
      abha_address: row.abha_address,
      abha_linked: row.abha_linked,
      is_onboarding_complete: row.is_onboarding_complete,
    };

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