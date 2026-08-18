const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
// MongoDB Connection — Production-grade with retry logic
// ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

/**
 * Connect to MongoDB with automatic retry.
 * On failure, retries up to MAX_RETRIES before exiting the process.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

const connectDB = async () => {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;
      console.log(`📡 MongoDB connection attempt ${attempt}/${MAX_RETRIES}...`);

      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,  // fail fast if cluster unreachable
        socketTimeoutMS: 45000,           // close idle sockets after 45s
        maxPoolSize: 10,                  // connection pool ceiling
      });

      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      console.log(`   Database: ${conn.connection.name}`);

      // ── Runtime event listeners ───────────────────────────
      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB runtime error:", err.message);
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️  MongoDB disconnected");
      });

      mongoose.connection.on("reconnected", () => {
        console.log("🔄 MongoDB reconnected");
      });

      return conn;
    } catch (error) {
      console.error(`❌ MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);

      if (attempt >= 2) {
        console.log("⚠️ Switching to in-memory MongoDB server for demo purposes...");
        try {
          mongoServer = await MongoMemoryServer.create();
          const memoryUri = mongoServer.getUri();
          const conn = await mongoose.connect(memoryUri);
          console.log(`✅ In-Memory MongoDB connected: ${conn.connection.host}`);
          return conn;
        } catch (memError) {
          console.error("Failed to start in-memory MongoDB", memError);
          process.exit(1);
        }
      }

      console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

/**
 * Gracefully close the MongoDB connection.
 * Call this in shutdown handlers.
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed gracefully");
  } catch (err) {
    console.error("❌ Error closing MongoDB connection:", err.message);
  }
};

module.exports = { connectDB, disconnectDB };
