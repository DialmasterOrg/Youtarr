const createHealthRoutes = require('./health');
const createAuthRoutes = require('./auth');
const createSetupRoutes = require('./setup');
const createConfigRoutes = require('./config');
const createChannelRoutes = require('./channels');
const createVideoRoutes = require('./videos');
const createJobRoutes = require('./jobs');
const createPlexRoutes = require('./plex');
const createApiKeyRoutes = require('./apikeys');
const createSubscriptionRoutes = require('./subscriptions');
const createVideoDetailRoutes = require('./videoDetail');
const createVideoSearchRoutes = require('./videoSearch');
const createChannelSearchRoutes = require('./channelSearch');
const createPlaylistRoutes = require('./playlists');
const createMediaServerRoutes = require('./mediaServers');
const createYoutubeApiKeyRoutes = require('./youtubeApiKey');
const createYtdlpOptionsRoutes = require('./ytdlpOptions');
const createMaintenanceRoutes = require('./maintenance');
const createSubfolderRoutes = require('./subfolders');
const createExternalRequestReviewRoutes = require('./externalRequests');
const { createExternalApiRoutes } = require('./externalApi');
const { sendExternalError } = require('../modules/externalApiResponse');
const videoMetadataModule = require('../modules/videoMetadataModule');
const videoOembedEnricher = require('../modules/videoOembedEnricher');
const playlistModule = require('../modules/playlistModule');
const m3uGenerator = require('../modules/m3uGenerator');
const mediaServers = require('../modules/mediaServers');
const channelSettingsModule = require('../modules/channelSettingsModule');
const channelDownloadAllModule = require('../modules/channelDownloadAllModule');
const ratingMapper = require('../modules/ratingMapper');
const subfolderModule = require('../modules/subfolderModule');
const playlistVideoFilters = require('../modules/playlistVideoFilters');
const models = require('../models');
const videoLocalStatus = require('../modules/videoLocalStatus');
const videoActivity = require('../modules/download/videoActivity');
const externalCatalogService = require('../modules/externalCatalogService');
const externalThumbnailProxy = require('../modules/externalThumbnailProxy');
const { sharedExternalWorkLimiter } = require('../modules/externalWorkLimiter');
const { createExternalRequestService } = require('../modules/externalRequestService');
const { createExternalQuotaService } = require('../modules/externalQuotaService');
const { isExternalApiEnabled } = require('../modules/externalApiConfig');

/**
 * Registers all route modules with the Express app
 * @param {Object} app - Express application
 * @param {Object} deps - Dependencies to inject into route modules
 */
function registerRoutes(app, deps) {
  const externalRequestService = createExternalRequestService();
  const externalQuotaService = createExternalQuotaService();
  const {
    verifyToken,
    loginLimiter,
    setupCreateAuthLimiter,
    youtubeApiKeyTestLimiter,
    ytdlpValidationRateLimiter,
    filenamePreviewRateLimiter,
    configModule,
    channelModule,
    plexModule,
    downloadModule,
    jobModule,
    videosModule,
    archiveModule,
    subscriptionImportModule,
    videoSearchModule,
    channelSearchModule,
    youtubeApi,
    getCachedYtDlpVersion,
    refreshYtDlpVersionCache,
    validateEnvAuthCredentials,
    setupTokenModule,
    getClientAddress,
    isWslEnvironment,
    externalApiAuth,
    externalApiIngressLimiter,
    externalApiLimiter,
    externalApiWriteLimiter,
    recordExternalApiUse,
    externalRequestReviewLimiter,
    serverVersion,
  } = deps;

  // Health routes (no auth required for health checks, but yt-dlp endpoints are authenticated)
  app.use(createHealthRoutes({ getCachedYtDlpVersion, refreshYtDlpVersionCache, verifyToken, configModule }));

  // Auth routes
  app.use(createAuthRoutes({ verifyToken, loginLimiter, configModule, getClientAddress }));

  // Setup routes
  app.use(createSetupRoutes({ configModule, setupTokenModule, setupCreateAuthLimiter, getClientAddress }));

  // Config routes
  app.use(createConfigRoutes({ verifyToken, configModule, validateEnvAuthCredentials, isWslEnvironment, filenamePreviewRateLimiter }));

  // Channel routes
  app.use(createChannelRoutes({ verifyToken, channelModule, archiveModule, channelDownloadAllModule, ratingMapper }));

  // Video routes
  app.use(createVideoRoutes({ verifyToken, videosModule, downloadModule, videoOembedEnricher, videoLocalStatus }));

  // Video search routes
  app.use(createVideoSearchRoutes({ verifyToken, videoSearchModule }));

  // Channel search routes
  app.use(createChannelSearchRoutes({ verifyToken, channelSearchModule }));

  // YouTube API key test route
  app.use(createYoutubeApiKeyRoutes({ verifyToken, youtubeApiKeyTestLimiter, youtubeApi, configModule }));

  // yt-dlp options validation route
  app.use(createYtdlpOptionsRoutes({ verifyToken, ytdlpValidationRateLimiter }));

  // Job routes
  app.use(createJobRoutes({ verifyToken, jobModule, downloadModule, videoActivity }));

  // Plex routes
  app.use(createPlexRoutes({ verifyToken, plexModule, configModule }));

  // API Key routes
  app.use(createApiKeyRoutes({ verifyToken }));

  // Session-authenticated administrator review of external requests
  app.use(createExternalRequestReviewRoutes({
    verifyToken,
    reviewLimiter: externalRequestReviewLimiter,
    requestService: externalRequestService,
  }));

  // Subscription import routes
  app.use(createSubscriptionRoutes({ verifyToken, subscriptionImportModule }));

  // Video detail routes (metadata and streaming)
  app.use(createVideoDetailRoutes({ verifyToken, videoMetadataModule, mediaServers }));

  // Playlist routes
  app.use(createPlaylistRoutes({ verifyToken, playlistModule, downloadModule, m3uGenerator, mediaServers, models, channelSettingsModule, ratingMapper, subfolderModule, playlistVideoFilters }));

  // Media server routes
  app.use(createMediaServerRoutes({ verifyToken, configModule, mediaServers }));

  // Maintenance routes
  app.use(createMaintenanceRoutes({ verifyToken, videosModule, configModule }));

  // Subfolder registry routes
  app.use(createSubfolderRoutes({ verifyToken, subfolderModule }));

  // The versioned external API stays unreachable until a deployment opts in
  // explicitly. This fail-closed default is independent of AUTH_ENABLED.
  if (isExternalApiEnabled()) {
    app.use('/external-api/v1', createExternalApiRoutes({
      externalApiAuth,
      externalApiIngressLimiter,
      externalApiLimiter,
      externalApiWriteLimiter,
      recordExternalApiUse,
      serverVersion,
      catalogService: externalCatalogService,
      thumbnailProxy: externalThumbnailProxy,
      externalWorkLimiter: sharedExternalWorkLimiter,
      requestService: externalRequestService,
      quotaService: externalQuotaService,
    }));
  }
  // Do not allow unknown or disabled external routes to fall through to the
  // SPA. Keep the public namespace on the same versioned error contract.
  app.use('/external-api', (req, res) =>
    sendExternalError(res, 404, 'External API route not found', {
      code: 'not_found',
      requestId: req.id,
    })
  );

  // Defensive redirect: /channels -> /subscriptions (frontend handles client-side routing,
  // this fallback covers direct server-side hits during the transition period)
  app.get('/channels', (req, res) => res.redirect(301, '/subscriptions'));
}

module.exports = { registerRoutes };
