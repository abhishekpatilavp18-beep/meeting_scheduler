const express = require("express");
const router = express.Router();
const {
  createSlot,
  createBulkSlots,
  getAvailableSlots,
  getAllSlots,
  updateSlot,
  deleteSlot,
  getRecommendations,
  checkConflicts,
} = require("../controllers/slotController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { slotCreationLimiter } = require("../middleware/securityMiddleware");
const cache = require("../middleware/cacheMiddleware");

// ─────────────────────────────────────────────────────────────
// Slot Routes — /api/slots
// ─────────────────────────────────────────────────────────────

// All slot routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Slots
 *   description: Time slot management for hosts
 */

/**
 * @swagger
 * /api/slots/available:
 *   get:
 *     summary: Get available time slots for a host
 *     tags: [Slots]
 *     parameters:
 *       - in: query
 *         name: hostId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Available slots retrieved successfully
 */
router.get("/available", cache(30), authorizeRoles("host", "admin"), getAvailableSlots);

/**
 * @swagger
 * /api/slots/all:
 *   get:
 *     summary: Get all slots (Admin sees all, User sees own)
 *     tags: [Slots]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All slots retrieved successfully
 */
router.get("/all", cache(60), authorizeRoles("member", "host", "admin"), getAllSlots);

/**
 * @swagger
 * /api/slots/recommend:
 *   get:
 *     summary: Get AI-powered slot recommendations
 *     tags: [Slots]
 *     parameters:
 *       - in: query
 *         name: hostId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: durationMinutes
 *         schema: { type: integer, default: 30 }
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
 */
router.get("/recommend", authorizeRoles("host", "admin"), getRecommendations);

/**
 * @swagger
 * /api/slots/create:
 *   post:
 *     summary: Create a new time slot (Admin only)
 *     tags: [Slots]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startTime, endTime]
 *             properties:
 *               startTime: { type: string, format: date-time }
 *               endTime: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Slot created successfully
 */
router.post("/create", slotCreationLimiter, authorizeRoles("host", "admin"), createSlot);

/**
 * @swagger
 * /api/slots/bulk:
 *   post:
 *     summary: Create multiple time slots (Admin only)
 *     tags: [Slots]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [slots]
 *             properties:
 *               slots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime: { type: string, format: date-time }
 *                     endTime: { type: string, format: date-time }
 *     responses:
 *       207:
 *         description: Partial success (some slots created, some failed)
 *       201:
 *         description: All slots created successfully
 */
router.post("/bulk", slotCreationLimiter, authorizeRoles("host", "admin"), createBulkSlots);

/**
 * @swagger
 * /api/slots/{id}:
 *   put:
 *     summary: Update a time slot
 *     tags: [Slots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startTime: { type: string, format: date-time }
 *               endTime: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Slot updated successfully
 *   delete:
 *     summary: Delete a time slot
 *     tags: [Slots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Slot deleted successfully
 */
router.post("/check-conflicts", authorizeRoles("host", "admin"), checkConflicts);

router.put("/:id", authorizeRoles("host", "admin"), updateSlot);
router.delete("/:id", authorizeRoles("host", "admin"), deleteSlot);

module.exports = router;
