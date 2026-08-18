const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ─────────────────────────────────────────────────────────────
// User Model — Production-grade schema for AI Meeting Scheduler
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required: [name, email, password]
 *       properties:
 *         _id: { type: string, description: "Auto-generated user ID" }
 *         name: { type: string, description: "User full name" }
 *         email: { type: string, format: email, description: "Unique email address" }
 *         role: { type: string, enum: [member, host, admin], default: member }
 *         timezone: { type: string, default: UTC }
 *         profileImage: { type: string }
 *         googleTokens:
 *           type: object
 *           properties:
 *             access_token: { type: string }
 *             refresh_token: { type: string }
 *             expiry_date: { type: number }
 *         createdMeetings: { type: array, items: { type: string } }
 *         bookedMeetings: { type: array, items: { type: string } }
 *         notifications: { type: array, items: { type: object } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never return in queries by default
    },

    // ── Role & Profile ────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ["member", "host", "admin"],
        message: "Role must be 'member', 'host', or 'admin'",
      },
      default: "member",
    },

    profileImage: {
      type: String,
      default: "",
      trim: true,
    },

    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },

    country: {
      type: String,
      default: "",
      trim: true,
    },

    isDemoAccount: {
      type: Boolean,
      default: false,
    },

    // ── External Integrations ─────────────────────────────────
    googleTokens: {
      access_token: { type: String, default: null },
      refresh_token: { type: String, default: null },
      expiry_date: { type: Number, default: null },
    },

    // ── Meeting References (virtual-friendly ObjectId arrays) ─
    createdMeetings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
      },
    ],

    bookedMeetings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
      },
    ],

    // ── Notifications (embedded sub-documents) ────────────────
    notifications: [
      {
        message: {
          type: String,
          required: true,
        },
        read: {
          type: Boolean,
          default: false,
        },
        type: {
          type: String,
          enum: ["meeting", "reminder", "cancellation", "system", "urgent"],
          default: "system",
        },
        relatedMeeting: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Meeting",
          default: null,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    
    // ── Availability Settings ─────────────────────────────────
    availabilityConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────
// Unique email is already enforced by `unique: true` above, which
// creates an index. Add a compound index for role-based queries.
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ "notifications.read": 1 });

// ── Virtuals ──────────────────────────────────────────────────
userSchema.virtual("unreadNotifications").get(function () {
  return (this.notifications || []).filter((n) => !n.read).length;
});

// ── Pre-save: Hash password ──────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance Methods ──────────────────────────────────────────

/**
 * Compare a candidate password against the stored hash.
 * @param {string} candidatePassword — plain-text password to verify
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Return a safe JSON representation (strips password even if selected).
 */
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
