'use strict';

module.exports = {
  // Phase 1 thumbnail enrichment
  THUMBNAIL_CONCURRENCY: 8,
  THUMBNAIL_FETCH_TIMEOUT_MS: 5000,
  THUMBNAIL_MAX_BYTES: 1024 * 1024,

  // Phase 1 cookies-based fetch
  COOKIES_FETCH_TIMEOUT_MS: 60 * 1000,
  COOKIES_FILE_MAX_BYTES: 5 * 1024 * 1024,
  COOKIES_RATE_LIMIT_WINDOW_MS: 60 * 1000,
  COOKIES_RATE_LIMIT_MAX: 3,

  // Phase 1 takeout
  TAKEOUT_FILE_MAX_BYTES: 5 * 1024 * 1024,

  // Phase 2 import runner
  IMPORT_CONCURRENCY: 3,

  // Shared
  JOB_TYPE: 'Import Subscriptions',
  WS_SOURCE: 'subscriptionImport',
};
