const express = require("express");
const router = express.Router();
const {
  getOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
} = require("../controllers/organizationController");
const { protect } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// All routes require authentication
router.use(protect);

router.route("/")
  .get(getOrganizations)
  .post(authorizeRoles("admin"), createOrganization);

router.route("/:id")
  .get(getOrganization)
  .put(authorizeRoles("admin", "host"), updateOrganization)
  .delete(authorizeRoles("admin"), deleteOrganization);

module.exports = router;
