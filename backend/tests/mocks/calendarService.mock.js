module.exports = {
  syncToExternalCalendar: jest.fn().mockResolvedValue(),
  updateExternalCalendar: jest.fn().mockResolvedValue(),
  removeFromExternalCalendar: jest.fn().mockResolvedValue(),
  getAuthUrl: jest.fn().mockReturnValue("http://mock-auth-url.com"),
  handleCallback: jest.fn().mockResolvedValue({ tokens: {} }),
};
