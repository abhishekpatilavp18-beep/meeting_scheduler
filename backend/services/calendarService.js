const { google } = require("googleapis");
const Meeting = require("../models/Meeting");
const Availability = require("../models/Availability");
const User = require("../models/User");
const crypto = require("crypto");

// ─────────────────────────────────────────────────────────────
// Calendar Service
// Handles availability management, calendar-view aggregation,
// and real Google Calendar synchronization via OAuth.
// ─────────────────────────────────────────────────────────────

// ── Google OAuth Client Setup ────────────────────────────────

const createOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/auth/google/callback"
  );
};

/**
 * Helper to get an authenticated Google Calendar client for a user.
 */
const getCalendarClient = (user) => {
  if (!user.googleTokens || !user.googleTokens.access_token) {
    return null; // User hasn't linked Google Calendar
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({
    access_token: user.googleTokens.access_token,
    refresh_token: user.googleTokens.refresh_token,
    expiry_date: user.googleTokens.expiry_date,
  });

  // If we had a mechanism to save refreshed tokens automatically,
  // we would attach a 'tokens' event listener here.

  return google.calendar({ version: "v3", auth: oauth2Client });
};

// ── Google Calendar Sync Methods ─────────────────────────────

/**
 * Create a new event on the user's primary Google Calendar.
 */
const syncToExternalCalendar = async (userId, meetingId) => {
  try {
    const user = await User.findById(userId);
    const meeting = await Meeting.findById(meetingId).populate("participants.user", "name email");
    
    if (!user || !meeting) return null;

    const calendar = getCalendarClient(user);
    if (!calendar) return null;

    // Convert meeting participants to Google Event attendees
    const attendees = meeting.participants
      .filter((p) => p.user && p.user.email)
      .map((p) => ({ email: p.user.email }));

    const event = {
      summary: meeting.title,
      description: meeting.description || "Scheduled via HackHive Meeting Scheduler",
      start: {
        dateTime: meeting.startTime.toISOString(),
        timeZone: meeting.timezone || user.timezone || "UTC",
      },
      end: {
        dateTime: meeting.endTime.toISOString(),
        timeZone: meeting.timezone || user.timezone || "UTC",
      },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 10 },
        ],
      },
      location: meeting.meetingLink ? process.env.CLIENT_URL + meeting.meetingLink : "",
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      sendUpdates: "all",
    });

    meeting.calendarEventId = response.data.id;
    await meeting.save();

    return response.data.id;
  } catch (error) {
    console.error("Failed to create Google Calendar event:", error.message);
    return null;
  }
};

/**
 * Update an existing event on the user's Google Calendar.
 */
const updateExternalCalendar = async (userId, meetingId) => {
  try {
    const user = await User.findById(userId);
    const meeting = await Meeting.findById(meetingId).populate("participants.user", "name email");

    if (!user || !meeting || !meeting.calendarEventId) return null;

    const calendar = getCalendarClient(user);
    if (!calendar) return null;

    const attendees = meeting.participants
      .filter((p) => p.user && p.user.email)
      .map((p) => ({ email: p.user.email }));

    const event = {
      summary: meeting.title,
      description: meeting.description || "Scheduled via HackHive Meeting Scheduler",
      start: {
        dateTime: meeting.startTime.toISOString(),
        timeZone: meeting.timezone || user.timezone || "UTC",
      },
      end: {
        dateTime: meeting.endTime.toISOString(),
        timeZone: meeting.timezone || user.timezone || "UTC",
      },
      attendees,
      location: meeting.meetingLink ? process.env.CLIENT_URL + meeting.meetingLink : "",
    };

    const response = await calendar.events.update({
      calendarId: "primary",
      eventId: meeting.calendarEventId,
      resource: event,
      sendUpdates: "all",
    });

    return response.data.id;
  } catch (error) {
    console.error("Failed to update Google Calendar event:", error.message);
    return null;
  }
};

/**
 * Remove an event from the user's Google Calendar.
 */
const removeFromExternalCalendar = async (userId, calendarEventId) => {
  if (!calendarEventId) return false;

  try {
    const user = await User.findById(userId);
    if (!user) return false;

    const calendar = getCalendarClient(user);
    if (!calendar) return false;

    await calendar.events.delete({
      calendarId: "primary",
      eventId: calendarEventId,
      sendUpdates: "all",
    });

    return true;
  } catch (error) {
    console.error("Failed to delete Google Calendar event:", error.message);
    return false;
  }
};

// ── Availability Helpers (aligned with current schema) ───────

const getCalendarEvents = async (userId, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const meetings = await Meeting.find({
    $or: [{ organizer: userId }, { "participants.user": userId }],
    startTime: { $lte: end },
    endTime: { $gte: start },
    status: { $ne: "cancelled" },
  })
    .populate("organizer", "name email")
    .populate("participants.user", "name email")
    .sort({ startTime: 1 });

  const availability = await Availability.findOne({ userId });

  const events = meetings.map((m) => ({
    id: m._id,
    type: "meeting",
    title: m.title,
    startTime: m.startTime,
    endTime: m.endTime,
    status: m.status,
    meetingLink: m.meetingLink,
  }));

  // Add unavailable date overrides as blocked events
  if (availability) {
    for (const ov of availability.unavailableDates) {
      if (ov.date >= start && ov.date <= end && ov.isFullDay) {
        events.push({
          id: `blocked_${ov.date.toISOString()}`,
          type: "blocked",
          title: ov.reason || "Unavailable",
          startTime: ov.date,
          endTime: ov.date,
          status: "blocked",
        });
      }
    }
  }

  events.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  return events;
};

module.exports = {
  createOAuthClient,
  syncToExternalCalendar,
  updateExternalCalendar,
  removeFromExternalCalendar,
  getCalendarEvents,
};

