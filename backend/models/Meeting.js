const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
// Meeting Model — Production-grade schema for AI Meeting Scheduler
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Meeting:
 *       type: object
 *       required: [title, organizer, startTime, endTime]
 *       properties:
 *         _id: { type: string, description: "Auto-generated meeting ID" }
 *         title: { type: string, description: "Meeting title" }
 *         description: { type: string, description: "Detailed description" }
 *         organizer: { type: string, description: "User ID of the organizer" }
 *         participants:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               user: { type: string, description: "User ID" }
 *               rsvp: { type: string, enum: [pending, accepted, declined, tentative] }
 *               joinedAt: { type: string, format: date-time }
 *         startTime: { type: string, format: date-time, description: "Meeting start time" }
 *         endTime: { type: string, format: date-time, description: "Meeting end time" }
 *         timezone: { type: string, default: UTC }
 *         meetingLink: { type: string, description: "Jitsi or external meeting link" }
 *         status: { type: string, enum: [scheduled, in-progress, completed, cancelled] }
 *         calendarEventId: { type: string, description: "External calendar event ID" }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

const meetingSchema = new mongoose.Schema(
  {
    // ── Core Details ──────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // ── People ────────────────────────────────────────────────
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Organizer is required"],
      index: true,
    },
    
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rsvp: {
          type: String,
          enum: ["pending", "accepted", "declined", "tentative"],
          default: "pending",
        },
        joinedAt: {
          type: Date,
          default: null,
        },
        isPriority: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // ── Schedule ──────────────────────────────────────────────
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },

    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },

    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },

    // ── Meeting Access ────────────────────────────────────────
    meetingLink: {
      type: String,
      default: "",
      trim: true,
    },

    // ── Status Tracking ───────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ["scheduled", "in-progress", "completed", "cancelled"],
        message: "Status must be one of: scheduled, in-progress, completed, cancelled",
      },
      default: "scheduled",
      index: true,
    },

    // ── External Integrations ─────────────────────────────────
    calendarEventId: {
      type: String,
      default: null,
      trim: true,
    },

    // ── Reminders ─────────────────────────────────────────────
    remindersSent: {
      type: Boolean,
      default: false,
    },

    remindersLog: [
      {
        sentAt: {
          type: Date,
          required: true,
        },
        channel: {
          type: String,
          enum: ["email", "push", "socket"],
          required: true,
        },
        recipientCount: {
          type: Number,
          default: 0,
        },
      },
    ],

    // ── Override Audit Trail ──────────────────────────────────
    overrideConfirmed: {
      type: Boolean,
      default: false,
    },

    overrideDetails: {
      overriddenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      overriddenAt: {
        type: Date,
        default: null,
      },
      affectedParticipants: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      reason: {
        type: String,
        default: "Admin override — priority participants unavailable",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Compound Indexes for Scheduling Queries ───────────────────
// Fast lookups: "all scheduled meetings for a user in a date range"
meetingSchema.index({ organizer: 1, startTime: 1, status: 1 });
meetingSchema.index({ "participants.user": 1, startTime: 1, endTime: 1 });
meetingSchema.index({ startTime: 1, endTime: 1, status: 1 });

// Reminder service: find meetings needing reminders
meetingSchema.index({ remindersSent: 1, status: 1, startTime: 1 });

// Room lookup by meeting link (getMeetingByRoom)
meetingSchema.index({ meetingLink: 1 }, { sparse: true });

// ── Custom Validations ────────────────────────────────────────
meetingSchema.pre("validate", function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate("endTime", "End time must be after start time");
  }
  next();
});

// ── Virtuals ──────────────────────────────────────────────────

/**
 * Duration in minutes.
 */
meetingSchema.virtual("durationMinutes").get(function () {
  if (!this.startTime || !this.endTime) return 0;
  return Math.round((this.endTime - this.startTime) / 60000);
});

/**
 * Whether the meeting is in the past.
 */
meetingSchema.virtual("isPast").get(function () {
  return this.endTime ? this.endTime < new Date() : false;
});

/**
 * Total participant count (excluding organizer).
 */
meetingSchema.virtual("participantCount").get(function () {
  return this.participants ? this.participants.length : 0;
});

// ── Static Methods ────────────────────────────────────────────

/**
 * Find all meetings for a given user (as organizer OR participant)
 * within a date range.
 */
meetingSchema.statics.findByUserAndRange = function (userId, startDate, endDate) {
  return this.find({
    $or: [
      { organizer: userId },
      { "participants.user": userId },
    ],
    startTime: { $lte: new Date(endDate) },
    endTime: { $gte: new Date(startDate) },
    status: { $ne: "cancelled" },
  })
    .populate("organizer", "name email profileImage")
    .populate("participants.user", "name email profileImage")
    .sort({ startTime: 1 })
    .lean();
};

/**
 * Check for time conflicts for a user within a given window.
 * Returns conflicting meetings (empty array = no conflict).
 */
meetingSchema.statics.findConflicts = function (userId, startTime, endTime, excludeMeetingId = null) {
  const query = {
    $or: [
      { organizer: userId },
      { "participants.user": userId },
    ],
    status: { $nin: ["cancelled", "completed"] },
    // Overlap condition: existing.start < new.end AND existing.end > new.start
    startTime: { $lt: new Date(endTime) },
    endTime: { $gt: new Date(startTime) },
  };

  if (excludeMeetingId) {
    query._id = { $ne: excludeMeetingId };
  }

  return this.find(query).lean();
};

module.exports = mongoose.model("Meeting", meetingSchema);
