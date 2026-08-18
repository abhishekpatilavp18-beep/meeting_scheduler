const express = require("express");
const router = express.Router();
const { getOverview, getUsage } = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");
const cache = require("../middleware/cacheMiddleware");

// ─────────────────────────────────────────────────────────────
// Analytics Routes — /api/analytics
// ─────────────────────────────────────────────────────────────

// All analytics routes require authentication
router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Platform usage and meeting statistics
 */

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     summary: Get high-level platform statistics (Admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics overview retrieved successfully
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/overview", cache(300), authorizeRoles("admin"), getOverview);

/**
 * @swagger
 * /api/analytics/usage:
 *   get:
 *     summary: Get detailed usage trends (Admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: integer, default: 30 }
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: Usage analytics retrieved successfully
 */
router.get("/usage", cache(300), authorizeRoles("admin"), getUsage);

module.exports = router;
