const transporter = require("../config/mailer");

/**
 * Send an email using the configured Nodemailer transporter.
 * Handles failures safely (doesn't throw) so it doesn't break the main thread.
 *
 * @param {Object} options
 * @param {string} options.to      — Recipient email address
 * @param {string} options.subject — Email subject
 * @param {string} options.html    — HTML body
 */
const sendEmail = async ({ to, subject, html }) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[Mail Stub] Email to ${to} skipped (Missing SMTP credentials)`);
    return null;
  }

  try {
    const info = await transporter.sendMail({
      from: `"HackHive Meetings" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`📧 Email send failed (to: ${to}):`, error.message);
    return null;
  }
};

module.exports = { sendEmail };
