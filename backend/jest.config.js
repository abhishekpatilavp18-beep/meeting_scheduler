module.exports = {
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  clearMocks: true,
  testMatch: ["**/*.test.js"],
  collectCoverageFrom: [
    "controllers/**/*.js",
    "models/**/*.js",
    "services/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  verbose: true,
  // Limit workers to 1 or 2 for DB tests to avoid connection pool exhaustion
  maxWorkers: 1, 
};
