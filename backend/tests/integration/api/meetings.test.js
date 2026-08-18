const request = require("supertest");
const app = require("../../../server");
const Meeting = require("../../../models/Meeting");
const TimeSlot = require("../../../models/TimeSlot");
const { createTestUser, generateTestToken, getAuthHeaders } = require("../../utils/testHelpers");

// Mocks
const socketService = require("../../../services/socketService");
const notificationService = require("../../../services/notificationService");

describe("Meetings API", () => {
  let organizer, participant1, participant2;
  let orgToken;

  beforeEach(async () => {
    organizer = await createTestUser({ email: "org@example.com" });
    participant1 = await createTestUser({ email: "p1@example.com" });
    participant2 = await createTestUser({ email: "p2@example.com" });
    orgToken = generateTestToken(organizer);
  });

  describe("POST /api/meetings/book", () => {
    it("should book a meeting successfully and lock the slot", async () => {
      // Create an available slot
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 45);

      const slot = await TimeSlot.create({
        host: organizer._id,
        startTime,
        endTime,
      });

      const res = await request(app)
        .post("/api/meetings/book")
        .set(getAuthHeaders(orgToken))
        .send({
          title: "Project Sync",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          slotId: slot._id.toString(),
          participants: [participant1._id.toString(), participant2._id.toString()],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meeting.title).toBe("Project Sync");
      
      // Verify slot is now booked
      const updatedSlot = await TimeSlot.findById(slot._id);
      expect(updatedSlot.isBooked).toBe(true);
      expect(updatedSlot.meetingId.toString()).toBe(res.body.data.meeting._id.toString());
      
      // Verify notifications were triggered
      expect(socketService.emitSlotUpdate).toHaveBeenCalled();
      expect(socketService.emitDashboardUpdate).toHaveBeenCalled();
      expect(notificationService.sendBookingConfirmation).toHaveBeenCalled();
    });

    it("should prevent double booking (atomic slot lock)", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 3);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      const slot = await TimeSlot.create({
        host: organizer._id,
        startTime,
        endTime,
      });

      // Simulate first booking
      await TimeSlot.bookSlot(slot._id, participant1._id, null);

      // Attempt second booking on same slot
      const res = await request(app)
        .post("/api/meetings/book")
        .set(getAuthHeaders(orgToken))
        .send({
          title: "Double Book Attempt",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          slotId: slot._id.toString(),
          participants: [participant2._id.toString()],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/no longer available/i);
    });

    it("should prevent booking if a participant has a conflict", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 4);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      // Pre-book participant1
      await Meeting.create({
        title: "P1 Existing Meeting",
        organizer: participant1._id,
        startTime,
        endTime,
        participants: [],
      });

      const res = await request(app)
        .post("/api/meetings/book")
        .set(getAuthHeaders(orgToken))
        .send({
          title: "Conflict Meeting",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          participants: [participant1._id.toString()],
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/Participant.*conflicting meeting/i);
    });
  });

  describe("GET /api/meetings/my-meetings", () => {
    it("should retrieve paginated meetings for user", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      await Meeting.create({
        title: "Test Meeting",
        organizer: organizer._id,
        startTime,
        endTime,
        participants: [{ user: participant1._id }],
      });

      const res = await request(app)
        .get("/api/meetings/my-meetings")
        .set(getAuthHeaders(orgToken));

      expect(res.status).toBe(200);
      expect(res.body.data.meetings).toHaveLength(1);
      expect(res.body.data.meetings[0].title).toBe("Test Meeting");
    });
  });
});
