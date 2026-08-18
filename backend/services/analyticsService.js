const Meeting = require("../models/Meeting");
const User = require("../models/User");
const TimeSlot = require("../models/TimeSlot");

// ─────────────────────────────────────────────────────────────
// Analytics Service — MongoDB Aggregation Pipelines
// ─────────────────────────────────────────────────────────────

// ── Date Helpers ──────────────────────────────────────────────

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfWeek = (d) => {
  const date = startOfDay(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day); // Sunday start
  return date;
};

const startOfMonth = (d) => {
  const date = new Date(d);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ── Caching ───────────────────────────────────────────────────
let overviewCache = {
  data: null,
  expiry: 0,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// 1. Overview — High-level platform statistics
// ─────────────────────────────────────────────────────────────

const getOverview = async () => {
  const now = new Date();

  // Return cached data if valid
  if (overviewCache.data && Date.now() < overviewCache.expiry) {
    return overviewCache.data;
  }

  // Single $facet aggregation replaces 6 separate countDocuments calls (9→3 round-trips)
  const [meetingStats, slotAndUserCounts] = await Promise.all([
    Meeting.aggregate([
      {
        $facet: {
          byStatus: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ],
          upcoming: [
            { $match: { status: "scheduled", startTime: { $gt: now } } },
            { $count: "count" },
          ],
          total: [{ $count: "count" }],
        },
      },
    ]),
    Promise.all([
      User.estimatedDocumentCount(),
      TimeSlot.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            booked: { $sum: { $cond: ["$isBooked", 1, 0] } },
          },
        },
      ]),
    ]),
  ]);

  // Parse facet results
  const facet = meetingStats[0] || {};
  const statusMap = {};
  (facet.byStatus || []).forEach((s) => { statusMap[s._id] = s.count; });
  const totalMeetings = facet.total?.[0]?.count || 0;
  const scheduledMeetings = statusMap["scheduled"] || 0;
  const completedMeetings = statusMap["completed"] || 0;
  const cancelledMeetings = statusMap["cancelled"] || 0;
  const inProgressMeetings = statusMap["in-progress"] || 0;
  const upcomingMeetings = facet.upcoming?.[0]?.count || 0;

  const [totalUsers, slotAgg] = slotAndUserCounts;
  const totalSlots = slotAgg[0]?.total || 0;
  const bookedSlots = slotAgg[0]?.booked || 0;

  // Cancellation rate
  const cancellationRate =
    totalMeetings > 0
      ? Math.round((cancelledMeetings / totalMeetings) * 10000) / 100
      : 0;

  // Slot utilization
  const slotUtilization =
    totalSlots > 0
      ? Math.round((bookedSlots / totalSlots) * 10000) / 100
      : 0;

  const result = {
    meetings: {
      total: totalMeetings,
      scheduled: scheduledMeetings,
      completed: completedMeetings,
      cancelled: cancelledMeetings,
      inProgress: inProgressMeetings,
      upcoming: upcomingMeetings,
      cancellationRate: `${cancellationRate}%`,
    },
    users: {
      total: totalUsers,
    },
    slots: {
      total: totalSlots,
      booked: bookedSlots,
      available: totalSlots - bookedSlots,
      utilization: `${slotUtilization}%`,
    },
  };

  // Update cache
  overviewCache = {
    data: result,
    expiry: Date.now() + CACHE_TTL,
  };

  return result;
};

// ─────────────────────────────────────────────────────────────
// 2. Peak Booking Hours — Which hours get the most meetings
// ─────────────────────────────────────────────────────────────

