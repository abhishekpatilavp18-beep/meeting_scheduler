const TimeSlot = require("../models/TimeSlot");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const aiScheduler = require("../services/aiSchedulerService");
const socketService = require("../services/socketService");

// ─────────────────────────────────────────────────────────────
// Slot Controller — Production-grade Time Slot Management
// ─────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────
const MIN_SLOT_DURATION_MIN = 10;   // minimum 10-minute slots
const MAX_SLOT_DURATION_MIN = 480;  // maximum 8-hour slots
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_BULK_SLOTS = 200;

// ── Helpers ───────────────────────────────────────────────────

/**
 * Validate and parse a date string into a Date object.
 * Throws ApiError if the string is not a valid date.
 */
const parseDate = (dateStr, fieldName) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    throw new ApiError(`Invalid date format for '${fieldName}'`, 400);
  }
  return d;
};

/**
 * Validate that start < end and duration is within bounds.
 */
const validateTimeWindow = (startTime, endTime) => {
  if (endTime <= startTime) {
    throw new ApiError("End time must be after start time", 400);
  }

  const durationMin = (endTime - startTime) / 60000;

  if (durationMin < MIN_SLOT_DURATION_MIN) {
    throw new ApiError(
      `Slot duration must be at least ${MIN_SLOT_DURATION_MIN} minutes (got ${Math.round(durationMin)})`,
      400
    );
  }

  if (durationMin > MAX_SLOT_DURATION_MIN) {
    throw new ApiError(
      `Slot duration cannot exceed ${MAX_SLOT_DURATION_MIN} minutes (got ${Math.round(durationMin)})`,
      400
    );
  }
};

/**
 * Check for overlapping slots and throw if any exist.
 */
