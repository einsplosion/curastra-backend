const { aceClient } = require("../utils/aceClient.js");
const logger = require("../config/logger.js");


// extracts text from a document stored on Cloudinary via ACE service
const extractTextFromUrl = async (fileUrl, fileName) => {
  try {
    const response = await aceClient.post("/v1/extract/url", {
      file_url: fileUrl,
      file_name: fileName,
    });
    return response.data;
  } catch (err) {
    logger.error("ACE extractTextFromUrl failed", { error: err.message, fileUrl });
    throw err;
  }
};


// generates a care plan from verified text via ACE service
const generateCarePlan = async (verifiedText, fileName, userNotes) => {
  try {
    const response = await aceClient.post("/v1/generate", {
      file_name: fileName || "prescription.pdf",
      verified_text: verifiedText,
      user_notes: userNotes || null,
    });
    return response.data;
  } catch (err) {
    logger.error("ACE generateCarePlan failed", { error: err.message });
    throw err;
  }
};


// analyzes lab report text via ACE service
const analyzeLabReport = async (verifiedText) => {
  try {
    const response = await aceClient.post("/v1/lab-analyze", {
      verified_text: verifiedText,
    });
    return response.data;
  } catch (err) {
    logger.error("ACE analyzeLabReport failed", { error: err.message });
    throw err;
  }
};

// analyzes cross-medication safety alerts via ACE service
const checkMedicationSafety = async (medications) => {
  try {
    const formattedMeds = medications.map((m) => ({
      name: m.name,
      dosage: m.dosage || null,
      frequency: m.frequency || null,
    }));
    const response = await aceClient.post("/v1/med-safety", {
      medications: formattedMeds,
    });
    return response.data;
  } catch (err) {
    logger.error("ACE checkMedicationSafety failed", { error: err.message });
    // safe fallback if ACE is down
    return {
      alerts: [],
      disclaimer: "Safety check service unavailable. Consult a healthcare professional.",
      simulated: true,
    };
  }
};

// simplifies clinical instructions via ACE service
const simplifyInstruction = async (text) => {
  try {
    const response = await aceClient.post("/v1/simplify", { text });
    return response.data;
  } catch (err) {
    logger.error("ACE simplifyInstruction failed", { error: err.message });
    throw err;
  }
};

// calls ACE chatbot endpoint /v1/chat
const chat = async (message, context = {}, history = [], systemPrompt = null) => {
  try {
    const response = await aceClient.post("/v1/chat", {
      message,
      context,
      history,
      system_prompt: systemPrompt,
    });
    return response.data;
  } catch (err) {
    logger.error("ACE chat failed", { error: err.message });
    throw err;
  }
};

module.exports = {
  extractTextFromUrl,
  generateCarePlan,
  analyzeLabReport,
  checkMedicationSafety,
  simplifyInstruction,
  chat,
};
