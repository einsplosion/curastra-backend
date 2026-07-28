const crypto = require("crypto");
const logger = require("../config/logger.js");

// list of sensitive keys that must be sanitized from request parameters, bodies, and headers before audit logging
const SENSITIVE_KEYS = new Set([
  "password",
  "confirmpassword",
  "oldpassword",
  "newpassword",

  "otp",
  "aadhaarnumber",
  "pin",

  "token",
  "accesstoken",
  "refreshtoken",

  "authorization",
  "x-internal-key",
  "secret",
  "apikey",
  "api_key",

  "clientsecret",
  "clientid"
]);


// auditable actions mapping endpoint patterns to action names
const AUDITABLE_ACTIONS = {
  "POST /auth/register": "USER_REGISTERED",
  "POST /api/auth/register": "USER_REGISTERED",

  "POST /auth/login": "USER_LOGIN",
  "POST /api/auth/login": "USER_LOGIN",

  "POST /auth/logout": "USER_LOGOUT",
  "POST /api/auth/logout": "USER_LOGOUT",

  "POST /auth/refresh": "TOKEN_REFRESHED",
  "POST /api/auth/refresh": "TOKEN_REFRESHED",

  "PATCH /auth/onboarding": "ONBOARDING_COMPLETED",
  "PATCH /api/auth/onboarding": "ONBOARDING_COMPLETED",

  "POST /abha/enroll/initiate": "ABHA_ENROLL_INITIATED",
  "POST /api/abha/enroll/initiate": "ABHA_ENROLL_INITIATED",

  "POST /abha/enroll/verify": "ABHA_ENROLL_VERIFIED",
  "POST /api/abha/enroll/verify": "ABHA_ENROLL_VERIFIED",

  "POST /records/upload": "RECORD_UPLOADED",
  "POST /api/records/upload": "RECORD_UPLOADED",

  "PUT /records/:recordId": "RECORD_UPDATED",
  "PUT /api/records/:recordId": "RECORD_UPDATED",

  "PATCH /records/:recordId": "RECORD_UPDATED",
  "PATCH /api/records/:recordId": "RECORD_UPDATED",

  "DELETE /records/:recordId": "RECORD_DELETED",
  "DELETE /api/records/:recordId": "RECORD_DELETED",
};


// recursive function to sanitize payloads (params, query, body)
const sanitizePayload = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};


// helper to determine auditable action name for a given request.
// excludes GET endpoints and non-auditable routes.
const getAuditAction = (req) => {
  if (req.method === "GET") return null;

  // 1. construct route path template using Express req.baseUrl & req.route.path if available
  const routePath = req.baseUrl && req.route?.path
    ? `${req.baseUrl}${req.route.path}`
    : (req.originalUrl || req.url).split("?")[0];

  const methodPath = `${req.method} ${routePath}`;

  if (AUDITABLE_ACTIONS[methodPath]) {
    return AUDITABLE_ACTIONS[methodPath];
  }

  // normalize /api prefix variations
  const pathWithoutApi = routePath.startsWith("/api") ? routePath.substring(4) : routePath;
  const pathWithApi = routePath.startsWith("/api") ? routePath : `/api${routePath}`;

  if (AUDITABLE_ACTIONS[`${req.method} ${pathWithoutApi}`]) {
    return AUDITABLE_ACTIONS[`${req.method} ${pathWithoutApi}`];
  }
  if (AUDITABLE_ACTIONS[`${req.method} ${pathWithApi}`]) {
    return AUDITABLE_ACTIONS[`${req.method} ${pathWithApi}`];
  }

  // fallback: pattern matching for parameterized endpoints (e.g. /records/:recordId)
  for (const [key, action] of Object.entries(AUDITABLE_ACTIONS)) {
    const [actionMethod, actionPath] = key.split(" ");
    if (actionMethod !== req.method) continue;

    const regexPattern = "^" + actionPath.replace(/:[a-zA-Z0-9_]+/g, "[^/]+") + "$";
    const regex = new RegExp(regexPattern);
    if (regex.test(routePath) || regex.test(pathWithoutApi) || regex.test(pathWithApi)) {
      return action;
    }
  }

  return null;
};


// audit logging middleware
const auditLog = (req, res, next) => {
  try {
    // 1. assign or preserve correlation Request ID
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req.id = requestId;
    res.setHeader("X-Request-ID", requestId);

    const startHrTime = process.hrtime();
    const startTime = Date.now();

    // 2. intercept response finish event safely
    res.on("finish", () => {
      try {
        const action = getAuditAction(req);
        // only log auditable actions (excludes GET endpoints & non-auditable routes)
        if (!action) return;

        const diff = process.hrtime(startHrTime);
        const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6 * 100) / 100;
        const statusCode = res.statusCode;
        const success = statusCode >= 200 && statusCode < 400;

        // 3. build standardized audit record
        const auditRecord = {
          isAudit: true,
          requestId,
          action,
          timestamp: new Date(startTime).toISOString(),
          user: {
            userId: req.user?.id || null,
            profileId: req.profile?.id || null,
          },
          request: {
            method: req.method,
            path: req.originalUrl || req.url,
            ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
            userAgent: req.headers["user-agent"] || null,
            params: sanitizePayload(req.params || {}),
            query: sanitizePayload(req.query || {}),
            body: sanitizePayload(req.body || {}),
          },
          response: {
            statusCode,
            durationMs,
            success,
          },
        };

        // 4. output structured audit log
        const logMessage = `AUDIT [${action}] ${req.method} ${req.originalUrl || req.url} - ${statusCode} (${durationMs}ms)`;

        if (statusCode >= 500) {
          logger.error(logMessage, auditRecord);
        } else if (statusCode >= 400) {
          logger.warn(logMessage, auditRecord);
        } else {
          logger.info(logMessage, auditRecord);
        }
      } catch (finishErr) {
        logger.error("Error writing audit log:", { error: finishErr.message });
      }
    });
  } catch (err) {
    logger.error("Audit log middleware error:", { error: err.message });
  } finally {
    // 5. ensure request processing is never blocked
    next();
  }
};

module.exports = auditLog;
