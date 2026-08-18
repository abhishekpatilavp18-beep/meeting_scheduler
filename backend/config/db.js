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

const connectDB = async () => {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt++;

      console.log(
        `📡 MongoDB connection attempt ${attempt}/${MAX_RETRIES}...`
      );

      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
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
      console.error(
        `❌ MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`
      );

      if (attempt >= MAX_RETRIES) {
        console.error("💀 Could not connect to MongoDB Atlas.");
        process.exit(1);
      }

      console.log(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);

      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS)
      );
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
    console.error(
      "❌ Error closing MongoDB connection:",
      err.message
    );
  }
};

module.exports = { connectDB, disconnectDB };