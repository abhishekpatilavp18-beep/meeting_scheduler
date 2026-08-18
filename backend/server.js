// ─────────────────────────────────────────────────────────────
// Express Server — Production-grade entry point
// ─────────────────────────────────────────────────────────────

const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const morgan = require("morgan");
const compression = require("compression");
const logger = require("./utils/logger");

// Load environment variables
dotenv.config();

const { connectDB, disconnectDB } = require("./config/db");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { sendSuccess, sendError } = require("./utils/apiResponse");
const {
  globalLimiter,
  requestSizeGuard,
  stripFingerprint,
  requestLogger,
} = require("./middleware/securityMiddleware");
const socketService = require("./services/socketService");
const reminderService = require("./services/reminderService");

// Route imports
const authRoutes = require("./routes/authRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const slotRoutes = require("./routes/slotRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const organizationRoutes = require("./routes/organizationRoutes");

// Swagger UI
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./config/swagger");

// ── Constants ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// CORS Origins — support comma-separated list in env
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
  : ["http://localhost:5173"];

// ── Validate critical env vars at boot ────────────────────────
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  logger.error(`💀 Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

// ── App & Server ──────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io Setup ───────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

socketService.init(io);
app.set("io", io);
app.disable("x-powered-by");

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE PIPELINE
// ─────────────────────────────────────────────────────────────

// 1. HTTP Request Logging (Morgan)
if (NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  // Combined format for production logging
  app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));
}

// 2. Security HTTP headers (Helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://meet.jit.si"],
        frameSrc: ["'self'", "https://meet.jit.si"],
        connectSrc: ["'self'", ...allowedOrigins, "wss:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 3. Compression
app.use(compression());

// 4. CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 5. Parsers & Sanitization
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp({ whitelist: ["participantIds"] }));

// 6. Request Logging & Rate Limiting
app.use(requestLogger);
app.use("/api", globalLimiter);

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

  const healthData = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: Date.now(),
    database: dbStatus[dbState] || "unknown",
  };

  if (dbState === 1) {
    sendSuccess(res, 200, "API is healthy", healthData);
  } else {
    sendError(res, 503, "API is unhealthy", "Database disconnected");
  }
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// API Version 1 Routes
const V1_PREFIX = "/api/v1";
app.use(`${V1_PREFIX}/auth`, authRoutes);
app.use(`${V1_PREFIX}/meetings`, meetingRoutes);
app.use(`${V1_PREFIX}/slots`, slotRoutes);
app.use(`${V1_PREFIX}/notifications`, notificationRoutes);
app.use(`${V1_PREFIX}/analytics`, analyticsRoutes);
app.use(`${V1_PREFIX}/organizations`, organizationRoutes);

// Fallback for legacy /api routes (optional, but good for demo transition)
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/organizations", organizationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────
// SERVER BOOTSTRAP
// ─────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);
      reminderService.start();
    });
  } catch (error) {
    logger.error("💀 Failed to start server:", error);
    process.exit(1);
  }
};

// ─────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────

const shutdown = async (signal) => {
  logger.info(`\n⏳ Received ${signal} — shutting down gracefully...`);
  server.close(async () => {
    logger.info("🔒 HTTP server closed");
    reminderService.stop();
    await disconnectDB();
    logger.info("👋 Shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("💀 Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error("❌ Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => {
  logger.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

// ── Boot ──────────────────────────────────────────────────────
if (require.main === module) {
  startServer();
}

module.exports = app;
