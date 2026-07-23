const { Pool } = require("pg");
const logger = require("./logger.js");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err) => {
  logger.error("Unexpected database error", { error: err.message })
  process.exit(1);
});

const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info("Database connected")
    client.release();
  } catch (err) {
    logger.error("Database connection failed", { error: err.message })
    process.exit(1);
  }
};

module.exports = { pool, testConnection };