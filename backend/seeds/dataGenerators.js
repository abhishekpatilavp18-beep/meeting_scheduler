const NAMES = [
  "Alex Rivera", "Jordan Smith", "Casey Chen", "Morgan Taylor", "Riley Johnson",
  "Sam Williams", "Quinn Davis", "Taylor Miller", "Charlie Wilson", "Peyton Moore",
  "Skyler Anderson", "Dakota Thomas", "Avery Jackson", "Emerson White", "Sage Harris"
];

const MEETING_TITLES = [
  "Product Sync", "Design Review", "Architecture Deep Dive", "Marketing Brainstorm",
  "Frontend Refactor Discussion", "Sprint Planning", "Backend API Audit", "Client Onboarding",
  "Team Catch-up", "Security Hardening Session", "Database Optimization", "HR Interview",
  "Investor Update", "DevOps Workshop", "QA Bug Bash", "Content Strategy"
];

const DESCRIPTIONS = [
  "Discussing the upcoming launch strategy and core milestones.",
  "Deep dive into the system architecture and potential bottlenecks.",
  "Reviewing user feedback and prioritizing the product roadmap.",
  "Collaboration session to refine the visual language and user experience.",
  "Analyzing performance metrics and identifying optimization opportunities.",
  "Quick check-in on progress and unblocking any critical issues."
];

const BIOS = [
  "Senior Full Stack Engineer passionate about building scalable systems.",
  "Product Designer with a focus on intuitive user interfaces and accessibility.",
  "Marketing Strategist helpings startups grow their online presence.",
  "Systems Architect specializing in high-frequency trading platforms.",
  "Lead Developer with a love for clean code and mentoring others."
];

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Generate a realistic user object.
 */
const generateUser = (index, role = "member") => {
  const name = NAMES[index % NAMES.length];
  const firstName = name.split(" ")[0].toLowerCase();
  
  const timezoneMap = {
    "UTC": "United Kingdom",
    "America/New_York": "United States",
    "Europe/London": "United Kingdom",
    "Asia/Tokyo": "Japan"
  };
  
  const tz = getRandom(["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"]);
  
  return {
    name,
    email: `${firstName}${index}@hackhive.demo`,
    password: "Password123", // Will be hashed by model
    role,
    bio: getRandom(BIOS),
    timezone: tz,
    country: timezoneMap[tz] || "United States",
    isDemoAccount: true
  };
};

/**
 * Generate a realistic meeting object.
 */
const generateMeeting = (organizerId, participantIds, startTime, durationMinutes = 30) => {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
  return {
    title: getRandom(MEETING_TITLES),
    description: getRandom(DESCRIPTIONS),
    organizer: organizerId,
    participants: participantIds.map(id => ({ user: id, rsvp: "accepted" })),
    startTime,
    endTime,
    status: startTime < new Date() ? "completed" : "scheduled",
    remindersSent: startTime < new Date()
  };
};

/**
 * Generate a realistic time slot.
 */
const generateSlot = (hostId, startTime, durationMinutes = 30) => {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
  return {
    host: hostId,
    startTime,
    endTime,
    isBooked: false
  };
};

module.exports = {
  generateUser,
  generateMeeting,
  generateSlot,
  getRandom
};
