const { pool } = require("../config/db");
const logger = require("../config/logger");


// invites a caregiver by email for a patient profile
const inviteCaregiver = async (userId, profileId, data) => {
  const { email, permissions } = data;

  // verify profile belongs to authenticated user
  const profileCheck = await pool.query(
    `SELECT id, name FROM profiles WHERE id = $1 AND owner_user_id = $2 AND (is_archived = FALSE OR is_archived IS NULL)`,
    [profileId, userId]
  );

  if (profileCheck.rows.length === 0) {
    const error = new Error("Patient profile not found or access denied");
    error.status = 404;
    throw error;
  }

  // look up caregiver user by email
  const userCheck = await pool.query(
    `SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );

  if (userCheck.rows.length === 0) {
    const error = new Error(`User with email "${email}" is not registered on Curastra.`);
    error.status = 404;
    throw error;
  }

  const caregiverUser = userCheck.rows[0];

  // prevent self-invitation
  if (caregiverUser.id === userId) {
    const error = new Error("You cannot add yourself as a caregiver for your own profile.");
    error.status = 400;
    throw error;
  }

  // merge default permissions
  const finalPermissions = {
    view_records: permissions?.view_records ?? true,
    add_records: permissions?.add_records ?? false,
    view_care_plans: permissions?.view_care_plans ?? true,
    manage_reminders: permissions?.manage_reminders ?? false,
  };

  // check if invitation already exists
  const existingCheck = await pool.query(
    `SELECT * FROM caregiver_access WHERE profile_id = $1 AND caregiver_user_id = $2`,
    [profileId, caregiverUser.id]
  );

  let accessRecord;

  if (existingCheck.rows.length > 0) {
    const existing = existingCheck.rows[0];
    if (existing.status === "active") {
      const error = new Error("This user is already an active caregiver for this profile.");
      error.status = 400;
      throw error;
    }
    if (existing.status === "pending") {
      const error = new Error("An invitation is already pending for this caregiver.");
      error.status = 400;
      throw error;
    }

    // reactivate revoked invitation
    const updateRes = await pool.query(
      `UPDATE caregiver_access
       SET status = 'pending', permissions = $1, invited_at = NOW(), accepted_at = NULL
       WHERE id = $2
       RETURNING *`,
      [finalPermissions, existing.id]
    );
    accessRecord = updateRes.rows[0];
  } else {
    // create new invitation
    const insertRes = await pool.query(
      `INSERT INTO caregiver_access (profile_id, caregiver_user_id, permissions, status, invited_at)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING *`,
      [profileId, caregiverUser.id, finalPermissions]
    );
    accessRecord = insertRes.rows[0];
  }

  return {
    ...accessRecord,
    caregiver_name: caregiverUser.name,
    caregiver_email: caregiverUser.email,
  };
};


// gets all caregivers invited/active for a patient profile
const getCaregiversForProfile = async (userId, profileId) => {
  const profileCheck = await pool.query(
    `SELECT id FROM profiles WHERE id = $1 AND owner_user_id = $2 AND (is_archived = FALSE OR is_archived IS NULL)`,
    [profileId, userId]
  );

  if (profileCheck.rows.length === 0) {
    const error = new Error("Patient profile not found or access denied");
    error.status = 404;
    throw error;
  }

  const result = await pool.query(
    `SELECT 
       ca.id,
       ca.profile_id,
       ca.caregiver_user_id,
       ca.permissions,
       ca.status,
       ca.invited_at,
       ca.accepted_at,
       u.name AS caregiver_name,
       u.email AS caregiver_email
     FROM caregiver_access ca
     JOIN users u ON ca.caregiver_user_id = u.id
     WHERE ca.profile_id = $1
     ORDER BY ca.invited_at DESC`,
    [profileId]
  );

  return result.rows;
};


// patient updates permissions for a caregiver
const updateCaregiverPermissions = async (userId, profileId, accessId, newPermissions) => {
  const checkRes = await pool.query(
    `SELECT ca.* 
     FROM caregiver_access ca
     JOIN profiles p ON ca.profile_id = p.id
     WHERE ca.id = $1 AND p.id = $2 AND p.owner_user_id = $3`,
    [accessId, profileId, userId]
  );

  if (checkRes.rows.length === 0) {
    const error = new Error("Caregiver access record not found or access denied");
    error.status = 404;
    throw error;
  }

  const currentAccess = checkRes.rows[0];
  const mergedPermissions = {
    ...currentAccess.permissions,
    ...newPermissions,
  };

  const result = await pool.query(
    `UPDATE caregiver_access
     SET permissions = $1
     WHERE id = $2
     RETURNING *`,
    [mergedPermissions, accessId]
  );

  return result.rows[0];
};


// caregiver accepts pending invitation
const acceptCaregiverInvitation = async (caregiverUserId, accessId) => {
  const checkRes = await pool.query(
    `SELECT ca.*, p.name AS patient_name
     FROM caregiver_access ca
     JOIN profiles p ON ca.profile_id = p.id
     WHERE ca.id = $1 AND ca.caregiver_user_id = $2`,
    [accessId, caregiverUserId]
  );

  if (checkRes.rows.length === 0) {
    const error = new Error("Caregiver invitation not found");
    error.status = 404;
    throw error;
  }

  const record = checkRes.rows[0];
  if (record.status !== "pending") {
    const error = new Error(`Invitation cannot be accepted because status is "${record.status}".`);
    error.status = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE caregiver_access
     SET status = 'active', accepted_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [accessId]
  );

  return {
    ...result.rows[0],
    patient_name: record.patient_name,
  };
};


// caregiver declines pending invitation
const declineCaregiverInvitation = async (caregiverUserId, accessId) => {
  const checkRes = await pool.query(
    `SELECT ca.* FROM caregiver_access ca WHERE ca.id = $1 AND ca.caregiver_user_id = $2`,
    [accessId, caregiverUserId]
  );

  if (checkRes.rows.length === 0) {
    const error = new Error("Caregiver invitation not found");
    error.status = 404;
    throw error;
  }

  const result = await pool.query(
    `UPDATE caregiver_access SET status = 'revoked' WHERE id = $1 RETURNING *`,
    [accessId]
  );

  return result.rows[0];
};


// patient revokes / deletes caregiver access
const revokeCaregiverAccess = async (userId, profileId, accessId) => {
  const checkRes = await pool.query(
    `SELECT ca.id 
     FROM caregiver_access ca
     JOIN profiles p ON ca.profile_id = p.id
     WHERE ca.id = $1 AND p.id = $2 AND p.owner_user_id = $3`,
    [accessId, profileId, userId]
  );

  if (checkRes.rows.length === 0) {
    const error = new Error("Caregiver access record not found or access denied");
    error.status = 404;
    throw error;
  }

  await pool.query(`DELETE FROM caregiver_access WHERE id = $1`, [accessId]);
  return { message: "Caregiver access revoked successfully", id: accessId };
};


// caregiver lists all patients who gave them active access
const getMyPatients = async (caregiverUserId) => {
  const result = await pool.query(
    `SELECT 
       ca.id AS access_id,
       ca.permissions,
       ca.status,
       ca.invited_at,
       ca.accepted_at,
       p.id AS profile_id,
       p.name AS patient_name,
       p.relationship,
       p.gender,
       p.date_of_birth,
       p.blood_group,
       p.height_cm,
       p.abha_linked,
       EXTRACT(YEAR FROM AGE(p.date_of_birth)) AS age,
       u.name AS owner_name,
       u.email AS owner_email
     FROM caregiver_access ca
     JOIN profiles p ON ca.profile_id = p.id
     JOIN users u ON p.owner_user_id = u.id
     WHERE ca.caregiver_user_id = $1 AND ca.status = 'active' AND (p.is_archived = FALSE OR p.is_archived IS NULL)
     ORDER BY ca.accepted_at DESC`,
    [caregiverUserId]
  );

  return result.rows;
};


// caregiver views patient's overview data based on granted permissions
const getPatientOverviewForCaregiver = async (caregiverUserId, targetProfileId) => {
  const accessCheck = await pool.query(
    `SELECT ca.*, p.name AS patient_name, p.owner_user_id
     FROM caregiver_access ca
     JOIN profiles p ON ca.profile_id = p.id
     WHERE ca.caregiver_user_id = $1 AND ca.profile_id = $2 AND ca.status = 'active' AND (p.is_archived = FALSE OR p.is_archived IS NULL)`,
    [caregiverUserId, targetProfileId]
  );

  if (accessCheck.rows.length === 0) {
    const error = new Error("You do not have active caregiver access for this patient profile.");
    error.status = 403;
    throw error;
  }

  const access = accessCheck.rows[0];
  const permissions = access.permissions || {};
  const patientUserId = access.owner_user_id;

  const data = {
    patient: {
      profile_id: targetProfileId,
      name: access.patient_name,
      permissions,
    },
  };

  // records if view_records is enabled
  if (permissions.view_records) {
    const recRes = await pool.query(
      `SELECT id, type, file_name, file_url, notes, uploaded_at
       FROM records
       WHERE user_id = $1 AND (profile_id = $2 OR profile_id IS NULL)
       ORDER BY uploaded_at DESC LIMIT 10`,
      [patientUserId, targetProfileId]
    );
    data.records = recRes.rows;
  }

  // active care plan if view_care_plans is enabled
  if (permissions.view_care_plans) {
    const cpRes = await pool.query(
      `SELECT id, summary, start_date, end_date, progress_percentage, status
       FROM care_plans
       WHERE user_id = $1 AND (profile_id = $2 OR profile_id IS NULL) AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [patientUserId, targetProfileId]
    );
    data.active_care_plan = cpRes.rows[0] || null;
  }

  // reminders if manage_reminders or view_care_plans is enabled
  if (permissions.manage_reminders || permissions.view_care_plans) {
    const remRes = await pool.query(
      `SELECT r.id, r.title, r.type, r.scheduled_time, r.is_active, m.name AS medication_name
       FROM reminders r
       LEFT JOIN medications m ON r.medication_id = m.id
       WHERE r.user_id = $1 AND (r.profile_id = $2 OR r.profile_id IS NULL)
       ORDER BY r.scheduled_time ASC`,
      [patientUserId, targetProfileId]
    );
    data.reminders = remRes.rows;
  }

  // latest vitals summary
  const vitalsRes = await pool.query(
    `SELECT DISTINCT ON (type) type, value_primary, value_secondary, unit, recorded_at
     FROM vitals
     WHERE user_id = $1 AND (profile_id = $2 OR profile_id IS NULL)
     ORDER BY type, recorded_at DESC`,
    [patientUserId, targetProfileId]
  );
  data.vitals = vitalsRes.rows;

  return data;
};

module.exports = {
  inviteCaregiver,
  getCaregiversForProfile,
  updateCaregiverPermissions,
  acceptCaregiverInvitation,
  declineCaregiverInvitation,
  revokeCaregiverAccess,
  getMyPatients,
  getPatientOverviewForCaregiver,
};
