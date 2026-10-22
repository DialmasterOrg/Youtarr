'use strict';

function isExternalApiEnabled(value = process.env.EXTERNAL_API_ENABLED) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

module.exports = {
  isExternalApiEnabled,
};
