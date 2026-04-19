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
const videoMetadataModule = require('../modules/videoMetadataModule');
const videoOembedEnricher = require('../modules/videoOembedEnricher');

/**
 * Registers all route modules with the Express app
 * @param {Object} app - Express application
 * @param {Object} deps - Dependencies to inject into route modules
 */
function registerRoutes(app, deps) {
  const {
    verifyToken,
    loginLimiter,
    configModule,
    channelModule,
    plexModule,
    downloadModule,
    jobModule,
    videosModule,
    archiveModule,
    subscriptionImportModule,
    videoSearchModule,
    getCachedYtDlpVersion,
    refreshYtDlpVersionCache,
    validateEnvAuthCredentials,
    isLocalhostIP,
    isWslEnvironment,
  } = deps;

  // Health routes (no auth required for health checks, but yt-dlp endpoints are authenticated)
  app.use(createHealthRoutes({ getCachedYtDlpVersion, refreshYtDlpVersionCache, verifyToken }));

  // Auth routes
  app.use(createAuthRoutes({ verifyToken, loginLimiter, configModule }));

  // Setup routes
  app.use(createSetupRoutes({ configModule, isLocalhostIP }));

  // Config routes
  app.use(createConfigRoutes({ verifyToken, configModule, validateEnvAuthCredentials, isWslEnvironment }));

  // Channel routes
  app.use(createChannelRoutes({ verifyToken, channelModule, archiveModule }));

  // Video routes
  app.use(createVideoRoutes({ verifyToken, videosModule, downloadModule, videoOembedEnricher }));

  // Video search routes
  app.use(createVideoSearchRoutes({ verifyToken, videoSearchModule }));

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
}

module.exports = { registerRoutes };

