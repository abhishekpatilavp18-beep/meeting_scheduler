const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const dotenv = require("dotenv");

// Load environment variables for tests
dotenv.config();

let mongoServer;

// Increase timeout for downloading MongoDB binaries if needed
jest.setTimeout(60000);

// Mock services that shouldn't run during tests
jest.mock("../services/socketService", () => require("./mocks/socketService.mock"));
jest.mock("../services/calendarService", () => require("./mocks/calendarService.mock"));
jest.mock("../services/notificationService", () => require("./mocks/notificationService.mock"));

// Prevent real mail transporter setup
process.env.SMTP_HOST = "smtp.mailtrap.io";
process.env.SMTP_PORT = "2525";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
process.env.JWT_SECRET = "test_jwt_secret_must_be_long_enough_for_security_checks";
process.env.JWT_EXPIRES_IN = "1h";

beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Connect mongoose to the in-memory instance
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Clean up DB and close connections
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Clear all collections between tests
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }
  }
  
  // Clear all mocks between tests
  jest.clearAllMocks();
});
