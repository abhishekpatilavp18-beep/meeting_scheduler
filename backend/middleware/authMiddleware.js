const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ApiError } = require("./errorHandler");

// ─────────────────────────────────────────────────────────────
// Auth Middleware — Production-grade JWT verification & RBAC
// ─────────────────────────────────────────────────────────────

/**
 * Protect routes — extracts and verifies the JWT from the
 * Authorization header, then attaches the user to `req.user`.
 *
 * Throws ApiError on failure so the centralized error handler
 * produces a consistent response shape.
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError("Not authorized — no token provided", 401);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new ApiError("Not authorized — malformed header", 401);
    }

    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "hackhive-scheduler",
      audience: "hackhive-client",
      algorithms: ["HS256"],
    });

    // 4. Verify user still exists in DB and fetch full profile (e.g. timezone)
    const dbUser = await User.findById(decoded.id).select("-password").lean();
    if (!dbUser) {
      throw new ApiError("Not authorized — user no longer exists", 401);
    }

    // 5. Attach the DB profile as the authoritative user context.
    // The DB is the single source of truth for role — never trust
    // JWT claims for RBAC to prevent privilege escalation via token tampering.
    req.user = {
      ...dbUser,
      _id: decoded.id,
    };

    next();
  } catch (error) {
    // If it's already an ApiError, forward it; otherwise let the
    // error handler deal with native JWT errors.
    next(error);
  }
};

/**
 * Restrict access to specific roles.
 *
 * Usage:
 *   router.get("/admin", protect, authorize("admin"), handler);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError("Not authorized — no user context", 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          `Role '${req.user.role}' is not authorized to access this resource`,
          403
        )
      );
    }

    next();
  };
};

module.exports = { protect, authorize };
