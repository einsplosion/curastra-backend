const bcrypt = require("bcrypt");
const { pool } = require("../config/db");
const logger = require("../config/logger");
const {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken
} = require("../utils/token.util");


const SALT_ROUNDS = 12;


// HELPER FUNCTIONS
// standard auth response
const buildAuthResponse = (user, profile, accessToken, refreshToken, message) => ({
  success: true,
  message,
  data: {
    accessToken,
    refreshToken,
    user,
    profile
  },
});

// calculate expiry for new refresh token
const getRefreshTokenExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS));
  return expiresAt;
};

// store hashed refresh token
const storeRefreshToken = async (client, userId, tokenHash, expiresAt) => {
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
};

// rotates refresh tokens (multi-device sessions)
const rotateRefreshToken = async (client = pool, userId, tokenHash, expiresAt) => {
  // clean up expired tokens for this user
  await client.query(
    `DELETE FROM refresh_tokens
     WHERE user_id = $1 AND expires_at < NOW()`,
    [userId]
  );

  // store new token
  await client.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
};

// delete specific refresh token
const deleteRefreshToken = async (tokenHash, client = pool) => {
  await client.query(
    `DELETE FROM refresh_tokens WHERE token = $1`,
    [tokenHash]
  );
};

// validate refresh token
const validateRefreshToken = async (rawToken, client = pool) => {
  const tokenHash = hashRefreshToken(rawToken);

  const result = await client.query(
    `SELECT * FROM refresh_tokens
     WHERE token = $1 AND expires_at > NOW()`,
    [tokenHash]
  );

  return result.rows[0] || null;
};


// REGISTER

/**
  registers a new user and immediately authenticates them
  
  steps:
  1. validate email uniqueness
  2. hash password
  3. create user record
  4. auto-create primary profile
  5. generate access + refresh tokens
  6. hash and store refresh token
  7. return standardized auth response

  all db operations run inside a single transaction so if any step fails, nothing is partially committed.
*/
const registerUser = async (name, email, password) => {
  // transaction - user and profile must be created atomically
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. check email already exists
    const existingUser = await client.query(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      const error = new Error("An account with this email already exists.");
      error.status = 409;
      throw error;
    }

    // 2. hash pass
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. create user
    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const user = userResult.rows[0];

    // 4. auto create primary profile
    const profileResult = await client.query(
      `INSERT INTO profiles (owner_user_id, name, relationship, is_primary)
       VALUES ($1, $2, 'self', TRUE)
       RETURNING *`,
      [user.id, user.name]
    );

    const profile = profileResult.rows[0];

    // 5. generate auth tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = getRefreshTokenExpiry();

    // 6. store hashed refresh token
    await storeRefreshToken(client, user.id, tokenHash, expiresAt);

    await client.query("COMMIT");

    logger.info("User registered successfully", { userId: user.id });

    // 7. return standard auth response
    return buildAuthResponse({
      message: "User registration successful",
      user,
      profile,
      accessToken,
      refreshToken
    });

  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Registration failed", { error: err.message });
    throw err;
  } finally {
    client.release();
  }
};


// LOGIN

/**
   authenticates an existing user
 
   steps:
   1. find user by email
   2. compare password
   3. fetch primary profile
   4. generate new access + refresh tokens
   5. rotate refresh token (clean expired and store new)
   6. return standardized auth response
 
  security: email not found and wrong password return identical error messages to prevent email enumeration attacks.
*/
const loginUser = async (email, password) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. fetch user
    const userResult = await client.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // 2. validate credentials
    // preventing timing attacks
    const user = userResult.rows[0];
    const dummyHash = "$2b$12$invalidhashfortimingnormalisation";
    const isPasswordValid = await bcrypt.compare(
      password,
      user ? user.password_hash : dummyHash
    );

    if (!user || !isPasswordValid) {
      const error = new Error("Invalid email or password.");
      error.status = 401;
      throw error;
    }

    // 3. Fetch primary profile
    const profileResult = await client.query(
      `SELECT * FROM profiles
       WHERE owner_user_id = $1 AND is_primary = TRUE
       LIMIT 1`,
      [user.id]
    );

    const profile = profileResult.rows[0];

    if (!profile) {
      logger.error("Primary profile not found for user", { userId: user.id });
      const error = new Error("User profile not found. Please contact support.");
      error.status = 500;
      throw error;
    }

    // 4. generate new tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const expiresAt = getRefreshTokenExpiry();

    // 5. rotate refresh token
    await rotateRefreshToken(client, user.id, tokenHash, expiresAt);

    await client.query("COMMIT");

    logger.info("User logged in successfully", { userId: user.id });

    // remove password_hash from user object before returning
    const { password_hash, ...safeUser } = user;

    // 6. return standard auth response
    return buildAuthResponse({
      message: "Login successful",
      user: safeUser,
      profile,
      accessToken,
      refreshToken
    });

  } catch (err) {
    await client.query("ROLLBACK");

    // don't log 401s as errors — they are expected
    if (err.status !== 401) {
      logger.error("Login failed", { error: err.message });
    }

    throw err;
  } finally {
    client.release();
  }
};


