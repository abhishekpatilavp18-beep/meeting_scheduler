const request = require("supertest");
const app = require("../../../server");
const Meeting = require("../../../models/Meeting");
const TimeSlot = require("../../../models/TimeSlot");
const { createTestUser, generateTestToken, getAuthHeaders } = require("../../utils/testHelpers");

describe("Analytics API", () => {
  let admin, user;
  let adminToken, userToken;

  beforeEach(async () => {
    admin = await createTestUser({ email: "admin@example.com", role: "admin" });
    user = await createTestUser({ email: "user@example.com", role: "user" });
    adminToken = generateTestToken(admin);
    userToken = generateTestToken(user);
  });

  describe("GET /api/analytics/overview", () => {
    it("should return system overview for admin", async () => {
      // Seed some data
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + 30);

      await Meeting.create({
        title: "Test Meeting",
        organizer: user._id,
        startTime,
        endTime,
        status: "scheduled",
      });

      await TimeSlot.create({
        host: user._id,
        startTime,
        endTime,
        isBooked: false,
      });

      const res = await request(app)
        .get("/api/analytics/overview")
        .set(getAuthHeaders(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meetings.total).toBe(1);
      expect(res.body.data.meetings.scheduled).toBe(1);
      expect(res.body.data.slots.total).toBe(1);
      expect(res.body.data.users.total).toBeGreaterThanOrEqual(2); // admin + user
    });

    it("should deny access to non-admin users", async () => {
      const res = await request(app)
        .get("/api/analytics/overview")
        .set(getAuthHeaders(userToken));

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it("should deny access without token", async () => {
      const res = await request(app).get("/api/analytics/overview");
      expect(res.status).toBe(401);
    });
  });
});
