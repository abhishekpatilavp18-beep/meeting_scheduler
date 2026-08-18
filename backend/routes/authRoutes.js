const express = require("express");
const router = express.Router();
const { register, login, getMe, updateProfile, demoLogin, googleCallback, getUsers } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { authLimiter } = require("../middleware/securityMiddleware");

const { authorizeRoles } = require("../middleware/roleMiddleware");

// ─────────────────────────────────────────────────────────────
// Auth Routes — /api/auth
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User authentication and management
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               timezone: { type: string, example: "UTC" }
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 */
router.post("/register", authLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authLimiter, login);

// ── Hackathon Demo Helper (disabled in production) ───────────
router.post("/demo-login", (req, res, next) => {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEMO_LOGIN) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  next();
}, demoLogin);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.post("/google/callback", protect, googleCallback);
router.get("/users", protect, authorizeRoles("admin", "host"), getUsers);


module.exports = router;
