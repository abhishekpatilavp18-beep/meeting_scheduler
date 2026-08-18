const mongoose = require("mongoose");
const Meeting = require("../models/Meeting");
const TimeSlot = require("../models/TimeSlot");
const User = require("../models/User");
const Organization = require("../models/Organization");
const { generateMeetingLink } = require("../utils/generateLink");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");
const { sendSuccess } = require("../utils/apiResponse");
const socketService = require("../services/socketService");
const calendarService = require("../services/calendarService");
const notificationService = require("../services/notificationService");

// ─────────────────────────────────────────────────────────────
// Meeting Controller — Production-grade Booking Engine
// ─────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────

const parseDate = (dateStr, fieldName) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new ApiError(`Invalid date for '${fieldName}'`, 400);
  return d;
};

/**
 * Populate helper — consistent across all meeting responses.
 */
const populateMeeting = (query) => {
  return query
    .populate("organizer", "name email profileImage timezone")
    .populate("participants.user", "name email profileImage timezone")
    .populate("organization", "name color");
};

/**
 * Notify all participants (socket + email) about a meeting event.
 */
const notifyParticipants = async (meeting, organizer, eventType, overriddenMembers = []) => {
  const messages = {
    booked: `You've been invited to "${meeting.title}" by ${organizer.name}`,
    updated: `"${meeting.title}" has been updated by ${organizer.name}`,
    cancelled: `"${meeting.title}" has been cancelled by ${organizer.name}`,
  };

  const participantIds = meeting.participants
    .map((p) => p.user?._id || p.user)
    .filter(Boolean);

  const usersMap = new Map();
  if ((eventType === "booked" || eventType === "cancelled") && participantIds.length) {
    const users = await User.find({ _id: { $in: participantIds } })
      .select("name email")
      .lean();
    users.forEach((u) => usersMap.set(u._id.toString(), u));
  }

  for (const p of meeting.participants) {
    const pid = p.user?._id || p.user;
    if (!pid) continue;

    let pMessage = `Update on "${meeting.title}"`;
    let notifType = "meeting";

    if (overriddenMembers.includes(pid.toString()) && (eventType === "booked" || eventType === "postponed" || eventType === "updated")) {
      pMessage = `Important meeting scheduled during your unavailable time. Your attendance is requested.`;
      notifType = "urgent";
    } else if (eventType === "booked") {
      pMessage = `You were added to a meeting: "${meeting.title}"`;
    } else if (eventType === "postponed") {
      pMessage = `Meeting has been postponed: "${meeting.title}"`;
    } else if (eventType === "updated") {
      pMessage = `"${meeting.title}" has been updated by ${organizer.name}`;
    } else if (eventType === "cancelled") {
      pMessage = `"${meeting.title}" has been cancelled by ${organizer.name}`;
      notifType = "cancellation";
    }

    // Socket + DB notification (fire-and-forget)
    Promise.resolve(socketService.notifyUser(pid, {
      message: pMessage,
      type: notifType,
      relatedMeeting: meeting._id,
    })).catch(() => {});

    // Email (fire-and-forget)
    const user = usersMap.get(pid.toString());
    if (user && eventType === "booked") {
      const isOverride = overriddenMembers.includes(pid.toString());
      Promise.resolve(notificationService.sendBookingConfirmation(user, meeting, isOverride)).catch(() => {});
    } else if (user && eventType === "cancelled") {
      Promise.resolve(notificationService.sendCancellationEmail(user, meeting, organizer.name)).catch(() => {});
    }
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/meetings/book
// Book a new meeting — with conflict detection & atomic slot lock
// ─────────────────────────────────────────────────────────────

const bookMeeting = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    startTime: startStr,
    endTime: endStr,
    timezone,
    participants: participantInput,
    slotId,
    organization,
    force,
  } = req.body;

  // ── Input validation ────────────────────────────────────────
  if (!title) throw new ApiError("Title is required", 400);
  if (!startStr || !endStr) throw new ApiError("startTime and endTime are required", 400);

  const startTime = parseDate(startStr, "startTime");
  const endTime = parseDate(endStr, "endTime");

  if (endTime <= startTime) {
    throw new ApiError("endTime must be after startTime", 400);
  }

  if (startTime < new Date()) {
    throw new ApiError("Cannot book a meeting in the past", 400);
  }

  // ── Force-flag RBAC guard ─────────────────────────────────
  // Only admin and host roles can use the force override flag
  if (force && req.user.role !== "admin" && req.user.role !== "host") {
    throw new ApiError(
      "Override permission denied — only admin or host roles can force-schedule conflicting meetings",
      403
    );
  }

  // Normalize participants: accept array of IDs or array of { user: id, isPriority }
  let participantsList = (participantInput || []).map((p) => {
    if (typeof p === "string") return { user: p, isPriority: false };
    return { user: p.user || p.id || p, isPriority: Boolean(p.isPriority) };
  });

  // ── Auto-resolve organization members ──────────────────────
  // When an organization is specified, look up its members and
  // merge them into the participants list so notifications and
  // meeting access are correct even if the frontend doesn't
  // explicitly send every org member.
  if (organization) {
    try {
      const org = await Organization.findById(organization).lean();
      if (org && org.members && org.members.length > 0) {
        const existingIds = new Set(participantsList.map(p => p.user.toString()));
        for (const m of org.members) {
          const mId = (m.user || m).toString();
          // Skip the organizer (they are not a participant) and existing entries
          if (mId === req.user._id.toString()) continue;
          if (existingIds.has(mId)) continue;
          participantsList.push({ user: mId, isPriority: false });
          existingIds.add(mId);
        }
      }
    } catch (orgErr) {
      // Non-fatal — log and continue with explicit participants
      console.error("Failed to resolve organization members:", orgErr.message);
    }
  }

  const participantIds = participantsList.map(p => p.user);
  const priorityParticipantIds = participantsList.filter(p => p.isPriority).map(p => p.user);

  // ── Conflict detection for organizer ────────────────────────
  if (!force || (req.user.role !== "admin" && req.user.role !== "host")) {
    const organizerConflicts = await Meeting.findConflicts(req.user._id, startTime, endTime);
    if (organizerConflicts.length > 0) {
      throw new ApiError(
        `You have a conflicting meeting: "${organizerConflicts[0].title}"`,
        409
      );
    }
  }


  // ── Conflict detection for priority participants ───────
  let overriddenPriorityMembers = [];
  if (priorityParticipantIds.length > 0) {
    const aiScheduler = require("../services/aiSchedulerService");
    const unavailableMembers = [];
    
    for (let i = 0; i < priorityParticipantIds.length; i++) {
      const pid = priorityParticipantIds[i];
      let hasConflict = false;

      // 1. Check existing meetings
      const existing = await Meeting.findConflicts(pid, startTime, endTime);
      if (existing.length > 0) {
        hasConflict = true;
      }

      // 2. Check general availability
      if (!hasConflict) {
        const freeWindows = await aiScheduler.getFreeWindows(pid, startTime);
        const startMin = startTime.getHours() * 60 + startTime.getMinutes();
        const endMin = endTime.getHours() * 60 + endTime.getMinutes();
        const isAvailable = freeWindows.some(w => startMin >= w.start && endMin <= w.end);
        if (!isAvailable) {
          hasConflict = true;
        }
      }

      if (hasConflict) {
        const user = await User.findById(pid).select("name email").lean();
        unavailableMembers.push({ id: pid, name: user?.name || pid });
      }
    }

    if (unavailableMembers.length > 0) {
      if (!force || (req.user.role !== "admin" && req.user.role !== "host")) {
        return res.status(409).json({
          success: false,
          error: "PRIORITY_CONFLICT",
          message: "One or more priority participants are unavailable.",
          unavailableMembers
        });
      } else {
        overriddenPriorityMembers = unavailableMembers.map(m => m.id.toString());
      }
    }
  }

  // ── Atomic slot booking (if slotId provided) ────────────────
  let bookedSlot = null;
  if (slotId && mongoose.Types.ObjectId.isValid(slotId)) {
    // Atomically lock the slot — prevents race conditions
    bookedSlot = await TimeSlot.bookSlot(slotId, req.user._id, null);
    if (!bookedSlot) {
      throw new ApiError("Time slot is no longer available (already booked)", 409);
    }
  }

  // ── Create the meeting ──────────────────────────────────────
  try {
    const meetingData = {
      title,
      description: description || "",
      organizer: req.user._id,
      organization: organization || null,
      participants: participantsList.map((p) => ({ user: p.user, rsvp: "pending", isPriority: p.isPriority })),
      startTime,
      endTime,
      timezone: timezone || req.user.timezone || "UTC",
      meetingLink: "",
      status: "scheduled",
    };

    // ── Store override audit trail if force-booked ───────────
    if (force && overriddenPriorityMembers.length > 0) {
      meetingData.overrideConfirmed = true;
      meetingData.overrideDetails = {
        overriddenBy: req.user._id,
        overriddenAt: new Date(),
        affectedParticipants: overriddenPriorityMembers,
        reason: "Admin/host override — priority participants unavailable",
      };
    }

    const meeting = await Meeting.create(meetingData);

    // Generate and save the meeting link
    meeting.meetingLink = generateMeetingLink(meeting._id);
    await meeting.save();

    // Update the slot with the meeting ID (if slot was booked)
    if (bookedSlot) {
      bookedSlot.meetingId = meeting._id;
      await bookedSlot.save();
    }

    // Batch-update all user meeting arrays in a single bulkWrite
    const userOps = [
      {
        updateOne: {
          filter: { _id: req.user._id },
          update: { $addToSet: { createdMeetings: meeting._id } },
        },
      },
      ...participantIds.map((pid) => ({
        updateOne: {
          filter: { _id: pid },
          update: { $addToSet: { bookedMeetings: meeting._id } },
        },
      })),
    ];
    if (userOps.length > 0) {
      await User.bulkWrite(userOps);
    }

    // ── Populate and respond ──────────────────────────────────
    const populated = await populateMeeting(Meeting.findById(meeting._id));

    // ── Notify participants (async, non-blocking) ─────────────
    const organizer = await User.findById(req.user._id).select("name email").lean();
    notifyParticipants(populated, organizer, "booked", overriddenPriorityMembers);

    // ── Organizer in-app notification ─────────────────────────
    // The organizer is not in the participants list, so give them
    // a confirmation notification separately.
    Promise.resolve(socketService.notifyUser(req.user._id, {
      message: `Your meeting "${populated.title}" has been scheduled successfully`,
      type: "meeting",
      relatedMeeting: populated._id,
    })).catch(() => {});

    notificationService.sendBookingConfirmation(organizer, populated).catch(() => {});

    // ── Sync to External Calendar (async, non-blocking) ───────
    calendarService.syncToExternalCalendar(req.user._id, meeting._id).catch((err) => {
      console.error("External calendar sync failed:", err.message);
    });

    // ── Real-time synchronization ─────────────────────────────
    // Update the host's public slot list
    socketService.emitSlotUpdate(req.user._id, "booked", { slotId });
    // Refresh dashboards for all participants
    socketService.emitDashboardUpdate(req.user._id, "meeting_created");
    participantIds.forEach(pid => socketService.emitDashboardUpdate(pid, "meeting_created"));

    sendSuccess(res, 201, "Meeting booked successfully", {
      meeting: populated,
    });
  } catch (err) {
    // Rollback: release the slot if meeting creation failed
    if (bookedSlot) {
      await TimeSlot.releaseSlot(bookedSlot._id);
    }
    throw err;
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/meetings/:id
// Update an existing meeting (organizer or admin only)
// ─────────────────────────────────────────────────────────────

const updateMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const meeting = await Meeting.findById(id);

  if (!meeting) throw new ApiError("Meeting not found", 404);

  // ── Authorization ───────────────────────────────────────────
  if (meeting.organizer.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError("Not authorized to update this meeting", 403);
  }

  if (meeting.status === "cancelled") {
    throw new ApiError("Cannot update a cancelled meeting", 400);
  }

  // ── Validate time changes ───────────────────────────────────
  const {
    title,
    description,
    startTime: startStr,
    endTime: endStr,
    timezone,
    participants: participantInput,
    force,
  } = req.body;

  const newStart = startStr ? parseDate(startStr, "startTime") : meeting.startTime;
  const newEnd = endStr ? parseDate(endStr, "endTime") : meeting.endTime;

  if (newEnd <= newStart) {
    throw new ApiError("endTime must be after startTime", 400);
  }

  // ── Force-flag RBAC guard ─────────────────────────────────
  if (force && req.user.role !== "admin" && req.user.role !== "host") {
    throw new ApiError(
      "Override permission denied — only admin or host roles can force-reschedule conflicting meetings",
      403
    );
  }

  // ── Conflict check for time changes ─────────────────────────
  const timeChanged =
    newStart.getTime() !== meeting.startTime.getTime() ||
    newEnd.getTime() !== meeting.endTime.getTime();

  // Normalize participants:
  let participantsList = [];
  if (participantInput) {
    participantsList = participantInput.map((p) => {
      if (typeof p === "string") return { user: p, isPriority: false };
      return { user: p.user || p.id || p, isPriority: Boolean(p.isPriority) };
    });
  } else {
    participantsList = meeting.participants.map(p => ({ user: p.user.toString(), isPriority: p.isPriority }));
  }

  const priorityParticipantIds = participantsList.filter(p => p.isPriority).map(p => p.user);

  let overriddenPriorityMembers = [];
  if (timeChanged) {
    if (!force || (req.user.role !== "admin" && req.user.role !== "host")) {
      // Check organizer conflicts (exclude this meeting)
      const orgConflicts = await Meeting.findConflicts(meeting.organizer, newStart, newEnd, meeting._id);
      if (orgConflicts.length > 0) {
        throw new ApiError(`Time conflict with "${orgConflicts[0].title}"`, 409);
      }
    }


    // Check priority participant conflicts
    if (priorityParticipantIds.length > 0) {
      const aiScheduler = require("../services/aiSchedulerService");
      const unavailableMembers = [];
      
      for (let i = 0; i < priorityParticipantIds.length; i++) {
        const pid = priorityParticipantIds[i];
        let hasConflict = false;

        // 1. Check existing meetings
        const existing = await Meeting.findConflicts(pid, newStart, newEnd, meeting._id);
        if (existing.length > 0) {
          hasConflict = true;
        }

        // 2. Check general availability
        if (!hasConflict) {
          const freeWindows = await aiScheduler.getFreeWindows(pid, newStart);
          const startMin = newStart.getHours() * 60 + newStart.getMinutes();
          const endMin = newEnd.getHours() * 60 + newEnd.getMinutes();
          const isAvailable = freeWindows.some(w => startMin >= w.start && endMin <= w.end);
          if (!isAvailable) {
            hasConflict = true;
          }
        }

        if (hasConflict) {
          const user = await User.findById(pid).select("name email").lean();
          unavailableMembers.push({ id: pid, name: user?.name || pid });
        }
      }

      if (unavailableMembers.length > 0) {
        if (!force || (req.user.role !== "admin" && req.user.role !== "host")) {
          return res.status(409).json({
            success: false,
            error: "PRIORITY_CONFLICT",
            message: "One or more priority participants are unavailable.",
            unavailableMembers
          });
        } else {
          overriddenPriorityMembers = unavailableMembers.map(m => m.id.toString());
        }
      }
    }
  }

  // ── Apply updates ───────────────────────────────────────────
  if (title) meeting.title = title;
  if (description !== undefined) meeting.description = description;
  if (timezone) meeting.timezone = timezone;
  meeting.startTime = newStart;
  meeting.endTime = newEnd;

  // Handle participant changes
  if (participantInput) {
    meeting.participants = participantsList.map((p) => ({
      user: p.user,
      rsvp: "pending",
      isPriority: p.isPriority,
    }));
  }

  // ── Store override audit trail if force-updated ───────────
  if (force && overriddenPriorityMembers.length > 0) {
    meeting.overrideConfirmed = true;
    meeting.overrideDetails = {
      overriddenBy: req.user._id,
      overriddenAt: new Date(),
      affectedParticipants: overriddenPriorityMembers,
      reason: "Admin/host override on update — priority participants unavailable",
    };
  }

  await meeting.save();

  const populated = await populateMeeting(Meeting.findById(meeting._id));

  // Notify about the update
  const organizer = await User.findById(req.user._id).select("name email").lean();
  notifyParticipants(populated, organizer, timeChanged ? "postponed" : "updated", overriddenPriorityMembers);

  // Sync update to External Calendar (async)
  calendarService.updateExternalCalendar(req.user._id, meeting._id).catch((err) => {
    console.error("External calendar update failed:", err.message);
  });

  // ── Real-time dashboard refresh ─────────────────────────────
  socketService.emitDashboardUpdate(meeting.organizer, "meeting_updated");
  meeting.participants.forEach(p => socketService.emitDashboardUpdate(p.user, "meeting_updated"));

  sendSuccess(res, 200, "Meeting updated successfully", {
    meeting: populated,
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/meetings/:id
// Cancel a meeting — releases the associated slot
// ─────────────────────────────────────────────────────────────

const cancelMeeting = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const meeting = await Meeting.findById(id);

  if (!meeting) throw new ApiError("Meeting not found", 404);

  // ── Authorization ───────────────────────────────────────────
  if (meeting.organizer.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    throw new ApiError("Not authorized to cancel this meeting", 403);
  }

  if (meeting.status === "cancelled") {
    throw new ApiError("Meeting is already cancelled", 400);
  }

  // ── Release the associated time slot ────────────────────────
  const bookedSlot = await TimeSlot.findOne({ meetingId: meeting._id });
  if (bookedSlot) {
    await TimeSlot.releaseSlot(bookedSlot._id);
  }

  // ── Mark meeting as cancelled (soft delete) ─────────────────
  meeting.status = "cancelled";
  await meeting.save();

  // ── Remove from users' meeting arrays (batched) ────────────
  const pullOps = [
    {
      updateOne: {
        filter: { _id: meeting.organizer },
        update: { $pull: { createdMeetings: meeting._id } },
      },
    },
    ...meeting.participants.map((p) => ({
      updateOne: {
        filter: { _id: p.user },
        update: { $pull: { bookedMeetings: meeting._id } },
      },
    })),
  ];
  await User.bulkWrite(pullOps);

  // ── Notify participants ─────────────────────────────────────
  const organizer = await User.findById(req.user._id).select("name email").lean();
  notifyParticipants(meeting, organizer, "cancelled");

  // ── Remove from External Calendar (async) ───────────────────
  if (meeting.calendarEventId) {
    calendarService.removeFromExternalCalendar(req.user._id, meeting.calendarEventId).catch((err) => {
      console.error("External calendar delete failed:", err.message);
    });
  }

  // ── Real-time synchronization ─────────────────────────────
  // Release slot on public view
  const slotId = bookedSlot?._id;
  if (slotId) {
    socketService.emitSlotUpdate(meeting.organizer, "unbooked", { slotId });
  }
  // Refresh dashboards
  socketService.emitDashboardUpdate(meeting.organizer, "meeting_cancelled");
  meeting.participants.forEach(p => socketService.emitDashboardUpdate(p.user, "meeting_cancelled"));

  sendSuccess(res, 200, "Meeting cancelled successfully");
});

// ─────────────────────────────────────────────────────────────
// GET /api/meetings/my-meetings
// Get all meetings for the authenticated user (paginated)
//
// Query params:
//   ?status=scheduled         — filter by status
//   ?startDate=xxx&endDate=xx — filter by date range
//   ?page=1&limit=20          — pagination
// ─────────────────────────────────────────────────────────────

const getMyMeetings = asyncHandler(async (req, res) => {
  const {
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query;

  const userId = req.user._id;

  const filter = {
    $or: [
      { organizer: userId },
      { "participants.user": userId },
    ],
  };

  if (status) filter.status = status;

  if (startDate || endDate) {
    if (startDate) filter.startTime = { ...filter.startTime, $gte: parseDate(startDate, "startDate") };
    if (endDate) filter.endTime = { ...filter.endTime, $lte: parseDate(endDate, "endDate") };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * pageSize;

  const [meetings, total] = await Promise.all([
    populateMeeting(Meeting.find(filter))
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Meeting.countDocuments(filter),
  ]);

  sendSuccess(res, 200, "Meetings retrieved successfully", {
    count: meetings.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / pageSize),
    meetings,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/meetings/:id
// Get a single meeting by ID
// ─────────────────────────────────────────────────────────────

const getMeeting = asyncHandler(async (req, res) => {
  const meeting = await populateMeeting(Meeting.findById(req.params.id));

  if (!meeting) throw new ApiError("Meeting not found", 404);

  sendSuccess(res, 200, "Meeting retrieved successfully", {
    meeting,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/meetings/all (admin)
// Get all meetings in the system (paginated)
// ─────────────────────────────────────────────────────────────

const getAllMeetings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * pageSize;

  const [meetings, total] = await Promise.all([
    populateMeeting(Meeting.find(filter))
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Meeting.countDocuments(filter),
  ]);

  sendSuccess(res, 200, "All meetings retrieved successfully", {
    count: meetings.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / pageSize),
    meetings,
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/meetings/room/:roomId
// Validate a room and return meeting details + Jitsi config.
// Used by the frontend VideoRoom component before mounting Jitsi.
// ─────────────────────────────────────────────────────────────

const getMeetingByRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;

  // Find meeting by its meeting link path
  const meeting = await populateMeeting(
    Meeting.findOne({ meetingLink: `/room/${roomId}` })
  );

  if (!meeting) {
    throw new ApiError("Meeting room not found", 404);
  }

  if (meeting.status === "cancelled") {
    throw new ApiError("This meeting has been cancelled", 410);
  }

  // Check if meeting has ended (endTime + 30 min grace period)
  const gracePeriodMs = 30 * 60 * 1000;
  if (new Date(meeting.endTime).getTime() + gracePeriodMs < Date.now()) {
    throw new ApiError("This meeting has already ended", 410);
  }

  const { JITSI_DOMAIN } = require("../utils/generateLink");

  sendSuccess(res, 200, "Meeting room validated successfully", {
    meeting,
    jitsi: {
      domain: JITSI_DOMAIN,
      roomName: roomId,
    },
  });
});

module.exports = {
  bookMeeting,
  updateMeeting,
  cancelMeeting,
  getMyMeetings,
  getMeeting,
  getAllMeetings,
  getMeetingByRoom,
};
