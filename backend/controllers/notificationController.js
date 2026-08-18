const User = require("../models/User");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");
const { sendSuccess } = require("../utils/apiResponse");

// ─────────────────────────────────────────────────────────────
// Notification Controller
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/notifications
 * Get all notifications for the authenticated user.
 */
const getNotifications = asyncHandler(async (req, res) => {
  // Project only the notifications field — avoids loading the entire user doc
  const user = await User.findById(req.user._id)
    .select("notifications")
    .lean();
  if (!user) throw new ApiError("User not found", 404);

  const sorted = (user.notifications || []).sort((a, b) => b.createdAt - a.createdAt);

  sendSuccess(res, 200, "Notifications retrieved successfully", {
    count: sorted.length,
    notifications: sorted,
  });
});

/**
 * PUT /api/notifications/read
 * Mark all notifications as read.
 */
const markAllRead = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $set: { "notifications.$[].read": true } }
  );

  sendSuccess(res, 200, "All notifications marked as read");
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
const markOneRead = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError("User not found", 404);

  const notification = user.notifications.id(req.params.id);
  if (!notification) {
    throw new ApiError("Notification not found", 404);
  }

  notification.read = true;
  await user.save();

  sendSuccess(res, 200, "Notification marked as read", {
    notification,
  });
});

/**
 * DELETE /api/notifications
 * Clear all notifications.
 */
const clearNotifications = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $set: { notifications: [] } }
  );

  sendSuccess(res, 200, "Notifications cleared");
});

module.exports = { getNotifications, markAllRead, markOneRead, clearNotifications };
