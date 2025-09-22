const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();
app.set('trust proxy', true); // Trust proxy headers for correct IP detection
app.use(express.json());
const path = require('path');
const db = require('./db');
const https = require('https');
const http = require('http');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const schedule = require('node-cron');
const multer = require('multer');
const userNameMaxLength = 32;
const passwordMaxLength = 64;

// Configure multer for cookie file upload
const cookieUpload = multer({
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    // Accept only text files
    if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only text files are allowed'), false);
    }
  }
});

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

const initialize = async () => {
  try {
    // Wait for the database to initialize
    await db.initializeDatabase();

    const configModule = require('./modules/configModule');
    const channelModule = require('./modules/channelModule');
    const plexModule = require('./modules/plexModule');
    const downloadModule = require('./modules/downloadModule');
    const jobModule = require('./modules/jobModule');
    const videosModule = require('./modules/videosModule');

    channelModule.subscribe();

    console.log(
      `Youtube downloads directory from config: ${configModule.directoryPath}`
    );

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

      // Check for token in headers
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
        req.username = session.username;
        req.sessionId = session.id;

        next();
      } catch (error) {
        console.error('Token verification error:', error);
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
      keyGenerator: (req) => {
        // Use IP + username combination for more granular rate limiting
        const username = req.body.username || 'unknown';
        return `${req.ip}:${username}`;
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
    });

    /**** ONLY ROUTES BELOW THIS LINE *********/

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    app.use('/images', express.static(configModule.getImagePath()));

    // Serve any static files built by React
    app.use(express.static(path.join(__dirname, '../client/build')));

    app.get('/getCurrentReleaseVersion', async (req, res) => {
      try {
        https
          .get(
            'https://registry.hub.docker.com/v2/repositories/dialmaster/youtarr/tags',
            (resp) => {
              let data = '';

              resp.on('data', (chunk) => {
                data += chunk;
              });

              resp.on('end', () => {
                const dockerData = JSON.parse(data);
                const latestVersion = dockerData.results.filter(
                  (tag) => tag.name !== 'latest'
                )[0].name; // Filter out 'latest' tag and get the first non-'latest' tag
                res.json({ version: latestVersion });
              });
            }
          )
          .on('error', (err) => {
            console.log('Error: ' + err.message);
            res.status(500).json({ error: err.message });
          });
      } catch (error) {
        console.log('Error: ' + error.message);
        res
          .status(500)
          .json({ error: 'Failed to fetch version from Docker Hub' });
      }
    });

    // Apply general API rate limiting to all protected routes
    app.use('/api', apiLimiter);

    app.get('/getplexlibraries', verifyToken, async (req, res) => {
      try {
        // Check if test parameters are provided in query string
        const testIP = req.query.testIP;
        const testApiKey = req.query.testApiKey;

        let libraries;
        if (testIP && testApiKey) {
          // Use provided test values instead of saved config
          libraries = await plexModule.getLibrariesWithParams(testIP, testApiKey);

          // If test was successful (got libraries), auto-save the credentials
          if (libraries && libraries.length > 0) {
            const currentConfig = configModule.getConfig();
            currentConfig.plexIP = testIP;
            currentConfig.plexApiKey = testApiKey;
            configModule.updateConfig(currentConfig);
            console.log('Plex credentials auto-saved after successful test');
          }
        } else {
          // Use saved config values
          libraries = await plexModule.getLibraries();
        }

        // Always return an array, even if empty
        res.json(libraries || []);
      } catch (error) {
        console.log('Error: ' + error.message);
        // Return empty array instead of error to prevent frontend issues
        res.json([]);
      }
    });

    app.get('/getconfig', verifyToken, (req, res) => {
      // Get config but filter out sensitive data
      const config = configModule.getConfig();
      const safeConfig = { ...config };

      // Remove sensitive fields that should never be sent to client
      delete safeConfig.passwordHash;
      delete safeConfig.username;

      safeConfig.isPlatformManaged = {
        youtubeOutputDirectory: !!process.env.DATA_PATH,
        plexUrl: !!process.env.PLEX_URL,
        authEnabled: process.env.AUTH_ENABLED === 'false' ? false : true
      };

      // Add deployment environment information
      safeConfig.deploymentEnvironment = {
        inDocker: !!process.env.IN_DOCKER_CONTAINER,
        dockerAutoCreated: !!safeConfig.dockerAutoCreated
      };

      res.json(safeConfig);
    });

    app.post('/updateconfig', verifyToken, (req, res) => {
      console.log('Updating config');
      const currentConfig = configModule.getConfig();
      const updateData = { ...req.body };

      // Prevent direct updates to sensitive fields
      // These should only be updated through dedicated endpoints
      delete updateData.passwordHash;
      delete updateData.username;

      // Preserve existing sensitive fields from current config
      updateData.passwordHash = currentConfig.passwordHash;
      updateData.username = currentConfig.username;

      // Update the config object with the sanitized data
      configModule.updateConfig(updateData);

      res.json({ status: 'success' });
    });

    // Cookie API endpoints
    app.get('/api/cookies/status', verifyToken, (req, res) => {
      try {
        const status = configModule.getCookiesStatus();
        res.json(status);
      } catch (error) {
        console.error('Error getting cookie status:', error);
        res.status(500).json({ error: 'Failed to get cookie status' });
      }
    });

    app.post('/api/cookies/upload', verifyToken, cookieUpload.single('cookieFile'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileContent = req.file.buffer.toString('utf8');

        // Basic validation for Netscape cookie format
        if (!fileContent.includes('# Netscape HTTP Cookie File') &&
            !fileContent.includes('# This file is generated by yt-dlp')) {
          return res.status(400).json({
            error: 'Invalid cookie file format. Please upload a valid Netscape format cookie file.'
          });
        }

        // Save the file using config module helper
        configModule.writeCustomCookiesFile(Buffer.from(fileContent));

        const status = configModule.getCookiesStatus();
        res.json({
          status: 'success',
          message: 'Cookie file uploaded successfully',
          cookieStatus: status
        });
      } catch (error) {
        console.error('Error uploading cookie file:', error);
        res.status(500).json({ error: 'Failed to upload cookie file' });
      }
    });

    app.delete('/api/cookies', verifyToken, (req, res) => {
      try {
        configModule.deleteCustomCookiesFile();
        const status = configModule.getCookiesStatus();
        res.json({
          status: 'success',
          message: 'Custom cookie file deleted',
          cookieStatus: status
        });
      } catch (error) {
        console.error('Error deleting cookie file:', error);
        res.status(500).json({ error: 'Failed to delete cookie file' });
      }
    });

    app.get('/getchannels', verifyToken, (req, res) => {
      channelModule.readChannels().then((channels) => {
        res.json(channels);
      });
    });

    app.post('/updatechannels', verifyToken, async (req, res) => {
      const channels = req.body;
      await channelModule.writeChannels(channels);
      res.json({ status: 'success' });
    });

    app.post('/addchannelinfo', verifyToken, async (req, res) => {
      const url = req.body.url;
      if (url) {
        console.log(`Adding channel info for ${url}`);
        let channelInfo = await channelModule.getChannelInfo(url, false);
        channelInfo.channel_id = channelInfo.id;
        res.json({ status: 'success', channelInfo: channelInfo });
      } else {
        res.status(400).send('URL is missing in the request');
      }
    });

    app.get('/validateToken', verifyToken, (req, res) => {
      res.json({ valid: true, username: req.username });
    });

    // Not sure if this is needed, but lets expose it for now for testing
    app.get('/refreshlibrary', verifyToken, async (req, res) => {
      try {
        await plexModule.refreshLibrary();
        res.json({ success: true, message: 'Library refresh initiated' });
      } catch (error) {
        console.log('Failed to refresh Plex library:', error.message);
        res.status(500).json({ success: false, message: 'Failed to refresh library' });
      }
    });

    app.get('/getchannelinfo/:channelId', verifyToken, async (req, res) => {
      const channelId = req.params.channelId;
      const channelInfo = await channelModule.getChannelInfo(channelId, true);
      res.json(channelInfo);
    });

    app.get('/getchannelvideos/:channelId', verifyToken, async (req, res) => {
      console.log('Getting channel videos');
      const channelId = req.params.channelId;
      const result = await channelModule.getChannelVideos(channelId);

      // For backward compatibility, if result is an array, convert to old format
      if (Array.isArray(result)) {
        res.status(200).json({
          videos: result,
          videoFail: result.length === 0,
        });
      } else {
        // New format with additional metadata
        res.status(200).json(result);
      }
    });

    app.get('/jobstatus/:jobId', verifyToken, (req, res) => {
      const jobId = req.params.jobId;
      const job = jobModule.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
      } else {
        res.json(job);
      }
    });

    app.get('/runningjobs', verifyToken, (req, res) => {
      const runningJobs = jobModule.getRunningJobs();
      res.json(runningJobs);
    });

    app.get('/getVideos', verifyToken, (req, res) => {
      console.log('Getting videos');

      //return res.json({ status: 'success' });
      videosModule
        .getVideos()
        .then((videos) => {
          res.json(videos);
        })
        .catch((error) => {
          res.status(500).json({ error: error.message });
        });
    });

    app.get('/storage-status', verifyToken, async (req, res) => {
      try {
        const status = await configModule.getStorageStatus();
        if (status) {
          res.json(status);
        } else {
          res.status(500).json({ error: 'Could not retrieve storage status' });
        }
      } catch (error) {
        console.error('Error in /storage-status endpoint:', error);
        res.status(500).json({ error: error.message });
      }
    });

    const videoValidationLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute
      message: 'Too many validation requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Validate YouTube video URL and fetch metadata
    app.post('/api/checkYoutubeVideoURL', verifyToken, videoValidationLimiter, async (req, res) => {
      try {
        const { url } = req.body;

        if (!url) {
          return res.status(400).json({
            isValidUrl: false,
            error: 'URL is required'
          });
        }

        const videoValidationModule = require('./modules/videoValidationModule');
        const validationResult = await videoValidationModule.validateVideo(url);

        res.json(validationResult);
      } catch (error) {
        console.error('Error validating video URL:', error);
        res.status(500).json({
          isValidUrl: false,
          error: 'Internal server error'
        });
      }
    });

    // Takes a list of specific youtube urls and downloads them
    app.post('/triggerspecificdownloads', verifyToken, (req, res) => {
      // Validate override settings if provided
      const { overrideSettings } = req.body;
      if (overrideSettings) {
        // Validate resolution
        if (overrideSettings.resolution) {
          const validResolutions = ['360', '480', '720', '1080', '1440', '2160'];
          if (!validResolutions.includes(overrideSettings.resolution)) {
            return res.status(400).json({
              error: 'Invalid resolution. Valid values: 360, 480, 720, 1080, 1440, 2160'
            });
          }
        }
        // Note: video count is not applicable for manual downloads
      }

      downloadModule.doSpecificDownloads(req);
      res.json({ status: 'success' });
    });

    // Manually trigger the channel downloads
    app.post('/triggerchanneldownloads', verifyToken, (req, res) => {
      // Check if there is a running channel downloads job
      // That means if there is a job with type "Channel Downloads" and a status of "In Progress"
      // If so return status "Job Already Running"
      const runningJobs = jobModule.getRunningJobs();
      const channelDownloadJob = runningJobs.find(
        (job) =>
          job.jobType === 'Channel Downloads' && job.status === 'In Progress'
      );
      if (channelDownloadJob) {
        res.status(400).json({ error: 'Job Already Running' });
        return;
      }

      // Validate override settings if provided
      const { overrideSettings } = req.body;
      if (overrideSettings) {
        // Validate resolution
        if (overrideSettings.resolution) {
          const validResolutions = ['360', '480', '720', '1080', '1440', '2160'];
          if (!validResolutions.includes(overrideSettings.resolution)) {
            return res.status(400).json({
              error: 'Invalid resolution. Valid values: 360, 480, 720, 1080, 1440, 2160'
            });
          }
        }
        // Validate video count
        if (overrideSettings.videoCount !== undefined) {
          const count = parseInt(overrideSettings.videoCount);
          if (isNaN(count) || count < 1 || count > 50) {
            return res.status(400).json({
              error: 'Invalid video count. Must be between 1 and 50'
            });
          }
        }
      }

      downloadModule.doChannelDownloads(req.body || {});
      res.json({ status: 'success' });
    });

    // Authentication routes (unprotected)
    app.post('/auth/login', loginLimiter, async (req, res) => {
      if (process.env.AUTH_ENABLED === 'false') {
        return res.json({
          token: 'platform-managed-auth',
          message: 'Authentication is managed by the platform'
        });
      }

      const { username, password } = req.body;

      // Input validation
      if (!username || typeof username !== 'string' || username.length > userNameMaxLength) {
        return res.status(400).json({ error: 'Invalid username' });
      }

      if (!password || typeof password !== 'string' || password.length > passwordMaxLength) {
        return res.status(400).json({ error: 'Invalid password' });
      }

      const config = configModule.getConfig();

      // Check if auth is configured
      if (!config.username || !config.passwordHash) {
        return res.status(503).json({
          error: 'Authentication not configured',
          requiresSetup: true
        });
      }

      // Validate credentials
      if (username !== config.username) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, config.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Create new session
      const sessionToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const clientIP = req.ip || req.connection.remoteAddress;

      await db.Session.create({
        session_token: sessionToken,
        username: username,
        user_agent: req.headers['user-agent'],
        ip_address: clientIP,
        expires_at: expiresAt
      });

      res.json({
        token: sessionToken,
        expires: expiresAt.toISOString(),
        username: username
      });
    });

    app.post('/auth/logout', verifyToken, async (req, res) => {
      const token = req.headers['x-access-token'];

      await db.Session.update(
        { is_active: false },
        { where: { session_token: token } }
      );

      res.json({ success: true });
    });

    app.get('/auth/sessions', verifyToken, async (req, res) => {
      const sessions = await db.Session.findAll({
        where: {
          username: req.username,
          is_active: true,
          expires_at: {
            [db.Sequelize.Op.gt]: new Date()
          }
        },
        attributes: ['id', 'user_agent', 'ip_address', 'createdAt', 'last_used_at'],
        order: [['last_used_at', 'DESC']]
      });

      res.json(sessions);
    });

    app.delete('/auth/sessions/:id', verifyToken, async (req, res) => {
      const result = await db.Session.update(
        { is_active: false },
        {
          where: {
            id: req.params.id,
            username: req.username
          }
        }
      );

      if (result[0] === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ success: true });
    });

    app.post('/auth/change-password', verifyToken, async (req, res) => {
      const { currentPassword, newPassword } = req.body;

      // Input validation
      if (!currentPassword || typeof currentPassword !== 'string' || currentPassword.length > passwordMaxLength) {
        return res.status(400).json({ error: 'Invalid current password' });
      }

      if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'Invalid new password' });
      }

      // Password strength requirements
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long' });
      }

      if (newPassword.length > passwordMaxLength) {
        return res.status(400).json({ error: 'New password is too long' });
      }

      const config = configModule.getConfig();

      // Validate current password
      const validPassword = await bcrypt.compare(currentPassword, config.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update config
      config.passwordHash = newPasswordHash;
      configModule.updateConfig(config);

      res.json({ success: true, message: 'Password updated successfully' });
    });

    app.get('/auth/validate', verifyToken, (req, res) => {
      res.json({ valid: true, username: req.username });
    });

    // Setup routes
    app.get('/setup/status', (req, res) => {
      if (process.env.AUTH_ENABLED === 'false') {
        return res.json({
          requiresSetup: false,
          isLocalhost: true,
          platformManaged: true,
          message: 'Authentication is managed by the platform'
        });
      }

      const config = configModule.getConfig();
      // Try multiple methods to get the client IP
      const clientIP = req.ip ||
                      req.connection.remoteAddress ||
                      req.socket.remoteAddress ||
                      req.connection.socket?.remoteAddress ||
                      req.headers['x-forwarded-for']?.split(',')[0];

      // Also check if the host header indicates localhost
      const hostIsLocal = req.headers.host && (
        req.headers.host.startsWith('localhost') ||
        req.headers.host.startsWith('127.0.0.1') ||
        req.headers.host.startsWith('[::1]')
      );

      const isLocalhost = isLocalhostIP(clientIP) || hostIsLocal;

      res.json({
        requiresSetup: !config.username || !config.passwordHash,
        isLocalhost: isLocalhost,
        message: isLocalhost ? null : 'Setup must be performed from localhost'
      });
    });

    app.post('/setup/create-auth', async (req, res) => {
      const config = configModule.getConfig();

      // Security check - ONLY allow from localhost
      const clientIP = req.ip ||
                      req.connection.remoteAddress ||
                      req.socket.remoteAddress ||
                      req.connection.socket?.remoteAddress ||
                      req.headers['x-forwarded-for']?.split(',')[0];

      // Also check if the host header indicates localhost
      const hostIsLocal = req.headers.host && (
        req.headers.host.startsWith('localhost') ||
        req.headers.host.startsWith('127.0.0.1') ||
        req.headers.host.startsWith('[::1]')
      );

      const isLocalhost = isLocalhostIP(clientIP) || hostIsLocal;

      if (!isLocalhost) {
        console.log(`[SECURITY] Setup attempt blocked from IP: ${clientIP}`);
        return res.status(403).json({
          error: 'Initial setup can only be performed from localhost for security reasons.',
          instruction: 'Please access Youtarr directly from the server at http://localhost:3087',
          yourIP: clientIP
        });
      }

      // Check if already configured
      if (config.username && config.passwordHash) {
        return res.status(400).json({ error: 'Authentication already configured' });
      }

      const { username, password } = req.body;

      // Input validation
      if (!username || typeof username !== 'string' || username.trim().length === 0) {
        return res.status(400).json({ error: 'Username is required' });
      }

      if (username.length > 32) {
        return res.status(400).json({ error: 'Username is too long (max 32 characters)' });
      }

      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password is required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      if (password.length > 64) {
        return res.status(400).json({ error: 'Password is too long' });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Update config with trimmed username
      config.username = username.trim();
      config.passwordHash = passwordHash;
      configModule.updateConfig(config);

      // Create first session
      const sessionToken = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.Session.create({
        session_token: sessionToken,
        username: username.trim(),
        user_agent: req.headers['user-agent'],
        ip_address: clientIP,
        expires_at: expiresAt
      });

      console.log(`[AUTH] Initial setup completed for user: ${username.trim()}`);

      res.json({
        token: sessionToken,
        message: 'Setup complete! You can now access Youtarr from anywhere.',
        username: username
      });
    });

    // Plex AUTH routes - require local auth to be configured first
    app.get('/plex/auth-url', async (req, res) => {
      const config = configModule.getConfig();

      // If auth not configured, reject
      if (!config.passwordHash) {
        return res.status(503).json({
          error: 'Authentication not configured',
          requiresSetup: true,
          message: 'Please complete initial setup first'
        });
      }

      try {
        const result = await plexModule.getAuthUrl();
        res.json(result);
      } catch (error) {
        console.log('PIN ERROR!!' + error.message);
        res.status(500).json({ error: error.message });
      }
    });
    app.get('/plex/check-pin/:pinId', async (req, res) => {
      const config = configModule.getConfig();

      // If auth not configured, reject
      if (!config.passwordHash) {
        return res.status(503).json({
          error: 'Authentication not configured',
          requiresSetup: true,
          message: 'Please complete initial setup first'
        });
      }

      try {
        const { pinId } = req.params;
        const result = await plexModule.checkPin(pinId);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Handle any requests that don't match the ones above
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });

    const port = process.env.PORT || 3011;
    const server = http.createServer(app);
    // pass the server to WebSocket server initialization function to allow it to use the same port
    require('./modules/webSocketServer.js')(server);

    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

    // Clean up expired sessions daily at 3 AM
    schedule.schedule('0 3 * * *', async () => {
      try {
        const result = await db.Session.destroy({
          where: {
            [db.Sequelize.Op.or]: [
              {
                expires_at: {
                  [db.Sequelize.Op.lt]: new Date()
                }
              },
              {
                is_active: false,
                updatedAt: {
                  [db.Sequelize.Op.lt]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days old
                }
              }
            ]
          }
        });
        console.log(`[CLEANUP] Removed ${result} expired sessions`);
      } catch (error) {
        console.error('[CLEANUP] Error cleaning sessions:', error);
      }
    });
  } catch (error) {
    console.error('Failed to initialize the application:', error);
    // Handle the error here, e.g. exit the process
    process.exit(1);
  }
};

initialize();
