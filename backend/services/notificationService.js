const { sendEmail } = require("../utils/sendEmail");

// ─────────────────────────────────────────────────────────────
// Notification Service
// Centralises all email notification logic and templates.
// ─────────────────────────────────────────────────────────────

const getClientUrl = () => process.env.CLIENT_URL || "http://localhost:5173";

// ── Shared Template Wrapper ───────────────────────────────────

const wrapTemplate = (title, content) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #334155; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; }
    .content { padding: 40px 32px; }
    .footer { padding: 24px 32px; background: #f8fafc; text-align: center; font-size: 13px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .btn { display: inline-block; background: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; transition: background 0.2s; }
    .btn:hover { background: #4338ca; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; }
    td { padding: 16px; border-bottom: 1px solid #e2e8f0; }
    td:first-child { color: #64748b; font-weight: 500; width: 120px; }
    td:last-child { color: #0f172a; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      Powered by HackHive Meeting Scheduler<br>
      Automated email. Please do not reply.
    </div>
  </div>
</body>
</html>
`;

// ── Email Methods ─────────────────────────────────────────────

/**
 * Send a booking confirmation email to a participant or organizer.
 */
const sendBookingConfirmation = async (user, meeting, isOverride = false) => {
  const isOrganizer = meeting.organizer._id.toString() === user._id.toString();
  let roleText = isOrganizer ? "You scheduled a new meeting" : `You've been invited to a meeting by ${meeting.organizer.name}`;
  
  if (isOverride) {
    roleText = `<span style="color: #ef4444; font-weight: bold;">🚨 URGENT: Important meeting scheduled during your unavailable time. Your attendance is requested.</span>`;
  }
  
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Hi ${user.name},</p>
    <p style="font-size: 16px; color: #64748b;">${roleText}. Here are the details:</p>
    
    <table>
      <tr>
        <td>Meeting</td>
        <td>${meeting.title}</td>
      </tr>
      <tr>
        <td>Date</td>
        <td>${new Date(meeting.startTime).toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
      </tr>
      <tr>
        <td>Time</td>
        <td>
          ${new Date(meeting.startTime).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })} - 
          ${new Date(meeting.endTime).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })} 
          (${meeting.timezone})
        </td>
      </tr>
      ${meeting.description ? `<tr><td>Description</td><td style="font-weight: 400;">${meeting.description}</td></tr>` : ""}
    </table>

    ${meeting.meetingLink ? `
      <div style="text-align: center;">
        <a href="${getClientUrl()}${meeting.meetingLink}" class="btn">Join Video Room</a>
        <p style="margin-top: 16px; font-size: 14px; color: #64748b;">
          Or use this link:<br>
          <a href="${getClientUrl()}${meeting.meetingLink}" style="color: #4f46e5; word-break: break-all;">${getClientUrl()}${meeting.meetingLink}</a>
        </p>
      </div>
    ` : ""}
  `;

  const html = wrapTemplate(isOverride ? "URGENT: Meeting Scheduled 🚨" : "Meeting Confirmed ✅", content);
  return sendEmail({ to: user.email, subject: isOverride ? `URGENT: ${meeting.title}` : `Confirmed: ${meeting.title}`, html });
};

/**
 * Send a meeting cancellation email.
 */
const sendCancellationEmail = async (user, meeting, organizerName) => {
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Hi ${user.name},</p>
    <p style="font-size: 16px; color: #ef4444; font-weight: 500;">
      The meeting <strong>"${meeting.title}"</strong> has been cancelled by ${organizerName}.
    </p>
    
    <table>
      <tr>
        <td>Meeting</td>
        <td><strike>${meeting.title}</strike></td>
      </tr>
      <tr>
        <td>Date</td>
        <td><strike>${new Date(meeting.startTime).toLocaleDateString()}</strike></td>
      </tr>
    </table>
    
    <p style="font-size: 16px; color: #64748b;">No further action is required from you. The time slot has been freed up on your calendar.</p>
  `;

  const html = wrapTemplate("Meeting Cancelled ❌", content);
  return sendEmail({ to: user.email, subject: `Cancelled: ${meeting.title}`, html });
};

/**
 * Send an upcoming meeting reminder email.
 */
const sendReminderEmail = async (user, meeting, timeUntil = "in 15 minutes") => {
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Hi ${user.name},</p>
    <p style="font-size: 16px; color: #64748b;">This is a reminder that you have a meeting starting <strong>${timeUntil}</strong>.</p>
    
    <table>
      <tr>
        <td>Meeting</td>
        <td>${meeting.title}</td>
      </tr>
      <tr>
        <td>Starts At</td>
        <td>${new Date(meeting.startTime).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
    </table>

    ${meeting.meetingLink ? `
      <div style="text-align: center;">
        <a href="${getClientUrl()}${meeting.meetingLink}" class="btn" style="background: #10b981;">Join Meeting Now</a>
      </div>
    ` : ""}
  `;

  // Use a green gradient for reminders
  const reminderTemplate = wrapTemplate("Meeting Reminder ⏰", content).replace(
    "linear-gradient(135deg, #4f46e5, #7c3aed)",
    "linear-gradient(135deg, #10b981, #059669)"
  );

  return sendEmail({ to: user.email, subject: `Reminder: ${meeting.title} starting soon`, html: reminderTemplate });
};

module.exports = {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendReminderEmail,
};
