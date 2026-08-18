const { asyncHandler } = require("../middleware/errorHandler");
const { sendSuccess } = require("../utils/apiResponse");
const analyticsService = require("../services/analyticsService");

// ─────────────────────────────────────────────────────────────
// Analytics Controller — Thin layer over analyticsService
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// GET /api/analytics/overview
// High-level dashboard: total meetings, upcoming, cancelled,
// slot utilization, user count.
// ─────────────────────────────────────────────────────────────

const getOverview = asyncHandler(async (req, res) => {
  const [overview, duration] = await Promise.all([
    analyticsService.getOverview(),
    analyticsService.getAverageDuration(),
  ]);

  sendSuccess(res, 200, "Analytics overview retrieved successfully", {
    ...overview,
    duration,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/analytics/usage
// Detailed usage analytics: peak hours, active users,
// weekly trends, monthly trends.
//
// Query params:
//   ?period=7|14|28|90   — days of history for peak hours (default 30)
//   ?limit=10            — top-N active users (default 10)
// ─────────────────────────────────────────────────────────────

const getUsage = asyncHandler(async (req, res) => {
  const { period = 30, limit = 10 } = req.query;

  const daysBack = Math.max(7, Math.min(365, parseInt(period, 10) || 30));
  const userLimit = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));

  const [peakHours, activeUsers, weeklyStats, monthlyStats] = await Promise.all([
    analyticsService.getPeakBookingHours(daysBack),
    analyticsService.getMostActiveUsers(userLimit),
    analyticsService.getWeeklyStats(),
    analyticsService.getMonthlyStats(),
  ]);

  sendSuccess(res, 200, "Usage analytics retrieved successfully", {
    peakHours,
    activeUsers,
    weeklyStats,
    monthlyStats,
  });
});

module.exports = { getOverview, getUsage };
