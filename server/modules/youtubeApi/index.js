const client = require('./client');
const quotaTracker = require('./quotaTracker');
const { YoutubeApiErrorCode } = require('./errorClassifier');
const configModule = require('../configModule');

/**
 * Returns true when a non-empty youtubeApiKey is configured AND quota is not in cooldown.
 * Wrappers call this to decide whether to attempt the API at all.
 */
function isAvailable() {
  const key = configModule.getConfig().youtubeApiKey;
  if (!key || typeof key !== 'string' || key.length === 0) return false;
  if (quotaTracker.isInCooldown(key)) return false;
  return true;
}

function getApiKey() {
  return configModule.getConfig().youtubeApiKey || null;
}

module.exports = {
  client,
  quotaTracker,
  YoutubeApiErrorCode,
  isAvailable,
  getApiKey,
};