const getPeakBookingHours = async (daysBack = 30) => {
  const since = daysAgo(daysBack);

  const pipeline = [
    {
      $match: {
        status: { $ne: "cancelled" },
        startTime: { $gte: since },
      },
    },
    {
      $project: {
        hour: { $hour: "$startTime" },
      },
    },
    {
      $group: {
        _id: "$hour",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ];

  const results = await Meeting.aggregate(pipeline);

  // Fill in missing hours with 0
  const hourMap = Object.fromEntries(results.map((r) => [r._id, r.count]));
  const distribution = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, "0")}:00`,
    count: hourMap[i] || 0,
  }));

  // Top 3 peak hours
  const peak = [...distribution].sort((a, b) => b.count - a.count).slice(0, 3);

  return { distribution, peak };
};

// ─────────────────────────────────────────────────────────────
// 3. Most Active Users — Top organizers and participants
// ─────────────────────────────────────────────────────────────

const getMostActiveUsers = async (limit = 10) => {
  // Top organizers by created meetings
  const topOrganizers = await Meeting.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $group: { _id: "$organizer", meetingsOrganized: { $sum: 1 } } },
    { $sort: { meetingsOrganized: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        email: "$user.email",
        meetingsOrganized: 1,
      },
    },
  ]);

  // Top participants by meeting invitations
  const topParticipants = await Meeting.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    { $unwind: "$participants" },
    { $group: { _id: "$participants.user", meetingsAttended: { $sum: 1 } } },
    { $sort: { meetingsAttended: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        email: "$user.email",
        meetingsAttended: 1,
      },
    },
  ]);

  return { topOrganizers, topParticipants };
};

// ─────────────────────────────────────────────────────────────
// 4. Weekly Statistics — Meetings per day for the last 4 weeks
// ─────────────────────────────────────────────────────────────

const getWeeklyStats = async () => {
  const since = daysAgo(28);

  const pipeline = [
    {
      $match: {
        startTime: { $gte: since },
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$startTime" },
          month: { $month: "$startTime" },
          day: { $dayOfMonth: "$startTime" },
        },
        count: { $sum: 1 },
        totalDuration: {
          $sum: {
            $divide: [{ $subtract: ["$endTime", "$startTime"] }, 60000],
          },
        },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
  ];

  const raw = await Meeting.aggregate(pipeline);

  const daily = raw.map((r) => ({
    date: `${r._id.year}-${String(r._id.month).padStart(2, "0")}-${String(r._id.day).padStart(2, "0")}`,
    meetings: r.count,
    totalMinutes: Math.round(r.totalDuration),
  }));

  return { period: "last_28_days", daily };
};

// ─────────────────────────────────────────────────────────────
// 5. Monthly Statistics — Meetings per month for the last 12
// ─────────────────────────────────────────────────────────────

const getMonthlyStats = async () => {
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const pipeline = [
    {
      $match: {
        startTime: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$startTime" },
          month: { $month: "$startTime" },
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ];

  const raw = await Meeting.aggregate(pipeline);

  // Pivot into per-month objects
  const months = {};
  for (const r of raw) {
    const key = `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;
    if (!months[key]) {
      months[key] = { month: key, total: 0, scheduled: 0, completed: 0, cancelled: 0 };
    }
    months[key].total += r.count;
    if (r._id.status === "scheduled") months[key].scheduled += r.count;
    if (r._id.status === "completed") months[key].completed += r.count;
    if (r._id.status === "cancelled") months[key].cancelled += r.count;
  }

  return { period: "last_12_months", monthly: Object.values(months) };
};

// ─────────────────────────────────────────────────────────────
// 6. Average Meeting Duration
// ─────────────────────────────────────────────────────────────

const getAverageDuration = async () => {
  const result = await Meeting.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: null,
        avgDuration: {
          $avg: { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 60000] },
        },
        minDuration: {
          $min: { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 60000] },
        },
        maxDuration: {
          $max: { $divide: [{ $subtract: ["$endTime", "$startTime"] }, 60000] },
        },
      },
    },
  ]);

  if (!result.length) {
    return { avgMinutes: 0, minMinutes: 0, maxMinutes: 0 };
  }

  return {
    avgMinutes: Math.round(result[0].avgDuration),
    minMinutes: Math.round(result[0].minDuration),
    maxMinutes: Math.round(result[0].maxDuration),
  };
};

module.exports = {
  getOverview,
  getPeakBookingHours,
  getMostActiveUsers,
  getWeeklyStats,
  getMonthlyStats,
  getAverageDuration,
};
