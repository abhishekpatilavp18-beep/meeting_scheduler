const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");
const { sendSuccess } = require("../utils/apiResponse");

// ─────────────────────────────────────────────────────────────
// Auth Controller — Production-grade JWT Authentication
// ─────────────────────────────────────────────────────────────

// ── Token Generation ──────────────────────────────────────────

/**
 * Generate a signed JWT for a given user ID.
 * Token payload is kept minimal (just the user ID) to avoid
 * stale data in long-lived tokens.
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || "7d",
      issuer: "hackhive-scheduler",
      audience: "hackhive-client",
      algorithm: "HS256",
    }
  );
};

/**
 * Build a sanitized user object safe for API responses.
 * Never exposes password, __v, or internal Mongoose fields.
 */
const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage,
  timezone: user.timezone,
  country: user.country,
  availabilityConfig: user.availabilityConfig,
  createdMeetings: user.createdMeetings,
  bookedMeetings: user.bookedMeetings,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────

const register = asyncHandler(async (req, res) => {
  const { name, email, password, timezone, country, role } = req.body;

  // ── Input validation ────────────────────────────────────────
  if (!name || !email || !password) {
    throw new ApiError("Name, email, and password are required", 400);
  }

  let userRole = "member";
  if (role) {
    if (role === "admin") {
      throw new ApiError("Cannot register as an admin", 403);
    }
    if (!["host", "member"].includes(role)) {
      throw new ApiError("Invalid role selected", 400);
    }
    userRole = role;
  }

  // Strong password policy
  if (password.length < 8) {
    throw new ApiError("Password must be at least 8 characters", 400);
  }
  if (!/[A-Z]/.test(password)) {
    throw new ApiError("Password must contain at least one uppercase letter", 400);
  }
  if (!/[a-z]/.test(password)) {
    throw new ApiError("Password must contain at least one lowercase letter", 400);
  }
  if (!/[0-9]/.test(password)) {
    throw new ApiError("Password must contain at least one number", 400);
  }

  // ── Check for existing user ─────────────────────────────────
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError("An account with this email already exists", 409);
  }

  // ── Create user ─────────────────────────────────────────────
  // Password hashing is handled by the User model pre-save hook.
  const user = await User.create({
    name,
    email,
    password,
    timezone: timezone || "UTC",
    country: country || "",
    role: userRole,
  });

  // ── Generate token & respond ────────────────────────────────
  const token = generateToken(user);

  sendSuccess(res, 201, "Account created successfully", {
    token,
    user: sanitizeUser(user),
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ── Input validation ────────────────────────────────────────
  if (!email || !password) {
    throw new ApiError("Email and password are required", 400);
  }

  // ── Find user (explicitly include password for comparison) ──
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

  if (!user) {
    // Generic message — don't reveal whether the email exists
    throw new ApiError("Invalid email or password", 401);
  }

  // ── Verify password ─────────────────────────────────────────
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError("Invalid email or password", 401);
  }

  // ── Generate token & respond ────────────────────────────────
  const token = generateToken(user);

  sendSuccess(res, 200, "Login successful", {
    token,
    user: sanitizeUser(user),
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────

const getMe = asyncHandler(async (req, res) => {
  // req.user is attached by the protect middleware (password excluded)
  const user = await User.findById(req.user._id)
    .populate("createdMeetings", "title startTime endTime status")
    .populate("bookedMeetings", "title startTime endTime status");

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  sendSuccess(res, 200, "User profile retrieved successfully", {
    user: {
      ...sanitizeUser(user),
      notifications: user.notifications,
      unreadNotifications: user.unreadNotifications,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// ─────────────────────────────────────────────────────────────

const updateProfile = asyncHandler(async (req, res) => {
  const { name, password, timezone, country, role, availabilityConfig } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // ── SECURITY: Block role escalation via profile update ──────
  if (role !== undefined) {
    throw new ApiError("Role cannot be changed via profile update", 403);
  }

  // ── FIX: Normalize legacy role values ──────────────────────
  // Some users were created with role="user" before the enum was
  // standardized to ["member","host","admin"]. Without this fix,
  // user.save() triggers full-document validation and REJECTS the
  // entire save — silently dropping availability config updates.
  const validRoles = ["member", "host", "admin"];
  if (!validRoles.includes(user.role)) {
    user.role = "member";
  }

  // Apply profile field updates
  if (name) user.name = name;
  if (timezone) user.timezone = timezone;
  if (country !== undefined) user.country = country;
  if (availabilityConfig !== undefined) {
    user.availabilityConfig = availabilityConfig;
    user.markModified("availabilityConfig");
  }

  // Password change (hashed by pre-save hook)
  if (password) {
    if (password.length < 8) {
      throw new ApiError("Password must be at least 8 characters", 400);
    }
    user.password = password;
  }

  await user.save();

  sendSuccess(res, 200, "Profile updated successfully", {
    user: sanitizeUser(user),
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/demo-login
// ─────────────────────────────────────────────────────────────

/**
 * Quick login for hackathon demos.
 * Allows instant access to 'admin' or 'host' accounts.
 */
const demoLogin = asyncHandler(async (req, res) => {
  const { role } = req.body; // 'admin' or 'host'
  
  let email;
  if (role === "admin") {
    email = "admin@demo.com";
  } else {
    email = "alex@demo.com"; // Default demo host
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError("Demo data not seeded. Run 'npm run seed:demo' first.", 404);
  }

  const token = generateToken(user);

  sendSuccess(res, 200, `Logged in as Demo ${role || "Host"}`, {
    token,
    user: sanitizeUser(user),
  });
});

// ─────────────────────────────────────────────────────────────
// POST /api/auth/google/callback
// ─────────────────────────────────────────────────────────────

/**
 * Handle Google OAuth callback.
 * Exchanges auth code for tokens and saves them to the user record.
 */
const googleCallback = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw new ApiError("Authorization code is required", 400);
  }

  const { createOAuthClient } = require("../services/calendarService");
  const oauth2Client = createOAuthClient();

  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // In a real app, you'd get user info from Google here if they weren't already logged in.
    // For this integration, we assume the user is already authenticated in our app
    // and is just linking their calendar.
    
    if (!req.user) {
      throw new ApiError("User must be logged in to link Google Calendar", 401);
    }

    const user = await User.findById(req.user._id);
    user.googleTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || user.googleTokens?.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    await user.save();

    sendSuccess(res, 200, "Google Calendar linked successfully", {
      googleLinked: true,
    });
  } catch (err) {
    throw new ApiError(`Google OAuth failed: ${err.message}`, 400);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/auth/users
// ─────────────────────────────────────────────────────────────

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("name email profileImage timezone country role");
  sendSuccess(res, 200, "Users retrieved successfully", { users });
});

module.exports = { register, login, getMe, updateProfile, demoLogin, googleCallback, getUsers };

