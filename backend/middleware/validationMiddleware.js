const { validationResult } = require("express-validator");
const { sendError } = require("../utils/apiResponse");

// ─────────────────────────────────────────────────────────────
// Validation Middleware
// Validates express-validator rules and returns standard error
// ─────────────────────────────────────────────────────────────

/**
 * Middleware that checks for validation errors from express-validator.
 * Must be placed after the validation rules in the route definition.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Format errors into a readable string
    const errorString = errors
      .array()
      .map((err) => `${err.path || err.param}: ${err.msg}`)
      .join("; ");

    return sendError(res, 400, "Validation failed", errorString);
  }
  next();
};

module.exports = {
  validate,
};
