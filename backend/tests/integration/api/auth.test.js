const request = require("supertest");
const app = require("../../../server");
const User = require("../../../models/User");
const { createTestUser, generateTestToken, getAuthHeaders } = require("../../utils/testHelpers");

describe("Auth API", () => {
  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New User",
          email: "newuser@example.com",
          password: "StrongPassword123!",
          timezone: "America/New_York",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty("_id");
      expect(res.body.data.user.email).toBe("newuser@example.com");
      expect(res.body.data).toHaveProperty("token");

      // Verify user was saved in DB
      const dbUser = await User.findOne({ email: "newuser@example.com" });
      expect(dbUser).toBeTruthy();
    });

    it("should fail with weak password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New User",
          email: "weakpass@example.com",
          password: "123", // Too short, no numbers/specials
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await createTestUser({ email: "loginuser@example.com", password: "Password123!" });
    });

    it("should login successfully with correct credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "loginuser@example.com",
          password: "Password123!",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("token");
    });

    it("should fail with incorrect password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "loginuser@example.com",
          password: "wrongpassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should get user profile with valid token", async () => {
      const user = await createTestUser();
      const token = generateTestToken(user);

      const res = await request(app)
        .get("/api/auth/me")
        .set(getAuthHeaders(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user._id).toBe(user._id.toString());
    });

    it("should fail without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});
