const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const generateTestToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
      issuer: "hackhive-scheduler",
      audience: "hackhive-client",
      algorithm: "HS256"
    }
  );
};

const createTestUser = async (overrides = {}) => {
  const defaultUser = {
    name: "Test User",
    email: `testuser_${Date.now()}@example.com`,
    password: "Password123!",
    role: "user",
    timezone: "UTC",
  };
  
  const userData = { ...defaultUser, ...overrides };
  const user = await User.create(userData);
  return user;
};

const getAuthHeaders = (token) => {
  return {
    Authorization: `Bearer ${token}`
  };
};

module.exports = {
  generateTestToken,
  createTestUser,
  getAuthHeaders,
};
