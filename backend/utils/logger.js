const winston = require("winston");

// ─────────────────────────────────────────────────────────────
// Winston Logger Configuration
// ─────────────────────────────────────────────────────────────

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: "meeting-scheduler-backend" },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    // Write all logs with level `info` and below to `combined.log`
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// If we're not in production then log to the `console` with formatted output
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
} else {
  // In production, also log to console in JSON format for log aggregators (Render/Railway/Datadog)
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

module.exports = logger;
