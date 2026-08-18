const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
// Availability Model — Production-grade schema for AI Meeting Scheduler
// ─────────────────────────────────────────────────────────────

/**
 * Sub-schema for a single time block within a day.
 * Example: { startTime: "09:00", endTime: "12:00", preferred: true }
 */
const timeBlockSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: [true, "Block start time is required"],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format (e.g. 09:00)"],
    },
    endTime: {
      type: String,
      required: [true, "Block end time is required"],
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format (e.g. 17:00)"],
    },
    preferred: {
      type: Boolean,
      default: false, // true = user prefers meetings during this window
    },
  },
  { _id: false }
);

/**
 * Sub-schema for a single day's recurring weekly schedule.
 */
const weeklySlotSchema = new mongoose.Schema(
  {
    day: {
      type: Number,
      required: [true, "Day of week is required"],
      min: [0, "Day must be 0 (Sunday) to 6 (Saturday)"],
      max: [6, "Day must be 0 (Sunday) to 6 (Saturday)"],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    timeBlocks: {
      type: [timeBlockSchema],
      default: [],
      validate: {
        validator: function (blocks) {
          if (!this.isAvailable) return true; // no blocks needed if unavailable
          return blocks.length > 0;
        },
        message: "At least one time block is required when the day is marked available",
      },
    },
  },
  { _id: false }
);

/**
 * Sub-schema for a date-specific override (vacation, special hours, etc.).
 */
const unavailableDateSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Override date is required"],
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Reason cannot exceed 200 characters"],
    },
    isFullDay: {
      type: Boolean,
      default: true, // true = blocked all day; false = use overrideBlocks
    },
    overrideBlocks: {
      type: [timeBlockSchema],
      default: [], // partial-day override: specific blocked/available windows
    },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     Availability:
 *       type: object
 *       required: [userId]
 *       properties:
 *         _id: { type: string, description: "Auto-generated availability ID" }
 *         userId: { type: string, description: "User ID" }
 *         timezone: { type: string, default: UTC }
 *         weeklySchedule:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               day: { type: integer, minimum: 0, maximum: 6 }
 *               isAvailable: { type: boolean }
 *               timeBlocks:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime: { type: string, pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" }
 *                     endTime: { type: string, pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" }
 *                     preferred: { type: boolean }
 *         preferredHours:
 *           type: object
 *           properties:
 *             startTime: { type: string }
 *             endTime: { type: string }
 *         unavailableDates:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date: { type: string, format: date }
 *               reason: { type: string }
 *               isFullDay: { type: boolean }
 *               overrideBlocks: { type: array, items: { type: object } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

const availabilitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true, // one availability document per user
      index: true,
    },

    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },

    // ── Recurring Weekly Schedule ─────────────────────────────
    // Array of up to 7 entries (one per weekday).
    weeklySchedule: {
      type: [weeklySlotSchema],
      default: [
        { day: 0, isAvailable: false, timeBlocks: [] },
        { day: 1, isAvailable: true, timeBlocks: [{ startTime: "09:00", endTime: "17:00" }] },
        { day: 2, isAvailable: true, timeBlocks: [{ startTime: "09:00", endTime: "17:00" }] },
        { day: 3, isAvailable: true, timeBlocks: [{ startTime: "09:00", endTime: "17:00" }] },
        { day: 4, isAvailable: true, timeBlocks: [{ startTime: "09:00", endTime: "17:00" }] },
        { day: 5, isAvailable: true, timeBlocks: [{ startTime: "09:00", endTime: "17:00" }] },
        { day: 6, isAvailable: false, timeBlocks: [] },
      ],
      validate: {
        validator: function (arr) {
          return arr.length <= 7;
        },
        message: "Weekly schedule cannot have more than 7 entries",
      },
    },

    // ── Preferred Hours ───────────────────────────────────────
    // Global preferred meeting window (AI scheduler prioritises these).
    preferredHours: {
      startTime: {
        type: String,
        default: "09:00",
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format"],
      },
      endTime: {
        type: String,
        default: "17:00",
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:mm format"],
      },
    },

    // ── Unavailable Dates (overrides) ─────────────────────────
    // One-off exceptions: vacations, sick days, special schedules.
    unavailableDates: {
      type: [unavailableDateSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────
// Fast lookup of overrides in a date range
availabilitySchema.index({ "unavailableDates.date": 1 });

// ── Virtuals ──────────────────────────────────────────────────

/**
 * Returns the days the user is available (as day numbers).
 */
availabilitySchema.virtual("availableDays").get(function () {
  return this.weeklySchedule.filter((s) => s.isAvailable).map((s) => s.day);
});

// ── Static Methods ────────────────────────────────────────────

/**
 * Get or create the availability document for a user.
 * Ensures every user has exactly one availability record.
 */
availabilitySchema.statics.getOrCreate = async function (userId) {
  let doc = await this.findOne({ userId });
  if (!doc) {
    doc = await this.create({ userId });
  }
  return doc;
};

/**
 * Get effective availability for a user on a specific date.
 * Returns { isAvailable, timeBlocks, isOverride } or null.
 *
 * Priority: unavailableDates override > weeklySchedule rule.
 */
availabilitySchema.statics.getForDate = async function (userId, date) {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();

  const doc = await this.findOne({ userId });
  if (!doc) return null;

  // 1. Check for a date-specific override
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const override = doc.unavailableDates.find(
    (u) => u.date >= startOfDay && u.date <= endOfDay
  );

  if (override) {
    if (override.isFullDay) {
      return { isAvailable: false, timeBlocks: [], isOverride: true, reason: override.reason };
    }
    // Partial-day override: return the override blocks
    return { isAvailable: true, timeBlocks: override.overrideBlocks, isOverride: true, reason: override.reason };
  }

  // 2. Fall back to the recurring weekly schedule
  const daySchedule = doc.weeklySchedule.find((s) => s.day === dayOfWeek);
  if (!daySchedule) {
    return { isAvailable: false, timeBlocks: [], isOverride: false, reason: "" };
  }

  return {
    isAvailable: daySchedule.isAvailable,
    timeBlocks: daySchedule.isAvailable ? daySchedule.timeBlocks : [],
    isOverride: false,
    reason: "",
  };
};

/**
 * Get all time blocks across a date range for a user.
 * Useful for the AI scheduler to compute free windows.
 */
availabilitySchema.statics.getForRange = async function (userId, startDate, endDate) {
  // Fetch the availability document ONCE instead of once per day (eliminates N+1)
  const doc = await this.findOne({ userId }).lean();
  if (!doc) return [];

  const results = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getDay();

    // 1. Check for a date-specific override
    const dayStart = new Date(current);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const override = (doc.unavailableDates || []).find(
      (u) => new Date(u.date) >= dayStart && new Date(u.date) <= dayEnd
    );

    if (override) {
      if (!override.isFullDay && override.overrideBlocks?.length) {
        results.push({
          date: new Date(current),
          timeBlocks: override.overrideBlocks,
          isOverride: true,
        });
      }
      // Full-day override = skip day
    } else {
      // 2. Fall back to weekly schedule
      const daySchedule = (doc.weeklySchedule || []).find((s) => s.day === dayOfWeek);
      if (daySchedule && daySchedule.isAvailable && daySchedule.timeBlocks?.length) {
        results.push({
          date: new Date(current),
          timeBlocks: daySchedule.timeBlocks,
          isOverride: false,
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return results;
};

module.exports = mongoose.model("Availability", availabilitySchema);
