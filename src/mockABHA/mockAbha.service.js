const { pool } = require("../config/db.js");
const logger = require("../config/logger.js");


// resolves target profile & verifies ownership
const resolveAndVerifyProfile = async (userId, targetProfileId = null, client = pool) => {
  let query, params;
  if (targetProfileId) {
    query = `SELECT id, name, relationship, is_primary, abha_number, abha_address, abha_linked
             FROM profiles WHERE id = $1 AND owner_user_id = $2`;
    params = [targetProfileId, userId];
  } else {
    query = `SELECT id, name, relationship, is_primary, abha_number, abha_address, abha_linked
             FROM profiles WHERE owner_user_id = $1 AND is_primary = TRUE`;
    params = [userId];
  }
  const result = await client.query(query, params);
  if (result.rows.length === 0) {
    const error = new Error("Target profile not found or access denied.");
    error.status = 404;
    throw error;
  }
  return result.rows[0];
};

// single-step instant linking for production mock mode
const mockInstantLink = async (userId, aadhaarNumber, targetProfileId) => {
if (!aadhaarNumber || aadhaarNumber.length !== 12) {
    const error = new Error("Valid 12-digit Aadhaar number is required");
    error.status = 400;
    throw error;
  }

  const profile = await resolveAndVerifyProfile(userId, targetProfileId);

  if (profile.abha_linked) {
    const error = new Error("This profile is already linked to an ABHA number.");
    error.status = 409;
    throw error;
  }

  //  generate realistic mock ABHA details
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const abhaNumber = `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`;
  const sanitizedName = profile.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const abhaAddress = `${sanitizedName}${randomSuffix}@sbx`;

  // update profile in PostgreSQL DB
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateResult = await client.query(
      `UPDATE profiles
       SET abha_number = $1, abha_address = $2, abha_linked = TRUE
       WHERE id = $3 AND owner_user_id = $4
       RETURNING id, owner_user_id, name, relationship, is_primary, abha_number, abha_address, abha_linked`,
      [abhaNumber, abhaAddress, profile.id, userId]
    );

    await client.query("COMMIT");

    logger.info(`[MOCK ABHA] Profile ${profile.id} instantly linked with ABHA: ${abhaNumber}`);

    return {
      abhaNumber,
      abhaAddress,
      isNew: true,
      name: profile.name,
      profile: updateResult.rows[0],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { mockInstantLink };
