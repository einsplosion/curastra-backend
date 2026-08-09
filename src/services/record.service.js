const { pool } = require("../config/db");
const cloudinary = require("../config/cloudinary");
const aceService = require("./ace.service.js");
const logger = require("../config/logger.js");


// uploads a file to cloudinary
const uploadToCloudinary = (file, userId) => {
  return new Promise((resolve, reject) => {
    const isPdf = file.originalname.toLowerCase().endsWith(".pdf");
    const options = {
      folder: `curastra/${userId}`,
      resource_type: isPdf ? "raw" : "auto",
      type: "upload",
      access_mode: "public",
    };

    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });
};


// creates a new record
const createRecord = async (userId, profileId, file, type, notes) => {
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
    `INSERT INTO records (user_id, profile_id, type, file_name, file_url, file_public_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      profileId || null,
      type,
      file.originalname,
      uploadResult.secure_url,
      uploadResult.public_id,
      notes || null,
    ]
  );

  return result.rows[0];
};


// gets all records for a user
const getUserRecords = async (userId, profileId, type) => {
  let query = `
    SELECT id, profile_id, type, file_name, file_url, notes, extracted_text, ocr_used, uploaded_at
    FROM records
    WHERE user_id = $1
  `;
  const params = [userId];

  if (profileId) {
    query += ` AND profile_id = $${params.length + 1}`;
    params.push(profileId);
  }

  if (type) {
    query += ` AND type = $${params.length + 1}`;
    params.push(type);
  }

  query += ` ORDER BY uploaded_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};


// gets a record by ID
const getRecordById = async (userId, recordId) => {
  const result = await pool.query(
    `SELECT id, profile_id, type, file_name, file_url, file_public_id, notes, extracted_text, ocr_used, uploaded_at
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


// triggers ACE text extraction & PII scrubbing for an uploaded record 
const extractRecordText = async (userId, recordId) => {
  const record = await getRecordById(userId, recordId);

  // call ACE extract/url endpoint
  const extractionResult = await aceService.extractTextFromUrl(record.file_url, record.file_name);

  const extractedText = extractionResult.extracted_text || "";
  const ocrUsed = Boolean(extractionResult.ocr_used);

  // save extracted_text and ocr_used in records table
  await pool.query(
    `UPDATE records SET extracted_text = $1, ocr_used = $2 WHERE id = $3 AND user_id = $4`,
    [extractedText, ocrUsed, recordId, userId]
  );

  return {
    record_id: recordId,
    file_name: record.file_name,
    extracted_text: extractedText,
    ocr_used: ocrUsed,
    low_confidence: Boolean(extractionResult.low_confidence),
    warnings: extractionResult.warnings || [],
  };
};


// deletes a record by ID
const deleteRecord = async (userId, recordId) => {
  const record = await getRecordById(userId, recordId);

  const isPdf = record.file_name.toLowerCase().endsWith(".pdf");
  const resourceType = isPdf ? "raw" : "image";

  try {
    await cloudinary.uploader.destroy(record.file_public_id, {
      resource_type: resourceType,
    });
  } catch (cErr) {
    logger.warn("Cloudinary record delete warning", { error: cErr.message });
  }

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
  extractRecordText,
  deleteRecord,
};