module.exports = {
  sendBookingConfirmation: jest.fn().mockResolvedValue(),
  sendCancellationEmail: jest.fn().mockResolvedValue(),
  sendReminderEmail: jest.fn().mockResolvedValue(),
  sendWelcomeEmail: jest.fn().mockResolvedValue(),
};
