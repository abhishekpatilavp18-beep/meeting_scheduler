// ─────────────────────────────────────────────────────────────
// API Response Formatter — Standardized Response Structures
// ─────────────────────────────────────────────────────────────

/**
 * Send a standardized success response.
 *
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Human readable message
 * @param {Object} [data={}] - Payload
 */
const sendSuccess = (res, statusCode, message, data = {}) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send a standardized error response.
 *
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Human readable error message
 * @param {string} [error=""] - Technical error detail or code
 */
const sendError = (res, statusCode, message, error = "") => {
  res.status(statusCode).json({
    success: false,
    message,
    error,
  });
};

module.exports = {
  sendSuccess,
  sendError,
};
