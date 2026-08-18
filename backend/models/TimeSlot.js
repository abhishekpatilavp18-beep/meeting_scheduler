const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
// TimeSlot Model — Production-grade schema for AI Meeting Scheduler
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     TimeSlot:
 *       type: object
 *       required: [host, startTime, endTime]
 *       properties:
 *         _id: { type: string, description: "Auto-generated slot ID" }
 *         host: { type: string, description: "User ID of the host" }
 *         startTime: { type: string, format: date-time, description: "Slot start time" }
 *         endTime: { type: string, format: date-time, description: "Slot end time" }
 *         isBooked: { type: boolean, default: false, description: "Whether the slot is taken" }
 *         bookedBy: { type: string, description: "User ID of the booker" }
 *         meetingId: { type: string, description: "Associated meeting ID" }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

const timeSlotSchema = new mongoose.Schema(
  {
    // ── Owner / Host ──────────────────────────────────────────
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Host user is required"],
      // Single-field index removed — covered by compound { host, startTime, isBooked }
    },

    // ── Time Window ───────────────────────────────────────────
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },

    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },

    // ── Booking State ─────────────────────────────────────────
    isBooked: {
      type: Boolean,
      default: false,
      // Single-field index removed — covered by compound { host, startTime, isBooked }
    },

    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Compound Indexes ──────────────────────────────────────────
// Primary query: "all available slots for a host in a date range"
timeSlotSchema.index({ host: 1, startTime: 1, isBooked: 1 });

// Prevent duplicate slots: same host cannot have two slots at the exact same time
timeSlotSchema.index({ host: 1, startTime: 1, endTime: 1 }, { unique: true });

// Slot release by meetingId (cancelMeeting → TimeSlot.findOne({ meetingId }))
timeSlotSchema.index({ meetingId: 1 }, { sparse: true });

// ── Custom Validations ────────────────────────────────────────
timeSlotSchema.pre("validate", function (next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate("endTime", "End time must be after start time");
  }
  next();
});

// ── Virtuals ──────────────────────────────────────────────────

/**
 * Duration in minutes.
 */
timeSlotSchema.virtual("durationMinutes").get(function () {
  if (!this.startTime || !this.endTime) return 0;
  return Math.round((this.endTime - this.startTime) / 60000);
});

/**
 * Whether the slot is in the past.
 */
timeSlotSchema.virtual("isPast").get(function () {
  return this.endTime ? this.endTime < new Date() : false;
});

// ── Static Methods ────────────────────────────────────────────

/**
 * Find all available (unbooked, future) slots for a host within a date range.
 */
timeSlotSchema.statics.findAvailable = function (hostId, startDate, endDate) {
  const now = new Date();
  const query = {
    host: hostId,
    isBooked: false,
    startTime: { $gte: startDate ? new Date(startDate) : now },
  };

  if (endDate) {
    query.endTime = { $lte: new Date(endDate) };
  }

  return this.find(query).sort({ startTime: 1 });
};

/**
 * Book a slot atomically — uses findOneAndUpdate to prevent race conditions.
 * Returns null if the slot is already booked or doesn't exist.
 */
timeSlotSchema.statics.bookSlot = async function (slotId, userId, meetingId) {
  return this.findOneAndUpdate(
    {
      _id: slotId,
      isBooked: false, // only book if still available (atomic guard)
    },
    {
      $set: {
        isBooked: true,
        bookedBy: userId,
        meetingId: meetingId,
      },
    },
    { new: true }
  );
};

/**
 * Release a booked slot (e.g. when a meeting is cancelled).
 */
timeSlotSchema.statics.releaseSlot = async function (slotId) {
  return this.findByIdAndUpdate(
    slotId,
    {
      $set: {
        isBooked: false,
        bookedBy: null,
        meetingId: null,
      },
    },
    { new: true }
  );
};

/**
 * Check for overlapping slots for a given host.
 * Useful when creating new slots to prevent overlaps.
 */
timeSlotSchema.statics.findOverlapping = function (hostId, startTime, endTime, excludeSlotId = null) {
  const query = {
    host: hostId,
    startTime: { $lt: new Date(endTime) },
    endTime: { $gt: new Date(startTime) },
  };

  if (excludeSlotId) {
    query._id = { $ne: excludeSlotId };
  }

  return this.find(query).lean();
};

module.exports = mongoose.model("TimeSlot", timeSlotSchema);
