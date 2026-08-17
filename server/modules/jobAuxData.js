// Serialization for the Jobs.aux_data column: everything in job.data except
// the videos array (which persists relationally via jobvideos). Both
// directions are total functions - persistence must never break job saving
// or loading.
const logger = require('../logger');

const MAX_PERSISTED_FAILED_VIDEOS = 1000;

function serializeAuxData(data) {
  if (!data || typeof data !== 'object') return null;

  const aux = { ...data };
  delete aux.videos;
  if (Object.keys(aux).length === 0) return null;

  // Keep the newest failures: groups append chronologically, and the tail is
  // what a user investigating a failure storm actually needs.
  if (Array.isArray(aux.failedVideos) && aux.failedVideos.length > MAX_PERSISTED_FAILED_VIDEOS) {
    aux.failedVideos = aux.failedVideos.slice(-MAX_PERSISTED_FAILED_VIDEOS);
  }

  try {
    return JSON.stringify(aux);
  } catch (err) {
    logger.warn({ err }, 'Failed to serialize job aux data; persisting without it');
    return null;
  }
}

function parseAuxData(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    logger.warn({ err }, 'Failed to parse job aux data; treating as empty');
    return {};
  }
}

module.exports = { serializeAuxData, parseAuxData, MAX_PERSISTED_FAILED_VIDEOS };
