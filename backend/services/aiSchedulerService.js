const Meeting = require("../models/Meeting");
const TimeSlot = require("../models/TimeSlot");
const Availability = require("../models/Availability");
const User = require("../models/User");

// ─────────────────────────────────────────────────────────────
// AI Scheduler Service — Intelligent Slot Recommendation Engine
// ─────────────────────────────────────────────────────────────
//
// Responsibilities:
//   1. Detect scheduling conflicts across participants
//   2. Prevent double-booking
//   3. Recommend top N best slots based on multi-signal scoring
//   4. Handle timezone-safe scheduling
//   5. Support recurring weekly availability + date overrides
//
// Architecture:
//   Date pipeline:  Availability → Free windows → Subtract busy → Score → Rank
// ─────────────────────────────────────────────────────────────

// ── Time Helpers ──────────────────────────────────────────────

/**
 * Convert "HH:mm" string to minutes since midnight.
 */
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Convert minutes since midnight to "HH:mm".
 */
const toTimeStr = (mins) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};

/**
 * Build a full Date object from a date (day) and minutes-since-midnight.
 */
const buildDate = (date, minutes) => {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

/**
 * Get start-of-day and end-of-day Date boundaries.
 */
const dayBounds = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// ── Conflict Detection ────────────────────────────────────────

/**
 * Get all busy (occupied) time windows for a user on a given date.
 * Returns an array of { start, end } in minutes-since-midnight.
 *
 * Sources:
 *   - Meetings where user is organizer
 *   - Meetings where user is a participant
 *   - Booked TimeSlots where user is host
 */
const getBusyWindows = async (userId, date) => {
  const { start, end } = dayBounds(date);

  // Run both queries in parallel instead of sequentially, with minimal projection
  const [meetings, bookedSlots] = await Promise.all([
    Meeting.find({
      $or: [
        { organizer: userId },
        { "participants.user": userId },
      ],
      startTime: { $lt: end },
      endTime: { $gt: start },
      status: { $nin: ["cancelled", "completed"] },
    })
      .select("startTime endTime")
      .lean(),

    TimeSlot.find({
      host: userId,
      isBooked: true,
      startTime: { $lt: end },
      endTime: { $gt: start },
    })
      .select("startTime endTime")
      .lean(),
  ]);

  const windows = [];

  for (const m of meetings) {
    const mStart = new Date(m.startTime);
    const mEnd = new Date(m.endTime);
    // Clamp to the target day
    const s = Math.max(mStart.getHours() * 60 + mStart.getMinutes(), 0);
    const e = Math.min(mEnd.getHours() * 60 + mEnd.getMinutes(), 1440);
    if (e > s) windows.push({ start: s, end: e });
  }

  for (const slot of bookedSlots) {
    const sStart = new Date(slot.startTime);
    const sEnd = new Date(slot.endTime);
    const s = sStart.getHours() * 60 + sStart.getMinutes();
    const e = sEnd.getHours() * 60 + sEnd.getMinutes();
    if (e > s) windows.push({ start: s, end: e });
  }

  // Sort and merge overlapping windows
  return mergeWindows(windows);
};

/**
 * Sort and merge overlapping time windows.
 */
const mergeWindows = (windows) => {
  if (!windows.length) return [];
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
};

// ── Free Window Computation ───────────────────────────────────

/**
 * Subtract busy windows from available windows.
 * Returns remaining free segments.
 */
const subtractWindows = (available, busy) => {
  const free = [];

  for (const avail of available) {
    let segments = [{ start: avail.start, end: avail.end }];

    for (const b of busy) {
      const next = [];
      for (const seg of segments) {
        // No overlap
        if (b.end <= seg.start || b.start >= seg.end) {
          next.push(seg);
        } else {
          // Left remnant
          if (b.start > seg.start) {
            next.push({ start: seg.start, end: b.start });
          }
          // Right remnant
          if (b.end < seg.end) {
            next.push({ start: b.end, end: seg.end });
          }
        }
      }
      segments = next;
    }

    free.push(...segments);
  }

  return free;
};

/**
 * Get free (available, non-busy) windows for a user on a specific date.
 * Combines Availability rules with actual busy data.
 *
 * @param {string} userId
 * @param {Date}   date
 * @returns {Array<{ start: number, end: number, preferred: boolean }>}
 */
const getFreeWindows = async (userId, date) => {
  const avail = await Availability.getForDate(userId, date);

  // No availability data or fully blocked
  if (!avail || !avail.isAvailable || !avail.timeBlocks?.length) {
    return [];
  }

  // Convert availability blocks to minute windows
  const availWindows = avail.timeBlocks.map((b) => ({
    start: toMinutes(b.startTime),
    end: toMinutes(b.endTime),
    preferred: b.preferred || false,
  }));

  const busy = await getBusyWindows(userId, date);
  const freeRaw = subtractWindows(availWindows, busy);

  // Carry the "preferred" flag forward into free segments
  return freeRaw.map((seg) => {
    const preferred = availWindows.some(
      (a) => a.preferred && seg.start >= a.start && seg.end <= a.end
    );
    return { ...seg, preferred };
  });
};

// ── Multi-Participant Intersection ────────────────────────────

/**
 * Find common free windows across multiple users for a given date.
 * Only returns windows that fit the requested duration.
 *
 * @param {string[]} userIds
 * @param {Date}     date
 * @param {number}   durationMinutes
 * @returns {Array<{ start, end, preferred }>}
 */
const findCommonFreeWindows = async (userIds, date, durationMinutes = 30) => {
  if (!userIds.length) return [];

  let common = await getFreeWindows(userIds[0], date);

  for (let i = 1; i < userIds.length; i++) {
    const other = await getFreeWindows(userIds[i], date);
    const intersected = [];

    for (const a of common) {
      for (const b of other) {
        const start = Math.max(a.start, b.start);
        const end = Math.min(a.end, b.end);
        if (end - start >= durationMinutes) {
          intersected.push({
            start,
            end,
            preferred: a.preferred && b.preferred,
          });
        }
      }
    }

    common = intersected;
    if (!common.length) break;
  }

  return common;
};

// ── Conflict Check ────────────────────────────────────────────

/**
 * Check if scheduling a meeting at the given time would conflict
 * with any participant's existing commitments.
 *
 * @returns {{ hasConflict: boolean, conflicts: Array }}
 */
const detectConflicts = async (userIds, startTime, endTime) => {
  const conflicts = [];

  for (const userId of userIds) {
    const existing = await Meeting.findConflicts(userId, startTime, endTime);
    if (existing.length > 0) {
      const user = await User.findById(userId).select("name email").lean();
      conflicts.push({
        userId,
        userName: user?.name || "Unknown",
        conflictingMeetings: existing.map((m) => ({
          id: m._id,
          title: m.title,
          startTime: m.startTime,
          endTime: m.endTime,
        })),
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
};

// ── Slot Scoring Engine ───────────────────────────────────────

/**
 * Score a candidate time slot (0–100). Higher = better.
 *
 * Signals:
 *   1. Proximity to now          — sooner slots score higher
 *   2. Preferred hours           — user-marked preferred blocks get a boost
 *   3. Time-of-day sweetspot     — mid-morning (10:00) and mid-afternoon (14:30)
 *   4. Duration fit              — slots matching requested duration score better
 *   5. Buffer time               — penalize slots immediately after busy windows
 *   6. Edge-of-day penalty       — before 8:00 or after 18:00
 *
 * @param {Object}  candidate       — { date, start, end, preferred }
 * @param {Object}  opts
 * @param {number}  opts.duration   — requested duration in minutes
 * @param {Object}  opts.prefHours  — { startTime, endTime } from Availability
 * @param {Date}    opts.now        — current timestamp for proximity calc
 * @param {Array}   opts.busyBefore — busy windows for buffer penalty
 */
const scoreSlot = (candidate, opts = {}) => {
  let score = 50; // base score

  const { duration = 30, prefHours, now, busyBefore = [] } = opts;
  const midpoint = (candidate.start + candidate.end) / 2;
  const slotDuration = candidate.end - candidate.start;

  // ── Signal 1: Proximity to now (max +15) ────────────────────
  if (now && candidate.date) {
    const slotDate = new Date(candidate.date);
    slotDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const daysAway = Math.round((slotDate - today) / 86400000);

    if (daysAway === 0) score += 15;      // today
    else if (daysAway === 1) score += 12;  // tomorrow
    else if (daysAway <= 3) score += 8;    // within 3 days
    else if (daysAway <= 7) score += 4;    // within a week
    // beyond a week: no bonus
  }

  // ── Signal 2: Preferred hours (max +15) ─────────────────────
  if (candidate.preferred) {
    score += 15;
  } else if (prefHours) {
    const prefStart = toMinutes(prefHours.startTime);
    const prefEnd = toMinutes(prefHours.endTime);
    // Slot falls within preferred window
    if (candidate.start >= prefStart && candidate.end <= prefEnd) {
      score += 10;
    }
  }

  // ── Signal 3: Time-of-day sweetspot (max +12) ───────────────
  // Ideal: 10:00 (600) and 14:30 (870)
  const idealTimes = [600, 870];
  const closeness = Math.min(...idealTimes.map((t) => Math.abs(midpoint - t)));
  score += Math.max(0, Math.round(12 - closeness / 15));

  // ── Signal 4: Duration fit (max +8) ─────────────────────────
  if (slotDuration >= duration && slotDuration <= duration * 1.5) {
    score += 8; // perfect fit
  } else if (slotDuration >= duration) {
    score += 4; // fits but leaves extra room
  }

  // ── Signal 5: Buffer time penalty (max -10) ─────────────────
  // Penalize if the slot starts immediately after a busy window (< 15 min gap)
  for (const b of busyBefore) {
    const gap = candidate.start - b.end;
    if (gap >= 0 && gap < 15) {
      score -= 10;
      break;
    }
  }

  // ── Signal 6: Edge-of-day penalty (max -15) ─────────────────
  if (candidate.start < 480) score -= 10;  // before 08:00
  if (candidate.end > 1080) score -= 8;    // after 18:00
  if (candidate.start < 420) score -= 5;   // before 07:00 (extra)
  if (candidate.end > 1200) score -= 5;    // after 20:00 (extra)

  return Math.round(Math.max(0, Math.min(100, score)));
};

// ── Recommendation Engine ─────────────────────────────────────

/**
 * Recommend the best available time slots for a meeting.
 *
 * @param {Object}   options
 * @param {string}   options.hostId          — Host user ID (required)
 * @param {string[]} options.participantIds  — Additional participant user IDs
 * @param {number}   options.durationMinutes — Required meeting length (default 30)
 * @param {string}   options.startDate       — Search window start (ISO string)
 * @param {string}   options.endDate         — Search window end (ISO string)
 * @param {number}   options.maxResults      — Max recommendations (default 3)
 *
 * @returns {Array<{
 *   date: Date,
 *   startTime: Date,
 *   endTime: Date,
 *   startTimeStr: string,
 *   endTimeStr: string,
 *   durationMinutes: number,
 *   score: number,
 *   preferred: boolean,
 *   conflictFree: boolean,
 * }>}
 */
const recommendSlots = async ({
  hostId,
  participantIds = [],
  durationMinutes = 30,
  startDate,
  endDate,
  maxResults = 3,
}) => {
  const allUserIds = [hostId, ...participantIds.filter((id) => id.toString() !== hostId.toString())];
  const now = new Date();

  // Determine search window (default: next 7 days)
  const searchStart = startDate ? new Date(startDate) : now;
  const searchEnd = endDate ? new Date(endDate) : new Date(now.getTime() + 7 * 86400000);

  // Fetch host's availability config for preferred hours
  const hostAvailDoc = await Availability.findOne({ userId: hostId });
  const prefHours = hostAvailDoc?.preferredHours || { startTime: "09:00", endTime: "17:00" };

  // ── Day-by-day candidate generation ─────────────────────────
  const candidates = [];
  const current = new Date(searchStart);
  current.setHours(0, 0, 0, 0);
  const endBound = new Date(searchEnd);
  endBound.setHours(23, 59, 59, 999);

  const MAX_DAYS_SCAN = 30;     // safety cap
  const MAX_CANDIDATES = 200;   // don't generate too many candidates
  let dayCount = 0;

  while (current <= endBound && dayCount < MAX_DAYS_SCAN && candidates.length < MAX_CANDIDATES) {
    dayCount++;

    // Find common free windows for all participants on this day
    const freeWindows = await findCommonFreeWindows(allUserIds, current, durationMinutes);

    // Get busy windows for buffer-time penalty
    const hostBusy = await getBusyWindows(hostId, current);

    for (const win of freeWindows) {
      // Slide a window of `durationMinutes` across the free block
      // in 15-minute increments
      let slotStart = win.start;

      // If today, skip past the current time
      if (current.toDateString() === now.toDateString()) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        slotStart = Math.max(slotStart, nowMinutes + 5); // 5-min buffer from "right now"
        // Align to next 15-min boundary
        slotStart = Math.ceil(slotStart / 15) * 15;
      }

      while (slotStart + durationMinutes <= win.end && candidates.length < MAX_CANDIDATES) {
        const slotEnd = slotStart + durationMinutes;

        candidates.push({
          date: new Date(current),
          start: slotStart,
          end: slotEnd,
          preferred: win.preferred || false,
          busyBefore: hostBusy,
        });

        slotStart += 15;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  // ── Score and rank ──────────────────────────────────────────
  const scored = candidates.map((c) => {
    const score = scoreSlot(c, {
      duration: durationMinutes,
      prefHours,
      now,
      busyBefore: c.busyBefore,
    });

    return {
      date: c.date,
      startTime: buildDate(c.date, c.start),
      endTime: buildDate(c.date, c.end),
      startTimeStr: toTimeStr(c.start),
      endTimeStr: toTimeStr(c.end),
      durationMinutes,
      score,
      preferred: c.preferred,
      conflictFree: true, // all candidates are already conflict-free by construction
    };
  });

  // Sort: score DESC → date ASC → start ASC (deterministic tiebreaker)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
    return a.startTime - b.startTime;
  });

  // Deduplicate: remove slots that are within 15 minutes of a higher-ranked one
  const results = [];
  for (const slot of scored) {
    const isDuplicate = results.some(
      (r) =>
        r.date.toDateString() === slot.date.toDateString() &&
        Math.abs(r.startTime.getTime() - slot.startTime.getTime()) < 15 * 60000
    );
    if (!isDuplicate) {
      results.push(slot);
    }
    if (results.length >= maxResults) break;
  }

  return results;
};

// ── Exports ───────────────────────────────────────────────────

module.exports = {
  // Core helpers (reusable by other services)
  toMinutes,
  toTimeStr,
  getBusyWindows,
  getFreeWindows,
  findCommonFreeWindows,

  // Conflict detection
  detectConflicts,

  // Scoring
  scoreSlot,

  // Main API
  recommendSlots,
};
