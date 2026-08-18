const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAllRead,
  markOneRead,
  clearNotifications,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notification management
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get all notifications for the current user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *   delete:
 *     summary: Clear all notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications cleared
 */
router.route("/").get(getNotifications).delete(clearNotifications);

/**
 * @swagger
 * /api/notifications/read:
 *   put:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.put("/read", markAllRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.put("/:id/read", markOneRead);

module.exports = router;
