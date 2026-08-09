const { pool } = require("../config/db");
const logger = require("../config/logger");
const vitalsService = require("./vitals.service");


// gets all family member profiles created by the user
const getUserProfiles = async (userId) => {
  const result = await pool.query(
    `SELECT 
       p.id,
       p.owner_user_id,
       p.name,
       p.relationship,
       p.gender,
       p.date_of_birth,
       p.blood_group,
       p.height_cm,
       p.allergies,
       p.abha_number,
       p.abha_address,
       p.abha_linked,
       p.is_primary,
       p.is_archived,
       p.is_onboarding_complete,
       p.created_at,
       EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
     FROM profiles p
     WHERE p.owner_user_id = $1 AND (p.is_archived = FALSE OR p.is_archived IS NULL)
     ORDER BY p.is_primary DESC, p.created_at ASC`,
    [userId]
  );

  return result.rows;
};


// gets specific profile by ID with permission check
const getProfileById = async (userId, profileId) => {
  const result = await pool.query(
    `SELECT 
       p.id,
       p.owner_user_id,
       p.name,
       p.relationship,
       p.gender,
       p.date_of_birth,
       p.blood_group,
       p.height_cm,
       p.allergies,
       p.abha_number,
       p.abha_address,
       p.abha_linked,
       p.is_primary,
       p.is_archived,
       p.is_onboarding_complete,
       p.created_at,
       EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age
     FROM profiles p
     WHERE p.id = $1 AND (p.owner_user_id = $2 OR p.id IN (
       SELECT profile_id FROM caregiver_access WHERE caregiver_user_id = $2 AND status = 'active'
     )) AND (p.is_archived = FALSE OR p.is_archived IS NULL)`,
    [profileId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Profile not found or access denied");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
};


// creates a new family member profile
const createFamilyProfile = async (userId, data) => {
  const {
    name,
    relationship,
    gender,
    date_of_birth,
    blood_group,
    height_cm,
    weight,
    allergies,
  } = data;

  if (relationship === "self") {
    // check if user already has a primary self profile
    const existingSelf = await pool.query(
      `SELECT id FROM profiles WHERE owner_user_id = $1 AND is_primary = TRUE AND (is_archived = FALSE OR is_archived IS NULL)`,
      [userId]
    );
    if (existingSelf.rows.length > 0) {
      const error = new Error("You already have a primary profile. Additional family profiles must have a relationship like spouse, parent, child, sibling, or other.");
      error.status = 400;
      throw error;
    }
  }

  const query = `
    INSERT INTO profiles 
    (owner_user_id, name, relationship, gender, date_of_birth, blood_group, height_cm, allergies, is_primary, is_onboarding_complete, is_archived)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, TRUE, FALSE)
    RETURNING *, EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
  `;

  const values = [
    userId,
    name.trim(),
    relationship,
    gender || null,
    date_of_birth || null,
    blood_group || null,
    height_cm || null,
    Array.isArray(allergies) ? allergies : [],
  ];

  let newProfile;
  try {
    const result = await pool.query(query, values);
    newProfile = result.rows[0];
  } catch (err) {
    if (err.code === "23505" || err.constraint === "unique_profile_name_per_user") {
      const error = new Error(`A profile with the name "${name.trim()}" already exists for your account.`);
      error.status = 400;
      throw error;
    }
    throw err;
  }

  // if weight provided, log initial vitals entry
  if (weight) {
    try {
      await vitalsService.createMetricReading(userId, newProfile.id, {
        type: "weight",
        value_primary: weight,
        unit: "kg",
        timing_context: "initial_profile",
        notes: "Recorded during profile creation",
      });
    } catch (err) {
      logger.warn("Failed to record weight vital for new profile, proceeding", { error: err.message });
    }
  }

  return newProfile;
};


// updates an existing profile
const updateProfile = async (userId, profileId, data) => {
  const existing = await getProfileById(userId, profileId);

  // prevent changing primary profile's owner or setting relationship != self for primary
  if (existing.is_primary && data.relationship && data.relationship !== "self") {
    const error = new Error("Primary profile relationship must remain 'self'.");
    error.status = 400;
    throw error;
  }

  const allowedFields = [
    "name",
    "relationship",
    "gender",
    "date_of_birth",
    "blood_group",
    "height_cm",
    "allergies",
    "is_onboarding_complete",
    "is_archived",
  ];

  const updates = [];
  const values = [];
  let paramIdx = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      let val = data[field];
      if (typeof val === "string" && field === "name") {
        val = val.trim();
      }
      updates.push(`${field} = $${paramIdx}`);
      values.push(val);
      paramIdx++;
    }
  }

  if (updates.length === 0) {
    const error = new Error("No valid fields provided for update");
    error.status = 400;
    throw error;
  }

  values.push(profileId, userId);
  const query = `
    UPDATE profiles
    SET ${updates.join(", ")}
    WHERE id = $${paramIdx} AND owner_user_id = $${paramIdx + 1}
    RETURNING *, EXTRACT(YEAR FROM AGE(date_of_birth)) AS age
  `;

  try {
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      const error = new Error("Profile not found or access denied");
      error.status = 404;
      throw error;
    }

    return result.rows[0];
  } catch (err) {
    if (err.code === "23505" || err.constraint === "unique_profile_name_per_user") {
      const error = new Error(`A profile with the name "${data.name?.trim()}" already exists for your account.`);
      error.status = 400;
      throw error;
    }
    throw err;
  }
};


// deletes or archives a family member profile (primary profile cannot be deleted)
const deleteProfile = async (userId, profileId) => {
  const profile = await getProfileById(userId, profileId);

  if (profile.is_primary) {
    const error = new Error("Primary user profile cannot be deleted.");
    error.status = 400;
    throw error;
  }

  await pool.query(
    `UPDATE profiles SET is_archived = TRUE WHERE id = $1 AND owner_user_id = $2`,
    [profileId, userId]
  );

  return { message: "Profile archived successfully", id: profileId };
};


// switches active profile context for the session
const switchActiveProfile = async (userId, profileId) => {
  const profile = await getProfileById(userId, profileId);

  return {
    message: `Switched active profile to ${profile.name}`,
    active_profile: profile,
  };
};

module.exports = {
  getUserProfiles,
  getProfileById,
  createFamilyProfile,
  updateProfile,
  deleteProfile,
  switchActiveProfile,
};
