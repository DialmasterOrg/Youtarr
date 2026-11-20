// Composition root of the Sonarr/Radarr bridge: wires the sub-modules to the
// stateful modules server.js hands in, owns the bridge key, and starts or
// stops the grab executor as the feature is switched on or off.
const { Op } = require('sequelize');
const { isAuthorized, isEnabled, readSettings } = require('./arrBridgeConfig');
const { createArrBridgeSettings } = require('./arrBridgeSettings');
const { createArrCatalog } = require('./arrCatalog');
const { createArrClient } = require('./arrClient');
const { createGrabExecutor } = require('./grabExecutor');
const { createGrabService, grabState, isGrabId } = require('./grabService');
const { createLibraryCopyRemover, libraryCopyView } = require('./libraryCopyRemover');
const { createNewznabApi } = require('./newznabApi');
const { createRecentSearches } = require('./recentSearches');
const { createSearchHistory } = require('./searchHistory');
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
 * @param {Object} deps.models - { ArrBridgeGrab, ArrBridgeSearch, Video, ChannelVideo, Job }
 * @param {Function} deps.searchVideos - (query, count, { useApi, onApiUnits }) => Promise<Array>
 * @param {Function} deps.isYoutubeApiAvailable - () => boolean
 * @param {Function} deps.downloader - (jobData, { jobId }) => Promise<string|Object>
 * @param {Function} deps.jobLookup - (jobId) => the in-memory job, or null
 * @param {Object} deps.storageGuard - { isPausedError, getStatus }
 * @param {Function} deps.isArchived - (youtubeId) => the id is in the download archive
 * @param {Function} deps.getActivity - () => the current download activity snapshot
 * @param {Function} deps.removeVideo - (youtubeId, removal) => Promise<boolean>; deletes a library video
 * @param {Function} deps.probeResolution - (youtubeId) => Promise<number|null>; the highest resolution yt-dlp lists
 * @param {Function} [deps.getHostDownloadsFolder] - () => the downloads folder as the host knows it, or null
 * @param {Function} [deps.getCookieKey] - () => what identifies the cookie file in use, or null
 * @param {Object} deps.logger
 * @param {Function} [deps.createExecutor] - Test seam; defaults to createGrabExecutor
 * @param {Function} [deps.createClient] - Test seam; defaults to createArrClient
 */
function createArrBridgeService({
  configModule, models, searchVideos, isYoutubeApiAvailable, downloader, jobLookup, storageGuard,
  isArchived, getActivity, removeVideo, probeResolution, getHostDownloadsFolder, getCookieKey, logger,
  createExecutor = createGrabExecutor, createClient = createArrClient,
}) {
  const getConfig = () => configModule.getConfig();
  const getSettings = () => readSettings(getConfig());
  let running = false;
  const isPaused = () => storageGuard.getStatus()?.paused === true;

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
    // New cookies end the wait of grabs YouTube blocked.
    getCookieKey,
    isPaused,
    logger,
  });
  const grabService = createGrabService({
    models, getSettings, staging, wakeExecutor: () => executor.wake(), onHandedOff: libraryCopies.request, logger,
  });
  const settings = createArrBridgeSettings({
    configModule, client: arrClient, staging, getHostDownloadsFolder, logger,
  });
  // Bridge searches share the YouTube API quota with the rest of Youtarr: past
  // their daily share they use yt-dlp, except daily-show searches, which need
  // the API's exact dates.
  const searchBudget = createSearchBudget({ logger });
  const budgetedSearchVideos = (query, count, { needsApi } = {}) => searchVideos(query, count, {
    useApi: needsApi === true || searchBudget.allowsApi(),
    onApiUnits: searchBudget.spend,
  });
  // What the Settings page shows under "Recent searches". A search is stored
  // after it is answered, so the answer never waits for the database.
  const searchHistory = createSearchHistory({ models, logger });
  const recentSearches = createRecentSearches({
    save: (entry) => {
      searchHistory.record(entry);
    },
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
    recentSearches,
    logger,
  });
  const newznab = createNewznabApi({ getConfig, searchService, logger });
  const sabnzbd = createSabnzbdApi({
    getConfig,
    grabService,
    staging,
    getActivity,
    isPaused,
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
   * One page of grabs for the Settings page, newest first, with the title
   * of each video Youtarr holds. Removed grabs are included: the list is a
   * history.
   * @param {Object} [query] - { page, pageSize, q }
   * @returns {Promise<{grabs: Array<Object>, total: number, page: number, pageSize: number}>}
   */
  async function listRecentGrabs(query) {
    const { rows, total, page, pageSize } = await grabService.listRecent(query);
    const block = executor.blockStatus();
    const grabs = rows.map((row) => toGrabView(row, block));
    return { grabs, total, page, pageSize };
  }

  function toGrabView(row, block) {
    const state = grabState(row, { blockActive: block.active });
    return {
      id: row.id,
      releaseTitle: row.release_title,
      youtubeId: row.youtube_id,
      videoTitle: row.video?.youTubeVideoName || null,
      channelName: row.video?.youTubeChannelName || null,
      kind: row.kind,
      category: row.category,
      state,
      failMessage: row.fail_message || null,
      // Set when YouTube blocked this grab's own download; a grab can also
      // be "blocked" because it waits behind another grab's block.
      blockedAt: state === 'blocked' ? row.blocked_at || null : null,
      nextTryAt: state === 'blocked' ? block.nextTryAt : null,
      // What a blocked grab also waits for: the user's "Try again" that is
      // still to be carried out, and downloads paused by a storage limit.
      retryRequested: state === 'blocked' && executor.isRetryRequested(row.id),
      downloadsPaused: state === 'blocked' && isPaused(),
      hiddenUntil: grabService.hiddenUntilOf(row),
      libraryCopy: libraryCopyView(row),
      createdAt: row.created_at,
      completedAt: row.completed_at || null,
      removedAt: row.removed_at || null,
    };
  }

  /**
   * The Settings page's "Try again" on a waiting grab.
   * @param {string} id
   * @returns {Promise<'started'|'queued'|'paused'|'ready'|'deferred'|null>} null when the grab is not waiting
   */
  async function retryGrab(id) {
    if (!isEnabled(getConfig()) || !isGrabId(id)) return null;
    return executor.retryNow(id);
  }

  return {
    newznab,
    sabnzbd,
    settings,
    listRecentGrabs,
    retryGrab,
    listRecentSearches: (query) => searchHistory.list(query),
    isEnabled: () => isEnabled(getConfig()),
    isAuthorized: (candidate) => isAuthorized(getConfig(), candidate),
    start,
    stop,
    handleJobEnded: (event) => executor.handleJobEnded(event),
  };
}

module.exports = { createArrBridgeService, createUploadDateLookup, createLibraryResolutionLookup };
