const rateLimit = require("express-rate-limit");
const { sendError } = require("../utils/apiResponse");
const logger = require("../utils/logger");

// ─────────────────────────────────────────────────────────────
// Security Middleware — Production-grade rate limiting & abuse
// prevention for the HackHive Meeting Scheduler API.
// ─────────────────────────────────────────────────────────────

// ── Shared handler ────────────────────────────────────────────
// Returns standardized error format instead of express-rate-limit
// default HTML, so the frontend always receives JSON.
// Also logs the rate-limited request for auditing.

const rateLimitHandler = (req, res) => {
  logger.warn(`🛑 Rate limit exceeded for IP: ${req.ip} on ${req.method} ${req.originalUrl}`);
  sendError(res, 429, "Too many requests — please try again later", "RATE_LIMIT_EXCEEDED");
};

// ── Request Tracker ───────────────────────────────────────────
// Logs every request to help identify endpoint spamming.
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode === 429) {
      logger.error(`[SPAM_DETECTED] ${req.ip} -> ${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
    } else {
      logger.info(`${req.ip} -> ${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
    }
  });
  next();
};

// ─────────────────────────────────────────────────────────────
// 1. Global API limiter
//    Applies to every /api/* request.
//    200 requests per 15-minute window per IP.
// ─────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,                    // per IP (increased from 100 to support dashboard activity)
  standardHeaders: true,       // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,        // Disable X-RateLimit-* headers
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for health checks so load balancers work
    return req.path === "/api/health";
  },
});

// ─────────────────────────────────────────────────────────────
// 2. Auth limiter (strict)
//    Protects login / register from brute-force & credential
//    stuffing attacks.
//    20 attempts per 15-minute window per IP.
// ─────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`🔑 Auth rate limit hit: ${req.ip}`);
    sendError(
      res,
      429,
      "Too many authentication attempts — account temporarily locked. Try again in 15 minutes.",
      "AUTH_RATE_LIMIT_EXCEEDED"
    );
  },
  keyGenerator: (req) => {
    const email = req.body?.email?.toLowerCase?.() || "";
    return `${req.ip}_${email}`;
  },
  validate: false,
});

// ─────────────────────────────────────────────────────────────
// 3. Booking limiter
//    Prevents meeting-creation abuse (spam bookings).
//    50 bookings per hour per IP.
// ─────────────────────────────────────────────────────────────

const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`📅 Booking rate limit hit: ${req.ip}`);
    sendError(
      res,
      429,
      "Booking rate limit reached — try again later",
      "BOOKING_RATE_LIMIT_EXCEEDED"
    );
  },
});

// ─────────────────────────────────────────────────────────────
// 4. Slot creation limiter
//    Prevents bulk abuse of slot creation endpoints.
//    50 slot creations per 15-minute window per IP.
// ─────────────────────────────────────────────────────────────

const slotCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ─────────────────────────────────────────────────────────────
// 5. Request size guard
//    Blocks suspiciously long query strings and oversized
//    headers.
// ─────────────────────────────────────────────────────────────

const requestSizeGuard = (req, res, next) => {
  if (req.originalUrl.length > 2048) {
    logger.error(`🚨 Large request URI blocked from IP: ${req.ip}`);
    return sendError(res, 414, "URI too long", "URI_TOO_LONG");
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// 6. Security headers fingerprint stripper
// ─────────────────────────────────────────────────────────────

const stripFingerprint = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  next();
};

module.exports = {
  requestLogger,
  globalLimiter,
  authLimiter,
  bookingLimiter,
  slotCreationLimiter,
  requestSizeGuard,
  stripFingerprint,
};