// REFRESH

/**
  issues a new access token using a valid refresh token
  old token is deleted, new token is issued
*/
const refreshAccessToken = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    const error = new Error("Refresh token is required.");
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // validate existing token

    const tokenRecord = await validateRefreshToken(rawRefreshToken, client);

    if (!tokenRecord) {
      const error = new Error("Invalid or expired refresh token.");
      error.status = 401;
      throw error;
    }

    const userId = tokenRecord.user_id;

    // fetch user
    const userResult = await client.query(
      `SELECT id, name, email 
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      logger.error("User not found", { userId });
      const error = new Error("User not found.");
      error.status = 404;
      throw error;
    }

    // generate new tokens
    const newAccessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);
    const expiresAt = getRefreshTokenExpiry();

    // rotate refresh token
    await deleteRefreshToken(hashRefreshToken(rawRefreshToken), client);

    await rotateRefreshToken(client, user.id, newTokenHash, expiresAt);

    await client.query("COMMIT");

    logger.info("Access token refreshed", { userId });

    return buildAuthResponse({
      message: "Access token refreshed successfully",
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user
    });

  } catch (err) {
    await client.query("ROLLBACK");
    if (err.status !== 401) {
      logger.error("Token refresh failed", {
        error: err.message,
        stack: err.stack,
        status: err.status
      });
    }
    throw err;
  } finally {
    client.release();
  }
};


// LOGOUT

/**
  invalidates the user's refresh token
  after logout, refresh token cannot be used to obtain new access tokens
*/
const logoutUser = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    const error = new Error("Refresh token is required.");
    error.status = 400;
    throw error;
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  await deleteRefreshToken(tokenHash);

  logger.info("User logged out successfully");

  return {
    success: true,
    message: "Logged out successfully"
  }
};


// ONBOARDING

/**
  updates the user's primary profile with onboarding data
  also stores initial weight as the first vitals entry if provided
  uses a transaction to ensure profile + vitals are updated atomically
*/
const completeOnboarding = async (userId, profileId, data) => {
  const { date_of_birth, gender, blood_group, height_cm, weight, allergies } = data;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // update primary profile
    const profileResult = await client.query(
      `UPDATE profiles
       SET
         date_of_birth = COALESCE($1, date_of_birth),
         gender = COALESCE($2, gender),
         blood_group = COALESCE($3, blood_group),
         height_cm = COALESCE($4, height_cm),
         allergies = COALESCE($5, allergies),
         is_onboarding_complete = TRUE
       WHERE id = $6 AND owner_user_id = $7
       RETURNING *`,
      [
        date_of_birth || null,
        gender || null,
        blood_group || null,
        height_cm || null,
        Array.isArray(allergies) ? allergies : null,
        profileId,
        userId,
      ]
    );

    if (profileResult.rows.length === 0) {
      const error = new Error("Profile not found.");
      error.status = 404;
      throw error;
    }

    // if weight provided, store as first vitals entry
    if (weight) {
      await client.query(
        `INSERT INTO vitals (user_id, profile_id, type, value_primary, unit, timing_context)
         VALUES ($1, $2, 'weight', $3, 'kg', 'onboarding')`,
        [userId, profileId, weight]
      );
    }

    await client.query("COMMIT");

    logger.info("Onboarding completed", { userId, profileId });

    return {
      success: true,
      message: "Onboarding completed successfully.",
      data: {
        profile: profileResult.rows[0],
      },
    };

  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Onboarding failed", { error: err.message });
    throw err;
  } finally {
    client.release();
  }
};


// GET CURRENT USER

/**
  returns the current user and their primary profile.
  used by GET /auth/me.
*/
const getCurrentUser = async (userId) => {
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
       p.height,
       p.abha_number,
       p.abha_address,
       p.abha_linked
     FROM users u
     LEFT JOIN profiles p
       ON p.owner_user_id = u.id AND p.is_primary = TRUE
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }

  const row = result.rows[0];

  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at,
    },
    profile: {
      id: row.profile_id,
      name: row.profile_name,
      relationship: row.relationship,
      is_primary: row.is_primary,
      gender: row.gender,
      date_of_birth: row.date_of_birth,
      blood_group: row.blood_group,
      height: row.height,
      abha_number: row.abha_number,
      abha_address: row.abha_address,
      abha_linked: row.abha_linked,
    },
  };
};

// EXPORTS

module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  completeOnboarding,
  getCurrentUser,
  validateRefreshToken,
  deleteRefreshToken,
};