const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// ─────────────────────────────────────────────────────────────
// Meeting Link & Room ID Generator
// Produces unique, URL-safe room IDs for Jitsi integration.
// ─────────────────────────────────────────────────────────────

const JITSI_DOMAIN = process.env.JITSI_DOMAIN || "meet.jit.si";
const APP_PREFIX = "HackHive";

/**
 * Generate a unique Jitsi-compatible room name.
 *
 * Format: HackHive_<hex6>_<uuid8>
 * - Prefixed to avoid collision with public Jitsi rooms
 * - Only alphanumeric + underscore (Jitsi-safe)
 *
 * @param {string} [meetingId] — MongoDB ObjectId for deterministic prefix
 * @returns {string} Room name (e.g. "HackHive_a3f2c1_1b9d4e7a")
 */
const generateRoomName = (meetingId) => {
  const prefix = meetingId
    ? meetingId.toString().slice(-6)
    : crypto.randomBytes(3).toString("hex");

  const uniquePart = uuidv4().replace(/-/g, "").slice(0, 8);

  return `${APP_PREFIX}_${prefix}_${uniquePart}`;
};

/**
 * Generate an internal meeting link path for the React app.
 *
 * @param {string} [meetingId]
 * @returns {string} Path (e.g. "/room/HackHive_a3f2c1_1b9d4e7a")
 */
const generateMeetingLink = (meetingId) => {
  return `/room/${generateRoomName(meetingId)}`;
};

/**
 * Generate a full absolute meeting URL.
 *
 * @param {string} meetingId
 * @returns {string} Full URL
 */
const generateMeetingUrl = (meetingId) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  return `${clientUrl}${generateMeetingLink(meetingId)}`;
};

/**
 * Generate the direct Jitsi URL for external access (e.g. calendar links).
 *
 * @param {string} roomName — The Jitsi room name
 * @returns {string} Full Jitsi URL (e.g. "https://meet.jit.si/HackHive_a3f2c1_1b9d4e7a")
 */
const generateJitsiUrl = (roomName) => {
  return `https://${JITSI_DOMAIN}/${roomName}`;
};

/**
 * Extract the Jitsi room name from a meeting link path.
 *
 * @param {string} meetingLink — e.g. "/room/HackHive_a3f2c1_1b9d4e7a"
 * @returns {string|null} Room name or null if invalid
 */
const extractRoomName = (meetingLink) => {
  if (!meetingLink) return null;
  const match = meetingLink.match(/\/room\/(.+)$/);
  return match ? match[1] : null;
};

/**
 * Validate that a room name follows the expected format.
 *
 * @param {string} roomName
 * @returns {boolean}
 */
const isValidRoomName = (roomName) => {
  if (!roomName || typeof roomName !== "string") return false;
  // Must start with our prefix and contain only safe chars
  return /^HackHive_[a-f0-9]{6}_[a-f0-9]{8}$/.test(roomName);
};

module.exports = {
  generateRoomName,
  generateMeetingLink,
  generateMeetingUrl,
  generateJitsiUrl,
  extractRoomName,
  isValidRoomName,
  JITSI_DOMAIN,
};
