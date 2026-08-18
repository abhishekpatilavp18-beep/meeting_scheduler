const logger = require("../utils/logger");

/**
 * Simple In-Memory Cache Middleware
 * 
 * @param {number} ttl - Time to live in seconds
 */
const cache = (ttl = 60) => {
  const store = new Map();

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Generate unique key based on original URL and user (if authenticated)
    const key = `${req.user?._id || "anon"}:${req.originalUrl}`;
    const cachedResponse = store.get(key);

    if (cachedResponse && Date.now() < cachedResponse.expiry) {
      logger.info(`💾 Cache hit: ${key}`);
      return res.status(200).json(cachedResponse.body);
    }

    // Intercept res.json to store the response
    const originalJson = res.json;
    res.json = function (body) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, {
          body,
          expiry: Date.now() + ttl * 1000,
        });
      }
      return originalJson.call(this, body);
    };

    next();
  };
};

module.exports = cache;
