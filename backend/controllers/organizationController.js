const Organization = require("../models/Organization");
const { ApiError, asyncHandler } = require("../middleware/errorHandler");
const { sendSuccess } = require("../utils/apiResponse");

// @desc    Get all organizations for current user
// @route   GET /api/v1/organizations
// @access  Private
exports.getOrganizations = asyncHandler(async (req, res) => {
  const organizations = await Organization.find({
    $or: [
      { owner: req.user._id },
      { "members.user": req.user._id }
    ]
  }).sort("-createdAt").populate("members.user", "name email profileImage timezone country");

  sendSuccess(res, 200, "Organizations retrieved successfully", { organizations });
});

// @desc    Create new organization
// @route   POST /api/v1/organizations
// @access  Private
exports.createOrganization = asyncHandler(async (req, res) => {
  const { name, description, color } = req.body;

  if (!name) {
    throw new ApiError("Please provide a name for the organization", 400);
  }

  const organization = await Organization.create({
    name,
    description,
    color: color || "#3b82f6",
    timezone: req.user.timezone || "UTC",
    owner: req.user._id,
    members: [{ user: req.user._id, role: "admin" }]
  });

  sendSuccess(res, 201, "Organization created successfully", { organization });
});

// @desc    Get single organization
// @route   GET /api/v1/organizations/:id
// @access  Private
exports.getOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id).populate("members.user", "name email profileImage timezone country");

  if (!organization) {
    throw new ApiError(`Organization not found with id of ${req.params.id}`, 404);
  }

  // Check if user is member
  const isMember = organization.owner.toString() === req.user._id.toString() || 
                   organization.members.some(m => m.user && m.user._id && m.user._id.toString() === req.user._id.toString());

  if (!isMember) {
    throw new ApiError("Not authorized to access this organization", 403);
  }

  sendSuccess(res, 200, "Organization retrieved successfully", { organization });
});

// @desc    Update organization (name, description, members)
// @route   PUT /api/v1/organizations/:id
// @access  Private (owner or admin)
exports.updateOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    throw new ApiError(`Organization not found with id of ${req.params.id}`, 404);
  }

  // Authorization: owner or platform admin
  if (organization.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError("Not authorized to update this organization", 403);
  }

  // Update basic fields if provided
  if (req.body.name) organization.name = req.body.name;
  if (req.body.description !== undefined) organization.description = req.body.description;
  if (req.body.color) organization.color = req.body.color;
  if (req.body.timezone) organization.timezone = req.body.timezone;

  // Update members if provided
  if (req.body.members && Array.isArray(req.body.members)) {
    // Build new members array, always keeping the owner as admin
    const ownerIdStr = organization.owner.toString();
    const seen = new Set();
    const newMembers = [];

    // Owner is always first member with admin role
    newMembers.push({ user: organization.owner, role: 'admin' });
    seen.add(ownerIdStr);

    // Add all other members (deduplicated)
    for (const m of req.body.members) {
      const userId = typeof m === 'string' ? m : (m.user || m.id);
      if (!userId) continue;
      const userIdStr = userId.toString();
      if (seen.has(userIdStr)) continue;
      seen.add(userIdStr);
      newMembers.push({ user: userId, role: m.role || 'member' });
    }

    organization.members = newMembers;
  }

  await organization.save();

  // Re-fetch with populated members for the response
  const populated = await Organization.findById(organization._id)
    .populate("members.user", "name email profileImage timezone country");

  sendSuccess(res, 200, "Organization updated successfully", { organization: populated });
});

// @desc    Delete organization
// @route   DELETE /api/v1/organizations/:id
// @access  Private
exports.deleteOrganization = asyncHandler(async (req, res) => {
  const organization = await Organization.findById(req.params.id);

  if (!organization) {
    throw new ApiError(`Organization not found with id of ${req.params.id}`, 404);
  }

  // Check if user is the owner or an admin of the platform
  if (organization.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError("Not authorized to delete this organization", 403);
  }

  await organization.deleteOne();

  sendSuccess(res, 200, "Organization deleted successfully", {});
});
