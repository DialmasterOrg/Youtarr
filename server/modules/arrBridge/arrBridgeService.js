// Composition root of the Sonarr/Radarr bridge: wires the sub-modules to the
// stateful modules server.js hands in, owns the bridge key, and starts or
// stops the grab executor as the feature is switched on or off.
const { Op } = require('sequelize');
const { generateKey, isAuthorized, isEnabled, readSettings } = require('./arrBridgeConfig');
const { createGrabExecutor } = require('./grabExecutor');
const { createGrabService } = require('./grabService');
const { createNewznabApi } = require('./newznabApi');
const { createSabnzbdApi } = require('./sabnzbdApi');
const { createSearchQueue } = require('./searchQueue');
const { createSearchService } = require('./searchService');
const { createStaging } = require('./staging');

const ORIGINAL_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
// An ordering-only placeholder, never a real date.
const ESTIMATED_DATE_SOURCE = 'estimated';

function parseOriginalDate(originalDate) {
  const match = ORIGINAL_DATE_PATTERN.exec(originalDate ?? '');
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseListingDate(row) {
  if (!row.publishedAt || row.published_at_source === ESTIMATED_DATE_SOURCE) return null;
  const date = new Date(row.publishedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Upload dates Youtarr already holds. Sonarr's blocklist needs an identical
 * publish date, and a yt-dlp search date drifts between searches, so a
 * stored date is preferred even when it is only a listing's approximation.
 * @param {Object} models - { Video, ChannelVideo }
 * @returns {Function} (youtubeIds) => Promise<Map<string, Date>>
 */
function createUploadDateLookup({ Video, ChannelVideo }) {
  return async function knownUploadDates(youtubeIds) {
    const dates = new Map();
    if (youtubeIds.length === 0) return dates;
    const [videos, listed] = await Promise.all([
      Video.findAll({
        where: { youtubeId: { [Op.in]: youtubeIds } },
        attributes: ['youtubeId', 'originalDate'],
        raw: true,
      }),
      ChannelVideo.findAll({
        where: { youtube_id: { [Op.in]: youtubeIds } },
        attributes: ['youtube_id', 'publishedAt', 'published_at_source'],
        raw: true,
      }),
    ]);
    for (const row of listed) {
      const date = parseListingDate(row);
      if (date) dates.set(row.youtube_id, date);
    }
    for (const row of videos) {
      const date = parseOriginalDate(row.originalDate);
      if (date) dates.set(row.youtubeId, date);
    }
    return dates;
  };
}

/**
 * @param {Object} deps
 * @param {Object} deps.configModule
 * @param {Object} deps.models - { ArrBridgeGrab, Video, ChannelVideo, Job }
 * @param {Function} deps.searchVideos - (query, count) => Promise<Array>
 * @param {Function} deps.isYoutubeApiAvailable - () => boolean
 * @param {Function} deps.downloader - (jobData, { jobId }) => Promise<string|Object>
 * @param {Function} deps.jobLookup - (jobId) => the in-memory job, or null
 * @param {Object} deps.storageGuard - { isPausedError, getStatus }
 * @param {Function} deps.isArchived - (youtubeId) => the id is in the download archive
 * @param {Function} deps.getActivity - () => the current download activity snapshot
 * @param {Object} deps.logger
 * @param {Function} [deps.createExecutor] - Test seam; defaults to createGrabExecutor
 */
function createArrBridgeService({
  configModule, models, searchVideos, isYoutubeApiAvailable, downloader, jobLookup, storageGuard,
  isArchived, getActivity, logger, createExecutor = createGrabExecutor,
}) {
  const getConfig = () => configModule.getConfig();
  const getSettings = () => readSettings(getConfig());
  let running = false;

  const staging = createStaging({ getOutputRoot: () => configModule.directoryPath, getSettings, logger });
  const executor = createExecutor({
    models,
    downloader,
    // The executor only downloads when no file is present, so an archived
    // id is one yt-dlp would skip.
    needsRedownload: async (youtubeId) => isArchived(youtubeId),
    jobLookup,
    storageGuard,
    staging,
    getSettings,
    logger,
  });
  const grabService = createGrabService({
    models, getSettings, staging, wakeExecutor: () => executor.wake(), logger,
  });
  const searchService = createSearchService({
    searchVideos,
    isYoutubeApiAvailable,
    getConfig,
    knownUploadDates: createUploadDateLookup(models),
    recentlyFailedIds: grabService.recentlyFailedIds,
    queue: createSearchQueue(),
    logger,
  });
  const newznab = createNewznabApi({ getConfig, searchService, logger });
  const sabnzbd = createSabnzbdApi({
    getConfig,
    grabService,
    staging,
    getActivity,
    isPaused: () => storageGuard.getStatus()?.paused === true,
  });

  // Applies the current config: creates the key the first time the bridge
  // is on, and keeps the executor running only while it is.
  function refresh() {
    const config = getConfig();
    if (!isEnabled(config)) {
      if (running) executor.stop();
      running = false;
      return;
    }
    if (!readSettings(config).apiKey) {
      // The key is server-owned like the feed token: stored unhashed so
      // Settings can show it again, and never written to a log.
      configModule.updateConfig({ ...config, arrBridgeApiKey: generateKey() });
      logger.info({ event: 'arr_bridge_key_created' }, 'Created the Sonarr/Radarr bridge key');
    }
    if (running) {
      // A changed category list needs its staging folders; the sweep makes them.
      executor.wake();
      return;
    }
    running = true;
    executor.start();
  }

  function start() {
    configModule.onConfigChange(refresh);
    refresh();
  }

  function stop() {
    if (running) executor.stop();
    running = false;
  }

  return {
    newznab,
    sabnzbd,
    isEnabled: () => isEnabled(getConfig()),
    isAuthorized: (candidate) => isAuthorized(getConfig(), candidate),
    start,
    stop,
    handleJobEnded: (event) => executor.handleJobEnded(event),
  };
}

module.exports = { createArrBridgeService, createUploadDateLookup };
