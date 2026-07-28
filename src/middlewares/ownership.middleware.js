const { pool } = require("../config/db");
const logger = require("../config/logger");


// defines the ownership rules for each database resource type
const TABLE_CONFIG = {
  records: {
    id_column: "id",
    owner_column: "user_id",
  },
  profiles: {
    id_column: "id",
    owner_column: "owner_user_id",
  },
  care_plans: {
    id_column: "id",
    owner_column: "user_id",
  },
  care_plan_tasks: {
    id_column: "id",
    owner_column: "user_id",
  },
  medications: {
    id_column: "id",
    owner_column: "user_id",
  },
  reminders: {
    id_column: "id",
    owner_column: "user_id",
  },
  vitals: {
    id_column: "id",
    owner_column: "user_id",
  },
  lab_results: {
    id_column: "id",
    owner_column: "user_id",
  },
  symptom_logs: {
    id_column: "id",
    owner_column: "user_id",
  },
  chat_conversations: {
    id_column: "id",
    owner_column: "user_id",
  },
};


// verifies that a resource exists and belongs to the requesting user
// returns resouce row on success, throws 404 if doesnt belong to user
const verifyOwnership = async (table, resourceId, userId) => {
  const config = TABLE_CONFIG[table];

  if (!config) {
    throw new Error(`Ownership check not configured for table: ${table}`);
  }

  const result = await pool.query(
    `SELECT * FROM ${table}
     WHERE ${config.id_column} = $1
     AND ${config.owner_column} = $2`,
    [resourceId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Resource not found.");
    error.status = 404;
    throw error;
  }

  return result.rows[0];
};


// BOLA prevention middleware factory
// ensures the authenticated user (req.user.id) owns the requested resource ID in req.params
const ownership = (table, paramKey) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required before ownership verification.",
        });
      }

      // auto-detect parameter key if not explicitly passed
      const targetParamKey = paramKey || Object.keys(req.params)[0] || "id";
      const resourceId = req.params[targetParamKey];

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: `Missing required route parameter: ${targetParamKey}`,
        });
      }

      // pre-validate UUID format before querying DB
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(resourceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid resource ID format.",
        });
      }

      // verify ownership in DB — throws 404 if record doesn't exist or belong to user
      const resource = await verifyOwnership(table, resourceId, req.user.id);

      // attach retrieved resource to req.resource so controller avoids duplicate SELECT queries
      req.resource = resource;

      next();
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({
          success: false,
          message: err.message,
        });
      }

      logger.error("BOLA Ownership middleware error", {
        error: err.stack || err.message,
        table,
        paramKey,
        userId: req.user?.id,
      });

      return res.status(500).json({
        success: false,
        message: "An unexpected error occurred while verifying ownership.",
      });
    }
  };
};

module.exports = {
  ownership,
  verifyOwnership,
  TABLE_CONFIG,
};
