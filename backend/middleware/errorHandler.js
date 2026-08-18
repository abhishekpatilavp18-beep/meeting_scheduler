const logger = require("../utils/logger");

// ─────────────────────────────────────────────────────────────
// Error Handling Middleware — Production-grade
// ─────────────────────────────────────────────────────────────

/**
 * Custom API error class.
 * Throw this from controllers/services to send a clean error response.
 *
 * Usage:
 *   throw new ApiError("Not found", 404);
 */
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes known errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Wraps an async route handler to automatically catch rejected promises
 * and forward them to the Express error handler.
 *
 * Usage:
 *   router.get("/users", asyncHandler(async (req, res) => { ... }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Centralized error handler middleware.
 * Must be registered AFTER all routes in server.js.
 */
const errorHandler = (err, req, res, next) => {
  // ── Build the response object ────────────────────────────
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // ── Mongoose: Validation error ───────────────────────────
  if (err.name === "ValidationError") {
    statusCode = 400;
    const fields = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    message = "Validation failed";

    logger.warn(`❌ [${statusCode}] ${message}:`, { fields });
    return res.status(statusCode).json({
      success: false,
      message,
      error: fields.map((f) => `${f.field}: ${f.message}`).join(", "),
    });
  }

  // ── Mongoose: Duplicate key (code 11000) ─────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    const value = err.keyValue?.[field] || "unknown";
    message = `Duplicate value: '${value}' already exists for '${field}'`;
  }

  // ── Mongoose: Bad ObjectId cast ──────────────────────────
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: '${err.value}'`;
  }

  // ── JWT: Invalid token ───────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Authentication failed — invalid token";
  }

  // ── JWT: Expired token ───────────────────────────────────
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication failed — token expired";
  }

  // ── Payload too large ────────────────────────────────────
  if (err.type === "entity.too.large") {
    statusCode = 413;
    message = "Request payload is too large";
  }

  // ── Malformed JSON body ──────────────────────────────────
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Malformed JSON in request body";
  }

  // ── Log the error ────────────────────────────────────────
  if (statusCode >= 500) {
    logger.error(`❌ [${statusCode}] ${req.method} ${req.originalUrl}`, { stack: err.stack });
  } else {
    logger.warn(`⚠️  [${statusCode}] ${req.method} ${req.originalUrl} — ${message}`);
  }

  // ── Send response ────────────────────────────────────────
  const response = {
    success: false,
    message,
    error: err.isOperational ? "" : err.message,
  };

  // Expose stack trace only in development
  if (process.env.NODE_ENV === "development") {
    response.error = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 handler — catch requests to undefined routes.
 * Register BEFORE the error handler in server.js.
 */
const notFoundHandler = (req, res, next) => {
  const error = new ApiError(`Route not found: ${req.method} ${req.originalUrl}`, 404);
  next(error);
};

module.exports = { ApiError, asyncHandler, errorHandler, notFoundHandler };
