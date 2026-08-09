require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { testConnection } = require("./config/db");
const logger = require("./config/logger.js");

const auditLog = require("./middlewares/auditLog.middleware.js");

const app = express();

// trust proxy (required for Render / reverse proxies with express-rate-limit)
app.set("trust proxy", 1);

// middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(auditLog);

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const authRoutes = require("./routes/auth.route.js");
const abhaRoutes =
  process.env.ABHA_MODE === "mock"
    ? require("./mockABHA/mockAbha.route.js")
    : require("./routes/abha.route.js");
const recordRoutes = require("./routes/record.route.js");
const carePlanRoutes = require("./routes/carePlan.route.js");
const vitalsRoutes = require("./routes/vitals.route.js");
const labParameterRoutes = require("./routes/labParameter.route.js");
const medicationRoutes = require("./routes/medication.route.js");
const reminderRoutes = require("./routes/reminder.route.js");
const chatRoutes = require("./routes/chat.route.js");
const caregiverRoutes = require("./routes/caregiver.route.js");
const profileRoutes = require("./routes/profile.route.js");
const emergencyCardRoutes = require("./routes/emergencyCard.route.js");

// routes 
app.use("/api/auth", authRoutes);
app.use("/api/abha", abhaRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/care-plans", carePlanRoutes);
app.use("/api/metrics", vitalsRoutes);
app.use("/api/vitals", vitalsRoutes);
app.use("/api/lab-parameters", labParameterRoutes);
app.use("/api/lab-results", labParameterRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/emergency-card", emergencyCardRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message || err);
  const statusCode = typeof err.status === "number" ? err.status : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "An unexpected error occurred",
    ...(process.env.NODE_ENV === "production" ? {} : { stack: err.stack }),
  });
});

const { checkAceAvailability } = require("./utils/aceClient.js");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await testConnection();  // ensure DB is alive first
  await checkAceAvailability(); // ACE service health ping

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

// process safety handlers to prevent unhandled errors from crashing the server
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Promise Rejection", { reason: reason?.stack || reason });
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { error: err?.stack || err });
});

startServer().catch((err) => {
  logger.error("Failed to start server:", { error: err.stack });
  process.exit(1);
});