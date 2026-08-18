module.exports = {
  init: jest.fn(),
  notifyUser: jest.fn().mockResolvedValue(),
  emitSlotUpdate: jest.fn().mockResolvedValue(),
  emitDashboardUpdate: jest.fn().mockResolvedValue(),
};
