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
const createPlaylistRoutes = require('./playlists');
const createMediaServerRoutes = require('./mediaServers');
const createYoutubeApiKeyRoutes = require('./youtubeApiKey');
const createYtdlpOptionsRoutes = require('./ytdlpOptions');
const createMaintenanceRoutes = require('./maintenance');
const videoMetadataModule = require('../modules/videoMetadataModule');
const videoOembedEnricher = require('../modules/videoOembedEnricher');
const playlistModule = require('../modules/playlistModule');
const m3uGenerator = require('../modules/m3uGenerator');
const mediaServers = require('../modules/mediaServers');
const channelSettingsModule = require('../modules/channelSettingsModule');
const ratingMapper = require('../modules/ratingMapper');
const models = require('../models');

/**
 * Registers all route modules with the Express app
 * @param {Object} app - Express application
 * @param {Object} deps - Dependencies to inject into route modules
 */
function registerRoutes(app, deps) {
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
    youtubeApi,
    getCachedYtDlpVersion,
    refreshYtDlpVersionCache,
    validateEnvAuthCredentials,
    setupTokenModule,
    getClientAddress,
    isWslEnvironment,
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
  app.use(createChannelRoutes({ verifyToken, channelModule, archiveModule }));

  // Video routes
  app.use(createVideoRoutes({ verifyToken, videosModule, downloadModule, videoOembedEnricher }));

  // Video search routes
  app.use(createVideoSearchRoutes({ verifyToken, videoSearchModule }));

  // YouTube API key test route
  app.use(createYoutubeApiKeyRoutes({ verifyToken, youtubeApiKeyTestLimiter, youtubeApi, configModule }));

  // yt-dlp options validation route
  app.use(createYtdlpOptionsRoutes({ verifyToken, ytdlpValidationRateLimiter }));

  // Job routes
  app.use(createJobRoutes({ verifyToken, jobModule, downloadModule }));

  // Plex routes
  app.use(createPlexRoutes({ verifyToken, plexModule, configModule }));

  // API Key routes
  app.use(createApiKeyRoutes({ verifyToken }));

  // Subscription import routes
  app.use(createSubscriptionRoutes({ verifyToken, subscriptionImportModule }));

  // Video detail routes (metadata and streaming)
  app.use(createVideoDetailRoutes({ verifyToken, videoMetadataModule }));

  // Playlist routes
  app.use(createPlaylistRoutes({ verifyToken, playlistModule, downloadModule, m3uGenerator, mediaServers, models, channelSettingsModule, ratingMapper }));

  // Media server routes
  app.use(createMediaServerRoutes({ verifyToken, configModule, mediaServers }));

  // Maintenance routes
  app.use(createMaintenanceRoutes({ verifyToken, videosModule, configModule }));

  // Defensive redirect: /channels -> /subscriptions (frontend handles client-side routing,
  // this fallback covers direct server-side hits during the transition period)
  app.get('/channels', (req, res) => res.redirect(301, '/subscriptions'));
}

module.exports = { registerRoutes };
