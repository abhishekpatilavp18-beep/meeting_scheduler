const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");
const Meeting = require("../models/Meeting");
const TimeSlot = require("../models/TimeSlot");
const { generateUser, generateMeeting, generateSlot, getRandom } = require("./dataGenerators");

dotenv.config();

const SEED_CONFIG = {
  NUM_USERS: 8,
  HISTORY_DAYS: 30,
  FUTURE_DAYS: 7,
  SLOTS_PER_DAY: 6,
  MEETINGS_PER_DAY_AVG: 3
};

/**
 * Main Seeder Function
 */
const seedDemoData = async () => {
  try {
    console.log("🌱 Starting realistic demo data seeding...");

    // 1. Connect to DB
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
      console.log("📡 Connected to MongoDB");
    }

    // 2. Clear existing demo data
    // We only clear users marked as demo accounts to avoid deleting real test data if it exists
    await User.deleteMany({ isDemoAccount: true });
    await Meeting.deleteMany({}); // Meetings and slots are usually transient in demo env
    await TimeSlot.deleteMany({});
    console.log("🧹 Cleared old demo data");

    // 3. Create Users
    const users = [];
    
    const admin = await User.create({
      ...generateUser(0, "admin"),
      email: "admin@gmail.com",
      country: "India",
      timezone: "Asia/Kolkata"
    });
    const host = await User.create({
      ...generateUser(1, "host"),
      name: "Demo Host",
      email: "host@hackhive.demo"
    });
    const guest = await User.create({
      ...generateUser(2, "member"),
      name: "Demo Guest",
      email: "guest@hackhive.demo"
    });

    users.push(admin, host, guest);

    // Additional generic users
    for (let i = 3; i < SEED_CONFIG.NUM_USERS; i++) {
      const u = await User.create(generateUser(i));
      users.push(u);
    }
    console.log(`👤 Created ${users.length} demo users`);

    // 4. Generate Historical Meetings (for Analytics)
    console.log("📈 Generating historical data for analytics...");
    const meetings = [];
    const now = new Date();

    for (let d = SEED_CONFIG.HISTORY_DAYS; d > 0; d--) {
      const date = new Date();
      date.setDate(now.getDate() - d);
      
      // Randomize number of meetings per day (0 to 5)
      const dailyCount = Math.floor(Math.random() * 5);
      
      for (let i = 0; i < dailyCount; i++) {
        const hour = 9 + Math.floor(Math.random() * 8); // 9 AM to 5 PM
        const start = new Date(date);
        start.setHours(hour, getRandom([0, 30]), 0, 0);

        const organizer = getRandom(users);
        const participant = users.find(u => u._id !== organizer._id);
        
        const m = await Meeting.create(generateMeeting(organizer._id, [participant._id], start));
        meetings.push(m);
      }
    }

    // 5. Generate Upcoming Meetings
    console.log("🗓️ Generating upcoming meetings...");
    for (let d = 0; d < 3; d++) {
      const date = new Date();
      date.setDate(now.getDate() + d);
      
      const hour = 10 + Math.floor(Math.random() * 4);
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);

      // Ensure the Demo Host has some upcoming meetings
      const m = await Meeting.create(generateMeeting(host._id, [guest._id], start));
      meetings.push(m);
    }

    // 6. Generate Available Slots for the next 7 days for ALL users (Full Time)
    console.log("🕒 Generating full-time availability slots for all users...");
    for (const u of users) {
      for (let d = 0; d < SEED_CONFIG.FUTURE_DAYS; d++) {
        const date = new Date();
        date.setDate(now.getDate() + d);

        // Skip weekends for realism
        if (date.getDay() === 0 || date.getDay() === 6) continue;

        for (let h = 9; h < 18; h++) {
          const start = new Date(date);
          start.setHours(h, 0, 0, 0);
          await TimeSlot.create(generateSlot(u._id, start));
        }
      }
    }

    // 7. Generate Seed Notifications
    console.log("🔔 Adding demo notifications...");
    const demoNotifications = [
      { message: "Welcome to HackHive! Start by setting your availability.", type: "system" },
      { message: "Your 'Product Sync' meeting starts in 10 minutes.", type: "reminder" },
      { message: "Demo Guest has booked a new meeting with you.", type: "meeting" }
    ];

    host.notifications.push(...demoNotifications);
    await host.save();

    console.log("✅ Demo seeding complete!");
    console.log(`   Admin: admin@gmail.com / Password123`);
    console.log(`   Host:  host@hackhive.demo / Password123`);
    console.log(`   Guest: guest@hackhive.demo / Password123`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Auto-run if executed directly
if (require.main === module) {
  seedDemoData();
}

module.exports = seedDemoData;
