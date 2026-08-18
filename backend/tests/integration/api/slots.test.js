const request = require("supertest");
const app = require("../../../server");
const TimeSlot = require("../../../models/TimeSlot");
const { createTestUser, generateTestToken, getAuthHeaders } = require("../../utils/testHelpers");

describe("Slots API", () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await createTestUser();
    token = generateTestToken(user);
  });

  describe("POST /api/slots/create", () => {
    it("should create a valid slot", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1); // 1 hour from now
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30); // 30 min duration

      const res = await request(app)
        .post("/api/slots/create")
        .set(getAuthHeaders(token))
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slot.host.toString()).toBe(user._id.toString());
    });

    it("should reject a slot in the past", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - 1); 
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30); 

      const res = await request(app)
        .post("/api/slots/create")
        .set(getAuthHeaders(token))
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/past/i);
    });

    it("should reject overlapping slots", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 60);

      // Create first slot
      await TimeSlot.create({
        host: user._id,
        startTime,
        endTime,
      });

      // Try to create overlapping slot
      const overlapStart = new Date(startTime);
      overlapStart.setMinutes(overlapStart.getMinutes() + 30); // Starts inside first slot
      const overlapEnd = new Date(overlapStart);
      overlapEnd.setMinutes(overlapEnd.getMinutes() + 60);

      const res = await request(app)
        .post("/api/slots/create")
        .set(getAuthHeaders(token))
        .send({
          startTime: overlapStart.toISOString(),
          endTime: overlapEnd.toISOString(),
        });

      expect(res.status).toBe(409); // Conflict
      expect(res.body.error).toMatch(/overlap/i);
    });
  });

  describe("GET /api/slots/available", () => {
    it("should return available slots for a host", async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      await TimeSlot.create({
        host: user._id,
        startTime,
        endTime,
      });

      const res = await request(app)
        .get(`/api/slots/available?hostId=${user._id}`)
        .set(getAuthHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.data.slots).toHaveLength(1);
      expect(res.body.data.slots[0].isBooked).toBe(false);
    });
  });
});
