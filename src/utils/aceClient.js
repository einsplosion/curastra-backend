// ACTIVE CARE ENGINE = ACE

const axios = require("axios");
const logger = require("../config/logger.js");

// ENVIRONMENT CONFIG

const ACE_URL = process.env.ACE_URL || process.env.AI_ENGINE_URL || "http://localhost:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

if (!process.env.ACE_URL && !process.env.AI_ENGINE_URL) {
  logger.warn(`ACE_URL not set in environment variables. Defaulting to ${ACE_URL}`);
}

if (!process.env.INTERNAL_API_KEY) {
  logger.warn("INTERNAL_API_KEY not set in environment variables. Operating in open authentication mode for local development.");
}


// CLIENT INSTANCE

// pre-configured axios instance for all calls to ACE
const aceClient = axios.create({
  baseURL: ACE_URL,
  timeout: 60000, // ocr & llm processing can take time
  headers: {
    "X-Internal-Key": INTERNAL_API_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});


// REQUEST INTERCEPTOR

// logs outgoing HTTP requests to ACE for tracing and debugging
// omits request body to protect user pii
aceClient.interceptors.request.use(
  (config) => {
    logger.info("ACE request initiated", {
      method: config.method?.toUpperCase(),
      endpoint: config.url,
      baseURL: config.baseURL,
    });
    return config;
  },
  (error) => {
    logger.error("ACE request setup failed", {
      error: error.message,
    });
    return Promise.reject(error);
  }
);


// RESPONSE INTERCEPTOR

// handles all ACE responses and errors
// on success: logs status code and returns response object
// on failure: classifies error (TIMEOUT, SERVICE_DOWN, AUTH_FAILED, VALIDATION_ERROR, ACE_ERROR)
aceClient.interceptors.response.use(
  (response) => {
    logger.info("ACE response received", {
      endpoint: response.config.url,
      status: response.status,
    });
    return response;
  },
  (error) => {
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      error.errorType = "TIMEOUT";
      error.userMessage = "ACE processing timed out. Please try again in a moment.";

      logger.error("ACE timeout", {
        endpoint: error.config?.url,
        timeoutMs: error.config?.timeout,
      });

    } else if (!error.response) {
      error.errorType = "SERVICE_DOWN";
      error.userMessage = "ACE service is temporarily unavailable. Please try again later.";

      logger.error("ACE service unreachable", {
        endpoint: error.config?.url,
        error: error.message,
      });

    } else if (error.response.status === 401) {
      error.errorType = "AUTH_FAILED";
      error.userMessage = "ACE service authentication failed.";

      logger.error("ACE auth rejected (X-Internal-Key)", {
        endpoint: error.config?.url,
        status: error.response.status,
      });

    } else if (error.response.status === 400 || error.response.status === 422) {
      error.errorType = "VALIDATION_ERROR";
      const engineError = error.response.data?.error || "ACE service rejected the request payload format.";
      error.userMessage = engineError;

      logger.error("ACE validation/bad request error", {
        endpoint: error.config?.url,
        status: error.response.status,
        data: error.response.data,
      });

    } else if (error.response.status >= 500) {
      error.errorType = "ACE_ERROR";
      const engineError = error.response.data?.error || "ACE service encountered an internal server error.";
      error.userMessage = engineError;

      logger.error("ACE internal server error", {
        endpoint: error.config?.url,
        status: error.response.status,
        data: error.response.data,
      });

    } else {
      error.errorType = "UNKNOWN";
      error.userMessage = "An unexpected error occurred with the ACE service.";

      logger.error("ACE unexpected error", {
        endpoint: error.config?.url,
        status: error.response?.status,
        error: error.message,
      });
    }

    return Promise.reject(error);
  }
);


// AVAILABILITY HEALTH CHECK

// non-blocking health check ping to ACE /health endpoint on startup
const checkAceAvailability = async () => {
  try {
    const res = await aceClient.get("/health", { timeout: 5000 });
    logger.info("ACE service is reachable", {
      service: res.data?.service || "active-care-engine",
      version: res.data?.version || "unknown",
    });
    return true;
  } catch (err) {
    logger.warn(
      `ACE service is not reachable at startup (${ACE_URL}), ` +
      "fallback responses will be used until it comes online."
    );
    return false;
  }
};

module.exports = {
  aceClient,
  checkAceAvailability,
};
