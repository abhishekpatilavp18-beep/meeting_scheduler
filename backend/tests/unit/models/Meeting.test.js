const mongoose = require("mongoose");
const Meeting = require("../../../models/Meeting");

describe("Meeting Model", () => {
  let organizerId, participantId;

  beforeAll(() => {
    organizerId = new mongoose.Types.ObjectId();
    participantId = new mongoose.Types.ObjectId();
  });

  describe("Validation", () => {
    it("should require a title", async () => {
      const meeting = new Meeting({
        organizer: organizerId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
      });

      const err = meeting.validateSync();
      expect(err.errors.title).toBeDefined();
    });

    it("should require endTime to be after startTime", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() - 3600000); 

      const meeting = new Meeting({
        title: "Test",
        organizer: organizerId,
        startTime,
        endTime,
      });

      try {
        await meeting.validate();
        fail("Should have thrown validation error");
      } catch (err) {
        expect(err.errors.endTime).toBeDefined();
      }
    });

    it("should default status to scheduled", () => {
      const meeting = new Meeting({
        title: "Test",
        organizer: organizerId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
      });

      expect(meeting.status).toBe("scheduled");
    });
  });

  describe("Static Methods", () => {
    it("should find conflicts for a user", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3600000); 

      await Meeting.create({
        title: "Meeting 1",
        organizer: organizerId,
        startTime,
        endTime,
        participants: [{ user: participantId }]
      });

      // Check conflict for participant (overlaps completely)
      const conflicts = await Meeting.findConflicts(participantId, startTime, endTime);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].title).toBe("Meeting 1");
    });
    
    it("should exclude cancelled meetings from conflicts", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 3600000); 

      await Meeting.create({
        title: "Meeting 1",
        organizer: organizerId,
        startTime,
        endTime,
        status: "cancelled",
        participants: [{ user: participantId }]
      });

      const conflicts = await Meeting.findConflicts(participantId, startTime, endTime);
      expect(conflicts).toHaveLength(0);
    });
  });
});
