const rateLimit = require('express-rate-limit');

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Build a rate limiter on the app's defaults: a one minute window, the
 * standard RateLimit-* headers only, and no trust proxy warning (the app runs
 * in Docker behind a proxy).
 *
 * @param {Object} options - express-rate-limit options, which win over the
 *   defaults above (`validate: { ... }` overrides them key by key), plus:
 * @param {string} [options.error] - answer a limited request with
 *   `{ error }` as JSON. Leave it out to pass `message` or `handler`.
 * @returns {Function} Express middleware
 */
function createRateLimiter({ error, validate, ...options }) {
  // A custom key replaces the client IP, so the IP check has nothing to check.
  const validateDefaults = { trustProxy: false, ...(options.keyGenerator ? { ip: false } : {}) };
  const isOverrideObject = typeof validate === 'object' && validate !== null;

  return rateLimit({
    windowMs: ONE_MINUTE_MS,
    standardHeaders: true,
    legacyHeaders: false,
    ...(error ? { message: { error } } : {}),
    ...options,
    validate: isOverrideObject ? { ...validateDefaults, ...validate } : validate ?? validateDefaults,
  });
}

module.exports = { createRateLimiter };
