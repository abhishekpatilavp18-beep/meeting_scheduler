const mongoose = require("mongoose");
const TimeSlot = require("../../../models/TimeSlot");
const User = require("../../../models/User");

describe("TimeSlot Model", () => {
  let hostId;

  beforeAll(() => {
    hostId = new mongoose.Types.ObjectId();
  });

  describe("Validation", () => {
    it("should require a host", async () => {
      const slot = new TimeSlot({
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
      });

      const err = slot.validateSync();
      expect(err.errors.host).toBeDefined();
    });

    it("should require endTime to be after startTime", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() - 3600000); // 1 hour earlier

      const slot = new TimeSlot({
        host: hostId,
        startTime,
        endTime,
      });

      try {
        await slot.validate();
        fail("Should have thrown validation error");
      } catch (err) {
        expect(err.errors.endTime).toBeDefined();
        expect(err.errors.endTime.message).toMatch(/after start time/i);
      }
    });

    it("should calculate durationMinutes correctly (virtual)", () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1800000); // 30 minutes later

      const slot = new TimeSlot({
        host: hostId,
        startTime,
        endTime,
      });

      expect(slot.durationMinutes).toBe(30);
    });
  });

  describe("Static Methods", () => {
    it("should find overlapping slots", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3600000); // 1 hr

      await TimeSlot.create({ host: hostId, startTime, endTime });

      // Search for overlap
      const searchStart = new Date(startTime.getTime() + 1800000); // starts mid-way
      const searchEnd = new Date(searchStart.getTime() + 3600000);

      const overlaps = await TimeSlot.findOverlapping(hostId, searchStart, searchEnd);
      expect(overlaps).toHaveLength(1);
    });

    it("should not consider adjacent slots as overlapping", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3600000); // 1 hr

      await TimeSlot.create({ host: hostId, startTime, endTime });

      // Search exactly after
      const searchStart = new Date(endTime);
      const searchEnd = new Date(searchStart.getTime() + 3600000);

      const overlaps = await TimeSlot.findOverlapping(hostId, searchStart, searchEnd);
      expect(overlaps).toHaveLength(0); // Adjacent, not overlapping
    });
  });
});
