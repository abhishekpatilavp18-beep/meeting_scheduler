const Meeting = require("../models/Meeting");
const User = require("../models/User");
const notificationService = require("./notificationService");
const socketService = require("./socketService");

// ─────────────────────────────────────────────────────────────
// Reminder Service
// Polls for upcoming meetings and sends email + socket reminders.
// ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60 * 1000; // check every minute
const REMINDER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes before start
let _intervalId = null;

/**
 * Find meetings that need reminders sent NOW.
 *
 * A meeting needs a reminder if:
 *   1. remindersSent === false
 *   2. status === "scheduled"
 *   3. startTime is within the next REMINDER_WINDOW_MS
 */
const getPendingReminders = async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() + REMINDER_WINDOW_MS);

  return Meeting.find({
    status: "scheduled",
    remindersSent: false,
    startTime: { $gte: now, $lte: cutoff },
  })
    .populate("organizer", "name email")
    .populate("participants.user", "name email");
};

/**
 * Send reminders for a single meeting.
 */
const sendMeetingReminder = async (meeting) => {
  const minsUntil = Math.max(0, Math.round((meeting.startTime - Date.now()) / 60000));
  const timeLabel = minsUntil > 0 ? `in ${minsUntil} minutes` : "now";

  // Collect all users: organizer + participants
  const allUsers = [];
  if (meeting.organizer) allUsers.push(meeting.organizer);
  for (const p of meeting.participants) {
    if (p.user) allUsers.push(p.user);
  }

  for (const user of allUsers) {
    // Socket notification (fire-and-forget)
    socketService.notifyUser(user._id, {
      message: `Meeting can now be joined: "${meeting.title}" starts ${timeLabel}`,
      type: "reminder",
      relatedMeeting: meeting._id,
    }).catch(() => {});

    // Email reminder (fire-and-forget)
    notificationService.sendReminderEmail(user, meeting, timeLabel).catch(() => {});
  }

  // Mark reminder as sent + log it
  meeting.remindersSent = true;
  meeting.remindersLog.push({
    sentAt: new Date(),
    channel: "email",
    recipientCount: allUsers.length,
  });
  await meeting.save();

  console.log(`🔔 Reminder sent for "${meeting.title}" (${allUsers.length} recipients)`);
};

/**
 * Process all pending reminders.
 */
const processReminders = async () => {
  try {
    const pending = await getPendingReminders();
    if (pending.length) {
      console.log(`🔔 Processing ${pending.length} pending reminder(s)...`);
    }
    for (const meeting of pending) {
      await sendMeetingReminder(meeting);
    }
  } catch (err) {
    console.error("Reminder processing error:", err.message);
  }
};

/**
 * Start the reminder polling loop.
 */
const start = () => {
  if (_intervalId) return;
  console.log("🔔 Reminder service started (polling every 60s)");
  processReminders(); // run once immediately
  _intervalId = setInterval(processReminders, POLL_INTERVAL_MS);
};

/**
 * Stop the reminder polling loop.
 */
const stop = () => {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    console.log("🔔 Reminder service stopped");
  }
};

module.exports = { start, stop, processReminders, sendMeetingReminder };
