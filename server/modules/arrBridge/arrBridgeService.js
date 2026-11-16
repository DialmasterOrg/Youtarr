// Composition root of the Sonarr/Radarr bridge: wires the sub-modules to the
// stateful modules server.js hands in, owns the bridge key, and starts or
// stops the grab executor as the feature is switched on or off.
const { Op } = require('sequelize');
const { isAuthorized, isEnabled, readSettings } = require('./arrBridgeConfig');
const { createArrBridgeSettings } = require('./arrBridgeSettings');
const { createArrCatalog } = require('./arrCatalog');
const { createArrClient } = require('./arrClient');
const { createGrabExecutor } = require('./grabExecutor');
const { createGrabService, grabState } = require('./grabService');
const { createLibraryCopyRemover, libraryCopyView } = require('./libraryCopyRemover');
const { createNewznabApi } = require('./newznabApi');
const { createSabnzbdApi } = require('./sabnzbdApi');
const { createSearchBudget } = require('./searchBudget');
const { createSearchQueue } = require('./searchQueue');
const { createSearchService } = require('./searchService');
const { createStaging } = require('./staging');
const { createVideoResolution, tierOfPixels } = require('./videoResolution');

const ORIGINAL_DATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/;
const PIXEL_SIZE_PATTERN = /^(\d+)x(\d+)$/;
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
 * The resolution Sonarr or Radarr will read from each library file, which a
 * grab hands over as it is. A removed row has no file, and a size that is
 * missing or "0x0" (a failed probe) says nothing about the video.
 * @param {Object} models - { Video }
 * @returns {Function} (youtubeIds) => Promise<Map<string, number>>
 */
function createLibraryResolutionLookup({ Video }) {
  return async function libraryResolutions(youtubeIds) {
    const tiers = new Map();
    if (youtubeIds.length === 0) return tiers;
    const rows = await Video.findAll({
      where: { youtubeId: { [Op.in]: youtubeIds }, removed: false },
      attributes: ['youtubeId', 'video_resolution'],
      raw: true,
    });
    for (const row of rows) {
      const match = PIXEL_SIZE_PATTERN.exec(row.video_resolution ?? '');
      if (!match) continue;
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width > 0 && height > 0) tiers.set(row.youtubeId, tierOfPixels(width, height));
    }
    return tiers;
  };
}

/**
 * @param {Object} deps
 * @param {Object} deps.configModule
 * @param {Object} deps.models - { ArrBridgeGrab, Video, ChannelVideo, Job }
 * @param {Function} deps.searchVideos - (query, count, { useApi, onApiUnits }) => Promise<Array>
 * @param {Function} deps.isYoutubeApiAvailable - () => boolean
 * @param {Function} deps.downloader - (jobData, { jobId }) => Promise<string|Object>
 * @param {Function} deps.jobLookup - (jobId) => the in-memory job, or null
 * @param {Object} deps.storageGuard - { isPausedError, getStatus }
 * @param {Function} deps.isArchived - (youtubeId) => the id is in the download archive
 * @param {Function} deps.getActivity - () => the current download activity snapshot
 * @param {Function} deps.removeVideo - (youtubeId, removal) => Promise<boolean>; deletes a library video
 * @param {Function} deps.probeResolution - (youtubeId) => Promise<number|null>; the highest resolution yt-dlp lists
 * @param {Object} deps.logger
 * @param {Function} [deps.createExecutor] - Test seam; defaults to createGrabExecutor
 * @param {Function} [deps.createClient] - Test seam; defaults to createArrClient
 */
function createArrBridgeService({
  configModule, models, searchVideos, isYoutubeApiAvailable, downloader, jobLookup, storageGuard,
  isArchived, getActivity, removeVideo, probeResolution, logger,
  createExecutor = createGrabExecutor, createClient = createArrClient,
}) {
  const getConfig = () => configModule.getConfig();
  const getSettings = () => readSettings(getConfig());
  let running = false;

  const staging = createStaging({ getOutputRoot: () => configModule.directoryPath, getSettings, logger });
  const arrClient = createClient();
  // Only acts while "remove after import" is on.
  const libraryCopies = createLibraryCopyRemover({ models, client: arrClient, getSettings, removeVideo, logger });
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
    onHandedOff: libraryCopies.request,
    settleLibraryCopies: libraryCopies.run,
    logger,
  });
  const grabService = createGrabService({
    models, getSettings, staging, wakeExecutor: () => executor.wake(), onHandedOff: libraryCopies.request, logger,
  });
  const settings = createArrBridgeSettings({ configModule, client: arrClient, staging, logger });
  // Bridge searches share the YouTube API quota with the rest of Youtarr: past
  // their daily share they use yt-dlp, except daily-show searches, which need
  // the API's exact dates.
  const searchBudget = createSearchBudget({ logger });
  const budgetedSearchVideos = (query, count, { needsApi } = {}) => searchVideos(query, count, {
    useApi: needsApi === true || searchBudget.allowsApi(),
    onApiUnits: searchBudget.spend,
  });
  const searchService = createSearchService({
    searchVideos: budgetedSearchVideos,
    isYoutubeApiAvailable,
    getConfig,
    knownUploadDates: createUploadDateLookup(models),
    recentlyFailedIds: grabService.recentlyFailedIds,
    queue: createSearchQueue(),
    // Optional: reads the user's own Sonarr and Radarr when they are set up.
    catalog: createArrCatalog({ client: arrClient, getSettings, logger }),
    videoResolution: createVideoResolution({
      libraryResolutions: createLibraryResolutionLookup(models),
      probe: probeResolution,
      logger,
    }),
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
    settings.getOrCreateKey();
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

  /**
   * The newest grabs for the Settings page, with the title of each video
   * Youtarr holds. Removed grabs are included: the list is a history.
   * @param {unknown} [limit]
   * @returns {Promise<Array<Object>>}
   */
  async function listRecentGrabs(limit) {
    const rows = await grabService.listRecent(limit);
    if (rows.length === 0) return [];
    const videos = await models.Video.findAll({
      where: { youtubeId: { [Op.in]: [...new Set(rows.map((row) => row.youtube_id))] } },
      attributes: ['youtubeId', 'youTubeVideoName', 'youTubeChannelName'],
      raw: true,
    });
    const videoById = new Map(videos.map((video) => [video.youtubeId, video]));
    return rows.map((row) => {
      const video = videoById.get(row.youtube_id);
      return {
        id: row.id,
        releaseTitle: row.release_title,
        youtubeId: row.youtube_id,
        videoTitle: video?.youTubeVideoName || null,
        channelName: video?.youTubeChannelName || null,
        kind: row.kind,
        category: row.category,
        state: grabState(row),
        failMessage: row.fail_message || null,
        libraryCopy: libraryCopyView(row),
        createdAt: row.created_at,
        completedAt: row.completed_at || null,
        removedAt: row.removed_at || null,
      };
    });
  }

  return {
    newznab,
    sabnzbd,
    settings,
    listRecentGrabs,
    isEnabled: () => isEnabled(getConfig()),
    isAuthorized: (candidate) => isAuthorized(getConfig(), candidate),
    start,
    stop,
    handleJobEnded: (event) => executor.handleJobEnded(event),
  };
}

module.exports = { createArrBridgeService, createUploadDateLookup, createLibraryResolutionLookup };
