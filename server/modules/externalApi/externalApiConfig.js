'use strict';

function isExternalApiEnabled(value = process.env.EXTERNAL_API_ENABLED) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

const EXTERNAL_API_MOUNT = '/external-api';

// Express matches the /external-api mount case-insensitively, so app-level
// checks that decide which body parser and error envelope apply must too.
function isExternalApiPath(req) {
  const requestPath = String(req?.path || '').toLowerCase();
  return requestPath === EXTERNAL_API_MOUNT || requestPath.startsWith(`${EXTERNAL_API_MOUNT}/`);
}

module.exports = {
  isExternalApiEnabled,
  isExternalApiPath,
};