const assertNoOverlap = async (hostId, startTime, endTime, excludeSlotId = null) => {
  const overlapping = await TimeSlot.findOverlapping(hostId, startTime, endTime, excludeSlotId);

  if (overlapping.length > 0) {
    const conflict = overlapping[0];
    throw new ApiError(
      `Time slot overlaps with an existing slot (${new Date(conflict.startTime).toISOString()} – ${new Date(conflict.endTime).toISOString()})`,
      409
    );
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/slots/create
// Create a single time slot for the authenticated host.
// ─────────────────────────────────────────────────────────────

const createSlot = asyncHandler(async (req, res) => {
  const { startTime: startStr, endTime: endStr } = req.body;

  // ── Validate input ──────────────────────────────────────────
  if (!startStr || !endStr) {
    throw new ApiError("startTime and endTime are required", 400);
  }

  const startTime = parseDate(startStr, "startTime");
  const endTime = parseDate(endStr, "endTime");

  validateTimeWindow(startTime, endTime);

  // ── Prevent past slots ──────────────────────────────────────
  if (startTime < new Date()) {
    throw new ApiError("Cannot create a slot in the past", 400);
  }

  // ── Prevent overlapping slots ───────────────────────────────
  await assertNoOverlap(req.user._id, startTime, endTime);

  // ── Create ──────────────────────────────────────────────────
  const slot = await TimeSlot.create({
    host: req.user._id,
    startTime,
    endTime,
  });

  // Broadcast live slot creation
  socketService.emitSlotUpdate(req.user._id, "created", slot);

  sendSuccess(res, 201, "Time slot created", {
    slot,
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/slots/bulk
// Create multiple time slots at once (admin).
// ─────────────────────────────────────────────────────────────

const createBulkSlots = asyncHandler(async (req, res) => {
  const { slots, clearExisting } = req.body;

  if (!Array.isArray(slots) || slots.length === 0) {
    throw new ApiError("'slots' must be a non-empty array", 400);
  }

  if (slots.length > MAX_BULK_SLOTS) {
    throw new ApiError(`Cannot create more than ${MAX_BULK_SLOTS} slots at once`, 400);
  }

  const now = new Date();

  // ── Fast path: clearExisting mode (availability setup) ──────
  // When the user is re-saving their full availability schedule,
  // we delete all future unbooked slots first, then batch-insert
  // the new ones in a single DB call. This avoids 200+ sequential
  // overlap queries that cause timeouts.
  if (clearExisting) {
    await TimeSlot.deleteMany({
      host: req.user._id,
      isBooked: false,
      startTime: { $gt: now },
    });

    // Validate and prepare all slot documents
    const validDocs = [];
    const errors = [];

    for (let i = 0; i < slots.length; i++) {
      const { startTime: startStr, endTime: endStr } = slots[i];
      try {
        if (!startStr || !endStr) throw new Error("startTime and endTime are required");
        const startTime = parseDate(startStr, "startTime");
        const endTime = parseDate(endStr, "endTime");
        validateTimeWindow(startTime, endTime);
        if (startTime < now) throw new Error("Cannot create a slot in the past");
        validDocs.push({ host: req.user._id, startTime, endTime });
      } catch (err) {
        errors.push({ index: i, input: slots[i], error: err.message });
      }
    }

    if (validDocs.length === 0) {
      const errMsg = errors.map((e) => `[Slot ${e.index}] ${e.error}`).join("; ");
      return sendError(res, 400, "Bulk creation failed", errMsg);
    }

    // Insert all valid slots in one DB operation (ordered:false to skip dupes)
    let created = [];
    try {
      created = await TimeSlot.insertMany(validDocs, { ordered: false });
    } catch (bulkErr) {
      // insertMany with ordered:false throws on dupes but still inserts the rest
      if (bulkErr.insertedDocs) {
        created = bulkErr.insertedDocs;
      }
    }

    if (created.length > 0) {
      socketService.emitSlotUpdate(req.user._id, "bulk_created", created);
    }

    const status = errors.length === 0 ? 201 : created.length > 0 ? 207 : 400;
    return sendSuccess(res, status, `${created.length} slot(s) created, ${errors.length} skipped`, {
      created,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  // ── Standard path: individual overlap checks ────────────────
  const created = [];
  const errors = [];

  for (let i = 0; i < slots.length; i++) {
    const { startTime: startStr, endTime: endStr } = slots[i];

    try {
      if (!startStr || !endStr) {
        throw new Error("startTime and endTime are required");
      }

      const startTime = parseDate(startStr, "startTime");
      const endTime = parseDate(endStr, "endTime");

      validateTimeWindow(startTime, endTime);

      if (startTime < now) {
        throw new Error("Cannot create a slot in the past");
      }

      await assertNoOverlap(req.user._id, startTime, endTime);

      const slot = await TimeSlot.create({
        host: req.user._id,
        startTime,
        endTime,
      });

      created.push(slot);
    } catch (err) {
      errors.push({ index: i, input: slots[i], error: err.message });
    }
  }

  // Broadcast live bulk slot creation
  if (created.length > 0) {
    socketService.emitSlotUpdate(req.user._id, "bulk_created", created);
  }

  const status = errors.length === 0 ? 201 : created.length > 0 ? 207 : 400;

  if (status === 400) {
    const errMsg = errors.map((e) => `[Slot ${e.index}] ${e.error}`).join("; ");
    console.error("Bulk creation failed completely. Errors:", errMsg);
    sendError(res, 400, "Bulk creation failed", errMsg);
  } else {
    sendSuccess(res, status, `${created.length} slot(s) created, ${errors.length} failed`, {
      created,
      errors: errors.length > 0 ? errors : undefined,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/slots/available
// Get available (unbooked, future) time slots.
// Supports filtering by host, date range, and pagination.
//
// Query params:
//   ?hostId=xxx        — filter by host (required)
//   ?startDate=xxx     — range start (default: now)
//   ?endDate=xxx       — range end (optional)
//   ?page=1&limit=20   — pagination
// ─────────────────────────────────────────────────────────────

const getAvailableSlots = asyncHandler(async (req, res) => {
  const { hostId, startDate, endDate, page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;

  if (!hostId) {
    throw new ApiError("'hostId' query parameter is required", 400);
  }

  // ── Build date filter ───────────────────────────────────────
  const now = new Date();
  const rangeStart = startDate ? parseDate(startDate, "startDate") : now;
  const rangeEnd = endDate ? parseDate(endDate, "endDate") : null;

  // ── Pagination ──────────────────────────────────────────────
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  const skip = (pageNum - 1) * pageSize;

  // ── Query ───────────────────────────────────────────────────
  const filter = {
    host: hostId,
    isBooked: false,
    startTime: { $gte: rangeStart },
  };

  if (rangeEnd) {
    filter.endTime = { $lte: rangeEnd };
  }

  const [slots, total] = await Promise.all([
    TimeSlot.find(filter)
      .populate("host", "name email profileImage timezone")
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    TimeSlot.countDocuments(filter),
  ]);

  sendSuccess(res, 200, "Available slots retrieved successfully", {
    count: slots.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / pageSize),
    slots,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/slots/all
// Get ALL slots for the authenticated host (admin view).
// Includes booked and past slots, with pagination.
// ─────────────────────────────────────────────────────────────

const getAllSlots = asyncHandler(async (req, res) => {
  const { hostId, isBooked, page = 1, limit = DEFAULT_PAGE_SIZE } = req.query;

  const filter = {};

  // Admin can filter by any host; non-admins see only their own
  if (req.user.role === "admin" && hostId) {
    filter.host = hostId;
  } else if (req.user.role !== "admin") {
    filter.host = req.user._id;
  }

  if (isBooked !== undefined) {
    filter.isBooked = isBooked === "true";
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_SIZE));
  const skip = (pageNum - 1) * pageSize;

  const [slots, total] = await Promise.all([
    TimeSlot.find(filter)
      .populate("host", "name email profileImage")
      .populate("bookedBy", "name email profileImage")
      .populate("meetingId", "title status startTime endTime")
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    TimeSlot.countDocuments(filter),
  ]);

  sendSuccess(res, 200, "All slots retrieved successfully", {
    count: slots.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / pageSize),
    slots,
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/slots/:id
// Update an existing time slot.
// Only the host (or admin) can update. Booked slots cannot be
// rescheduled — they must be cancelled first.
// ─────────────────────────────────────────────────────────────

const updateSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startTime: startStr, endTime: endStr } = req.body;

  // ── Find the slot ───────────────────────────────────────────
  const slot = await TimeSlot.findById(id);
  if (!slot) {
    throw new ApiError("Time slot not found", 404);
  }

  // ── Authorization ───────────────────────────────────────────
  if (slot.host.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError("Not authorized to update this slot", 403);
  }

  // ── Cannot update a booked slot ─────────────────────────────
  if (slot.isBooked) {
    throw new ApiError("Cannot modify a booked slot — cancel the meeting first", 400);
  }

  // ── Parse and validate new times ────────────────────────────
  const newStart = startStr ? parseDate(startStr, "startTime") : slot.startTime;
  const newEnd = endStr ? parseDate(endStr, "endTime") : slot.endTime;

  validateTimeWindow(newStart, newEnd);

  if (newStart < new Date()) {
    throw new ApiError("Cannot reschedule a slot to the past", 400);
  }

  // ── Overlap check (exclude self) ────────────────────────────
  await assertNoOverlap(slot.host, newStart, newEnd, slot._id);

  // ── Apply updates ──────────────────────────────────────────
  slot.startTime = newStart;
  slot.endTime = newEnd;
  await slot.save();

  // Broadcast live slot update
  socketService.emitSlotUpdate(slot.host, "updated", slot);

  sendSuccess(res, 200, "Time slot updated", {
    slot,
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/slots/:id
// Delete a time slot. Booked slots cannot be deleted.
// ─────────────────────────────────────────────────────────────

const deleteSlot = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const slot = await TimeSlot.findById(id);
  if (!slot) {
    throw new ApiError("Time slot not found", 404);
  }

  // ── Authorization ───────────────────────────────────────────
  if (slot.host.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError("Not authorized to delete this slot", 403);
  }

  // ── Cannot delete a booked slot ─────────────────────────────
  if (slot.isBooked) {
    throw new ApiError(
      "Cannot delete a booked slot — cancel the associated meeting first",
      400
    );
  }

  await slot.deleteOne();

  // Broadcast live slot deletion
  socketService.emitSlotUpdate(slot.host, "deleted", { id });

  sendSuccess(res, 200, "Time slot deleted");
});

// ─────────────────────────────────────────────────────────────
// GET /api/slots/recommend
// AI-powered slot recommendations.
// Returns top N conflict-free slots scored by preferred hours,
// proximity, time-of-day sweetspot, and buffer time.
//
// Query params:
//   ?hostId=xxx                    — host user (required)
//   ?participantIds=id1,id2        — comma-separated (optional)
//   ?durationMinutes=30            — meeting length (default 30)
//   ?startDate=2026-05-06          — search start (default: now)
//   ?endDate=2026-05-13            — search end (default: +7 days)
//   ?maxResults=3                  — top N (default 3, max 10)
// ─────────────────────────────────────────────────────────────

const getRecommendations = asyncHandler(async (req, res) => {
  const {
    hostId,
    participantIds: participantStr,
    durationMinutes = 30,
    startDate,
    endDate,
    maxResults = 3,
  } = req.query;

  if (!hostId) {
    throw new ApiError("'hostId' query parameter is required", 400);
  }

  const duration = Math.max(10, Math.min(480, parseInt(durationMinutes, 10) || 30));
  const results = Math.max(1, Math.min(10, parseInt(maxResults, 10) || 3));

  // Parse comma-separated participant IDs
  const participantIds = participantStr
    ? participantStr.split(",").map((id) => id.trim()).filter(Boolean)
    : [];

  const recommendations = await aiScheduler.recommendSlots({
    hostId,
    participantIds,
    durationMinutes: duration,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    maxResults: results,
  });

  sendSuccess(res, 200, "Slot recommendations retrieved successfully", {
    count: recommendations.length,
    durationMinutes: duration,
    searchWindow: {
      start: startDate || "now",
      end: endDate || "+7 days",
    },
    recommendations,
  });
});

const checkConflicts = asyncHandler(async (req, res) => {
  const { slots, participants } = req.body;
  if (!Array.isArray(slots) || !Array.isArray(participants)) {
    throw new ApiError("slots and participants must be arrays", 400);
  }

  const Meeting = require("../models/Meeting");
  const User = require("../models/User");

  const conflicts = {};

  for (const slot of slots) {
    const slotId = slot._id || slot.id;
    const start = parseDate(slot.startTime, "startTime");
    const end = parseDate(slot.endTime, "endTime");
    
    const conflictingMembers = [];
    for (const pid of participants) {
      let hasConflict = false;

      // 1. Check existing meetings
      const existing = await Meeting.findConflicts(pid, start, end);
      if (existing.length > 0) {
        hasConflict = true;
      }

      // 2. Check general availability (free windows)
      if (!hasConflict) {
        const freeWindows = await aiScheduler.getFreeWindows(pid, start);
        
        // Convert to minutes since midnight local to the start date
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = end.getHours() * 60 + end.getMinutes();
        
        const isAvailable = freeWindows.some(w => startMin >= w.start && endMin <= w.end);
        if (!isAvailable) {
          hasConflict = true;
        }
      }

      if (hasConflict) {
        const user = await User.findById(pid).select("name").lean();
        conflictingMembers.push({ id: pid, name: user?.name || pid });
      }
    }
    
    if (conflictingMembers.length > 0) {
      conflicts[slotId] = conflictingMembers;
    }
  }

  sendSuccess(res, 200, "Conflicts checked", { conflicts });
});

module.exports = {
  createSlot,
  createBulkSlots,
  getAvailableSlots,
  getAllSlots,
  updateSlot,
  deleteSlot,
  getRecommendations,
  checkConflicts,
};
