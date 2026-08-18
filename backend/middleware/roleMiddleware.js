const { ApiError } = require("./errorHandler");

/**
 * RBAC Middleware — Restricts access to specific roles.
 * Must be used after the JWT `protect` middleware.
 *
 * @param  {...string} roles - The roles allowed to access the route.
 * @example
 * router.get("/admin", protect, authorizeRoles("admin"), adminController);
 * router.post("/host", protect, authorizeRoles("admin", "host"), hostController);
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // Ensure the protect middleware has already run
    if (!req.user) {
      return next(new ApiError("Not authorized — no user context found", 401));
    }

    // Check if the user's role is in the list of allowed roles
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

module.exports = { authorizeRoles };
