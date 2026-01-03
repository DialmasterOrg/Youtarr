const createHealthRoutes = require('./health');
const createAuthRoutes = require('./auth');
const createSetupRoutes = require('./setup');
const createConfigRoutes = require('./config');
const createChannelRoutes = require('./channels');
const createVideoRoutes = require('./videos');
const createJobRoutes = require('./jobs');
const createPlexRoutes = require('./plex');
const createApiKeyRoutes = require('./apikeys');

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
    getCachedYtDlpVersion,
    validateEnvAuthCredentials,
    isLocalhostIP,
    isWslEnvironment,
  } = deps;

  // Health routes (no auth required for health checks)
  app.use(createHealthRoutes({ getCachedYtDlpVersion }));

  // Auth routes
  app.use(createAuthRoutes({ verifyToken, loginLimiter, configModule }));

  // Setup routes
  app.use(createSetupRoutes({ configModule, isLocalhostIP }));

  // Config routes
  app.use(createConfigRoutes({ verifyToken, configModule, validateEnvAuthCredentials, isWslEnvironment }));

  // Channel routes
  app.use(createChannelRoutes({ verifyToken, channelModule, archiveModule }));

  // Video routes
  app.use(createVideoRoutes({ verifyToken, videosModule, downloadModule }));

  // Job routes
  app.use(createJobRoutes({ verifyToken, jobModule, downloadModule }));

  // Plex routes
  app.use(createPlexRoutes({ verifyToken, plexModule, configModule }));

  // API Key routes
  app.use(createApiKeyRoutes({ verifyToken }));
}

module.exports = { registerRoutes };

