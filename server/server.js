const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('./logger');
const pinoHttp = require('pino-http');
const { setupSwagger } = require('./swagger');
const app = express();
app.set('trust proxy', true); // Trust proxy headers for correct IP detection

// Setup HTTP request logging with pino-http
// This must come after trust proxy but before other middleware
app.use(pinoHttp({
  logger: logger,
  // Skip noisy endpoints to reduce log clutter
  autoLogging: {
    ignore: (req) => {
      const noisyEndpoints = [
        '/api/health',
        '/getCurrentReleaseVersion',
        '/getconfig',
        '/api/storage/status'
      ];
      return noisyEndpoints.includes(req.url);
    }
  },
  // Generate unique request ID for correlation
  genReqId: (req) => {
    const existingId = req.id || req.headers['x-request-id'];
    if (existingId) return existingId;
    return require('crypto').randomUUID();
  },
  // Only log warnings and errors at info level, success at debug
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    // Successful requests go to debug level to reduce noise
    return 'debug';
  },
  // Use minimal serializers to reduce verbosity
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      // Only include query/params if they exist
      ...(Object.keys(req.query || {}).length > 0 && { query: req.query }),
      ...(Object.keys(req.params || {}).length > 0 && { params: req.params }),
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  // Customize the success message to be more concise
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err?.message || 'Error'}`;
  },
}));

app.use(express.json());
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const db = require('./db');
const databaseHealth = require('./modules/databaseHealthModule');
const http = require('http');
const bcrypt = require('bcrypt');
const userNameMaxLength = 32;
const userNameMinLength = 3;
const passwordMaxLength = 64;
const passwordMinLength = 8;

// Helper function to check if IP is localhost
function isLocalhostIP(ip) {
  if (!ip) return false;

  // Clean up IP address - handle various formats
  const cleanIP = ip.replace(/^::ffff:/, '').replace(/^::1$/, '::1');

  // List of localhost IPs (IPv4 and IPv6)
  const localhostIPs = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1',
    '0:0:0:0:0:0:0:1'
  ];

  // Check if IP is localhost
  const isLocal = localhostIPs.includes(cleanIP) ||
         localhostIPs.includes(ip) ||
         cleanIP.startsWith('127.') ||
         ip.includes('localhost') ||
         ip === '::' ||
         ip === '0.0.0.0';

  return isLocal;
}

// Helper function to validate ENV auth credentials
function validateEnvAuthCredentials() {
  const presetUsername = process.env.AUTH_PRESET_USERNAME;
  const presetPassword = process.env.AUTH_PRESET_PASSWORD;

  // Both must be set
  if (!presetUsername || !presetPassword) {
    return false;
  }

  // Username validation
  const trimmedUsername = presetUsername.trim();
  if (!trimmedUsername) {
    return false;
  }
  if (trimmedUsername.length < userNameMinLength || trimmedUsername.length > userNameMaxLength) {
    logger.error('AUTH_PRESET_USERNAME does not meet length requirements');
    logger.error(`AUTH_PRESET_USERNAME must be between ${userNameMinLength} and ${userNameMaxLength} characters`);
    return false;
  }

  // Password validation (NOT trimmed)
  if (presetPassword.length < passwordMinLength || presetPassword.length > passwordMaxLength) {
    logger.error('AUTH_PRESET_PASSWORD does not meet length requirements');
    logger.error(`AUTH_PRESET_PASSWORD must be between ${passwordMinLength} and ${passwordMaxLength} characters`);
    return false;
  }

  return true;
}

let cachedYtDlpVersion = null;
let ytDlpVersionInitialized = false;

// Helper function to refresh cached yt-dlp version
function refreshYtDlpVersionCache() {
  try {
    cachedYtDlpVersion = execSync('yt-dlp --version', { encoding: 'utf8' }).trim();
  } catch (error) {
    logger.warn({ err: error }, 'Failed to get yt-dlp version');
    cachedYtDlpVersion = null;
  } finally {
    ytDlpVersionInitialized = true;
  }

  return cachedYtDlpVersion;
}

function getCachedYtDlpVersion() {
  if (!ytDlpVersionInitialized) {
    return refreshYtDlpVersionCache();
  }

  return cachedYtDlpVersion;
}

const isWslEnvironment = (() => {
  if (process.platform !== 'linux') {
    return false;
  }

  if (process.env.WSL_INTEROP || process.env.WSL_DISTRO_NAME) {
    return true;
  }

  try {
    const osRelease = fs.readFileSync('/proc/sys/kernel/osrelease', 'utf8');
    return osRelease.toLowerCase().includes('microsoft');
  } catch (error) {
    return false;
  }
})();

const initialize = async () => {
  try {
    // Wait for the database to initialize
    await db.initializeDatabase();

    // Start background health monitor to handle database reconnection (skip in tests)
    if (process.env.NODE_ENV !== 'test') {
      databaseHealth.startHealthMonitor(db.reinitializeDatabase, db.sequelize);
    }

    const configModule = require('./modules/configModule');
    const channelModule = require('./modules/channelModule');
    const plexModule = require('./modules/plexModule');
    const downloadModule = require('./modules/downloadModule');
    const jobModule = require('./modules/jobModule');
    const videosModule = require('./modules/videosModule');
    const archiveModule = require('./modules/archiveModule');
    const { registerRoutes } = require('./routes');

    // Cache yt-dlp version once during startup to keep the version endpoint fast
    refreshYtDlpVersionCache();

    // Apply ENV auth credentials if valid
    if (validateEnvAuthCredentials()) {
      const presetUsername = process.env.AUTH_PRESET_USERNAME;
      const presetPassword = process.env.AUTH_PRESET_PASSWORD;
      const trimmedUsername = presetUsername.trim();
      const config = configModule.getConfig();

      const passwordHash = await bcrypt.hash(presetPassword, 10);
      config.username = trimmedUsername;
      config.passwordHash = passwordHash;
      config.envAuthApplied = true;
      configModule.updateConfig(config);
      logger.info('Applied ENV AUTH credentials and saved to config.json');
    } else if (process.env.AUTH_PRESET_USERNAME || process.env.AUTH_PRESET_PASSWORD) {
      // Credentials were provided but failed validation
      logger.warn('Ignoring ENV AUTH credentials: both AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD must be set and meet requirements (username: 3-32 chars, password: 8-64 chars)');
    }

    channelModule.subscribe();

    logger.info({ directoryPath: configModule.directoryPath }, 'YouTube downloads directory configured');

    // Degraded mode middleware - checks database health before processing requests
    const checkDatabaseHealth = function(req, res, next) {
      // Skip health check for the db-status endpoint itself
      if (req.path === '/api/db-status') {
        return next();
      }

      // INVERTED LOGIC: Allow only what's needed to serve the React app (fail-safe by default)
      // Everything else is blocked when DB is unhealthy

      // Allow static assets (JS, CSS, images, fonts, etc.)
      const isStaticAsset = req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json|txt)$/i);
      if (isStaticAsset) {
        return next();
      }

      // Allow requests for HTML pages (React SPA and deep links)
      // Check Accept header for browsers requesting HTML
      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      const isGetRequest = req.method === 'GET';

      // Allow GET requests that accept HTML (this covers React Router deep links)
      if (isGetRequest && acceptsHtml) {
        return next();
      }

      // Allow static file paths explicitly
      if (req.path.startsWith('/static/') ||
          req.path.startsWith('/images/') ||
          req.path === '/favicon.ico' ||
          req.path === '/manifest.json' ||
          req.path === '/asset-manifest.json') {
        return next();
      }

      // Everything else is treated as an API call - block if DB unhealthy
      if (!databaseHealth.isDatabaseHealthy()) {
        const health = databaseHealth.getStartupHealth();

        // Determine the type of error
        let errorType, errorMessage;
        if (!health.database.connected) {
          errorType = 'Database Connection Failed';
          errorMessage = 'Unable to connect to the database. Please ensure the database server is running and accessible.';
        } else if (!health.database.schemaValid) {
          errorType = 'Database Schema Mismatch';
          errorMessage = 'The database schema does not match the application models. This usually means migrations need to be run or the code is out of sync with the database.';
        } else {
          errorType = 'Database Error';
          errorMessage = 'A database error has occurred. Please check the logs for details.';
        }

        return res.status(503).json({
          error: errorType,
          message: errorMessage,
          requiresDbFix: true,
          details: health.database.errors
        });
      }

      next();
    };

    const verifyToken = async function(req, res, next) {
      if (process.env.AUTH_ENABLED === 'false') {
        return next();
      }

      const config = configModule.getConfig();

      // If no password hash exists, authentication is not configured
      // Only allow setup endpoints in this state
      if (!config.passwordHash) {
        if (req.path.startsWith('/setup')) {
          const clientIP = req.ip || req.connection.remoteAddress;
          const isLocalhost = isLocalhostIP(clientIP);

          if (!isLocalhost) {
            return res.status(403).json({
              error: 'Initial setup can only be performed from localhost',
              instruction: 'Please access from http://localhost:3087'
            });
          }
          return next();
        } else {
          // Reject ALL other endpoints if auth not configured
          return res.status(503).json({
            error: 'Authentication not configured',
            requiresSetup: true,
            message: 'Please complete initial setup first'
          });
        }
      }

      // Check for API key first (x-api-key header)
      const apiKey = req.headers['x-api-key'];
      if (apiKey) {
        const apiKeyModule = require('./modules/apiKeyModule');
        const validKey = await apiKeyModule.validateApiKey(apiKey);
        if (validKey) {
          // API keys can ONLY access specific endpoints
          const allowedApiKeyEndpoints = [
            { method: 'POST', path: '/api/videos/download' },
          ];

          const isAllowed = allowedApiKeyEndpoints.some(
            e => req.method === e.method && req.path === e.path
          );

          if (!isAllowed) {
            return res.status(403).json({
              error: 'API keys can only access the download endpoint'
            });
          }

          req.authType = 'api_key';
          req.apiKeyId = validKey.id;
          req.apiKeyName = validKey.name;
          req.apiKeyRecord = validKey;
          return next();
        }
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Check for session token in headers
      const token = req.headers['x-access-token'];

      if (!token) {
        return res.status(403).json({ error: 'No token provided' });
      }

      try {
        // Look up session in database
        const session = await db.Session.findOne({
          where: {
            session_token: token,
            is_active: true,
            expires_at: {
              [db.Sequelize.Op.gt]: new Date()
            }
          }
        });

        if (!session) {
          return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Update last_used_at
        await session.update({ last_used_at: new Date() });

        // Attach username to request for downstream use
        req.authType = 'session';
        req.username = session.username;
        req.sessionId = session.id;

        next();
      } catch (error) {
        req.log.error({ err: error }, 'Token verification failed');
        return res.status(500).json({ error: 'Authentication error' });
      }
    };

    // Rate limiter for login attempts
    const loginLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 requests per windowMs
      message: { error: 'Too many failed login attempts. Please wait 15 minutes before trying again.' },
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false, // Disable the `X-RateLimit-*` headers
      skipSuccessfulRequests: true, // Don't count successful requests
      validate: {
        trustProxy: false, // Suppress trust proxy warning - we run in Docker with proxy
        ip: false, // Disable IP validation - we're using a custom key
      },
      keyGenerator: (req) => {
        // Use IP + username combination for more granular rate limiting
        // ipKeyGenerator normalizes IPv6 addresses to prevent bypass
        const normalizedIp = ipKeyGenerator(req.ip);
        const username = req.body.username || 'unknown';
        return `${normalizedIp}:${username}`;
      },
      handler: (req, res) => {
        res.status(429).json({
          error: 'Too many failed login attempts. Please wait 15 minutes before trying again.'
        });
      }
    });

    // General API rate limiter (more permissive)
    const apiLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per minute
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false }, // Suppress trust proxy warning - we run in Docker with proxy
    });

    /**** ONLY ROUTES BELOW THIS LINE *********/

    // Setup Swagger documentation at /swagger
    setupSwagger(app);

    // Apply database health check middleware to all routes
    app.use(checkDatabaseHealth);

    // Serve images
    app.use('/images', express.static(configModule.getImagePath()));

    // Serve any static files built by React
    app.use(express.static(path.join(__dirname, '../client/build')));

    // Apply general API rate limiting to all protected routes
    app.use('/api', apiLimiter);

    // Register all modular routes
    registerRoutes(app, {
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
    });

    // Handle any requests that don't match the ones above
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });

    if (process.env.NODE_ENV !== 'test') {
      const port = process.env.PORT || 3011;
      const server = http.createServer(app);
      // pass the server to WebSocket server initialization function to allow it to use the same port
      require('./modules/webSocketServer.js')(server);

      server.listen(port, () => {
        logger.info({ port }, 'Server started and listening');

        // Only initialize cron jobs and background tasks if database is healthy
        if (databaseHealth.isDatabaseHealthy()) {
          // Initialize cron jobs
          const cronJobs = require('./modules/cronJobs');
          cronJobs.initialize();

          // Run folder_name migration for existing channels asynchronously
          // This populates folder_name from Video.filePath for channels that don't have it set
          setTimeout(() => {
            const channelFolderNameMigration = require('./modules/channelFolderNameMigration');
            channelFolderNameMigration.migrateExistingChannels()
              .catch(err => {
                logger.error({ err }, 'Channel folder_name migration failed');
              });
          }, 2000); // Delay 2 seconds to let other startup tasks complete

          // Run video metadata backfill asynchronously after server starts
          setTimeout(() => {
            logger.info('Starting async video metadata backfill');
            videosModule.backfillVideoMetadata()
              .then(() => {
                logger.info('Video metadata backfill completed successfully');
              })
              .catch(err => {
                logger.error({ err }, 'Video metadata backfill failed');
              });
          }, 5000); // Delay 5 seconds to avoid blocking startup
        } else {
          logger.warn('Skipping cron jobs and background tasks - database is not healthy');
        }
      });
    }

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize the application');

    // Check if this is a database error (which should be handled gracefully)
    // or some other critical error (which should still exit)
    const dbHealth = databaseHealth.getStartupHealth();
    if (dbHealth.database.connected === false || dbHealth.database.schemaValid === false) {
      // Database issue - server will continue in degraded mode
      logger.warn('Server starting in degraded mode due to database issues');
    } else {
      // Critical non-database error - exit the process
      logger.fatal({ err: error }, 'Critical error during initialization - exiting');
      process.exit(1);
    }
  }
};

if (process.env.NODE_ENV !== 'test') {
  initialize();

  // Graceful shutdown handlers
  const gracefulShutdown = (signal) => {
    logger.info({ signal }, 'Received shutdown signal, cleaning up...');

    // Stop health monitor
    databaseHealth.stopHealthMonitor();

    // Exit process
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = {
  app,
  initialize,
  isLocalhostIP
};
