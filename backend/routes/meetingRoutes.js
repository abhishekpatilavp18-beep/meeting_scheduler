const express = require("express");
const router = express.Router();
const {
  bookMeeting,
  updateMeeting,
  cancelMeeting,
  getMyMeetings,
  getMeeting,
  getAllMeetings,
  getMeetingByRoom,
} = require("../controllers/meetingController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const { bookingLimiter } = require("../middleware/securityMiddleware");

// ─────────────────────────────────────────────────────────────
// Meeting Routes — /api/meetings
// ─────────────────────────────────────────────────────────────

// All meeting routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Meetings
 *   description: Meeting booking and management
 */

/**
 * @swagger
 * /api/meetings/book:
 *   post:
 *     summary: Book a new meeting
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startTime, endTime]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               startTime: { type: string, format: date-time }
 *               endTime: { type: string, format: date-time }
 *               timezone: { type: string }
 *               participants: { type: array, items: { type: string } }
 *               slotId: { type: string }
 *     responses:
 *       201:
 *         description: Meeting booked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       409:
 *         description: Conflict (meeting or slot conflict)
 */
router.post("/book", bookingLimiter, authorizeRoles("host", "admin"), bookMeeting);

/**
 * @swagger
 * /api/meetings/my-meetings:
 *   get:
 *     summary: Get all meetings for the authenticated user
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of meetings retrieved successfully
 */
router.get("/", authorizeRoles("member", "host", "admin"), getMyMeetings);
router.get("/my-meetings", authorizeRoles("member", "host", "admin"), getMyMeetings);

/**
 * @swagger
 * /api/meetings/all:
 *   get:
 *     summary: Get all meetings in the system (Admin only)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All meetings retrieved successfully
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/all", authorizeRoles("admin"), getAllMeetings);

/**
 * @swagger
 * /api/meetings/room/{roomId}:
 *   get:
 *     summary: Validate a meeting room and get Jitsi config
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room validated successfully
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/room/:roomId", authorizeRoles("member", "host", "admin"), getMeetingByRoom);

/**
 * @swagger
 * /api/meetings/{id}:
 *   get:
 *     summary: Get a meeting by ID
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Meeting retrieved successfully
 *   put:
 *     summary: Update a meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Meeting'
 *     responses:
 *       200:
 *         description: Meeting updated successfully
 *   delete:
 *     summary: Cancel a meeting
 *     tags: [Meetings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Meeting cancelled successfully
 */
router.get("/:id", authorizeRoles("member", "host", "admin"), getMeeting);
router.put("/:id", authorizeRoles("host", "admin"), updateMeeting);
router.delete("/:id", authorizeRoles("member", "host", "admin"), cancelMeeting);

module.exports = router;
