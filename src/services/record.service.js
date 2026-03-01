const { pool } = require("../config/db");
const cloudinary = require("../config/cloudinary");

// Extracted as separate function — cleaner than inline Promise
const uploadToCloudinary = (file, userId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `curastra/${userId}`, // per-user folder
        resource_type: "auto",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
};

const createRecord = async (userId, file, type, notes) => {
  if (!file) {
    const error = new Error("File is required");
    error.status = 400;
    throw error;
  }
  if (!type) {
    const error = new Error("Record type is required");
    error.status = 400;
    throw error;
  }

  const uploadResult = await uploadToCloudinary(file, userId);

  const result = await pool.query(
    `INSERT INTO records (user_id, type, file_name, file_url, file_public_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      type,
      file.originalname,
      uploadResult.secure_url,
      uploadResult.public_id,
      notes || null,
    ]
  );

  return result.rows[0];
};

const getUserRecords = async (userId, type) => {
  let query = `
    SELECT id, type, file_name, file_url, notes, uploaded_at
    FROM records
    WHERE user_id = $1
  `;
  const params = [userId];

  if (type) {
    query += ` AND type = $2`;
    params.push(type);
  }

  query += ` ORDER BY uploaded_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

const getRecordById = async (userId, recordId) => {
  const result = await pool.query(
    `SELECT id, type, file_name, file_url, file_public_id, notes, uploaded_at
     FROM records
     WHERE id = $1 AND user_id = $2`,
    [recordId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Record not found");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
}; 

const deleteRecord = async (userId, recordId) => {
  // Call directly since it's in the same file
  const result = await pool.query(
    `SELECT id, type, file_name, file_url, file_public_id, notes, uploaded_at
     FROM records
     WHERE id = $1 AND user_id = $2`,
    [recordId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Record not found");
    error.status = 404;
    throw error;
  }

  const record = result.rows[0];

  // Determine resource type based on file extension
  const isPdf = record.file_name.toLowerCase().endsWith(".pdf");
  const resourceType = isPdf ? "raw" : "image";

  await cloudinary.uploader.destroy(record.file_public_id, {
    resource_type: resourceType,
  });

  await pool.query(
    `DELETE FROM records WHERE id = $1 AND user_id = $2`,
    [recordId, userId]
  );

  return { message: "Record deleted successfully" };
};

module.exports = {
  createRecord,
  getUserRecords,
  getRecordById,
  deleteRecord,
};