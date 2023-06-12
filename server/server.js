const express = require('express');
const app = express();
app.use(express.json());
const path = require('path');
const db = require('./db');
const https = require('https');
const http = require('http');

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

    // eslint-disable-next-line no-inner-declarations
    function verifyToken(req, res, next) {
      // Check for the token in the headers
      const token = req.headers['x-access-token'];

      // If no token is provided, return an error
      if (!token) {
        return res.status(403).json({ error: 'No token provided.' });
      }

      // If a token is provided, but it doesn't match the stored token, return an error
      if (token !== configModule.getConfig().plexApiKey) {
        return res.status(401).json({ error: 'Invalid token.' });
      }

      // If the token is valid, proceed to the next middleware function or the route handler
      next();
    }

    /**** ONLY ROUTES BELOW THIS LINE *********/

    // Serve image files
    app.use('/images', express.static(path.join(__dirname, 'images')));

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

    app.get('/getplexlibraries', verifyToken, async (req, res) => {
      try {
        const libraries = await plexModule.getLibraries();
        res.json(libraries);
      } catch (error) {
        console.log('Error: ' + error.message);
        res.status(500).json({ error: 'Failed to get libraries from Plex' });
      }
    });

    app.get('/getconfig', verifyToken, (req, res) => {
      // Just send the current config object as a JSON response.
      res.json(configModule.getConfig());
    });

    app.post('/updateconfig', verifyToken, (req, res) => {
      console.log('Updating config');
      // Update the config object with the new data
      configModule.updateConfig(req.body);

      res.json({ status: 'success' });
    });

    app.get('/getchannels', verifyToken, (req, res) => {
      channelModule.readChannels().then((channels) => {
        res.json(channels);
      });
    });

    app.post('/updatechannels', verifyToken, (req, res) => {
      const channels = req.body;
      channelModule.writeChannels(channels);
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

    // Not sure if this is needed, but lets expose it for now for testing
    app.get('/refreshlibrary', verifyToken, () => {
      plexModule.refreshLibrary();
    });

    app.get('/getchannelinfo/:channelId', verifyToken, async (req, res) => {
      const channelId = req.params.channelId;
      const channelInfo = await channelModule.getChannelInfo(channelId, true);
      res.json(channelInfo);
    });

    app.get('/getchannelvideos/:channelId', verifyToken, async (req, res) => {
      console.log('Getting channel videos');
      const channelId = req.params.channelId;
      const channelVideos = await channelModule.getChannelVideos(channelId);
      res.status(200).json(channelVideos);
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

    // Takes a list of specific youtube urls and downloads them
    app.post('/triggerspecificdownloads', verifyToken, (req, res) => {
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
      downloadModule.doChannelDownloads();
      res.json({ status: 'success' });
    });

    // Plex AUTH routes (the only unprotected routes)
    app.get('/plex/auth-url', async (req, res) => {
      try {
        const result = await plexModule.getAuthUrl();
        res.json(result);
      } catch (error) {
        console.log('PIN ERROR!!' + error.message);
        res.status(500).json({ error: error.message });
      }
    });
    app.get('/plex/check-pin/:pinId', async (req, res) => {
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
  } catch (error) {
    console.error('Failed to initialize the application:', error);
    // Handle the error here, e.g. exit the process
    process.exit(1);
  }
};

initialize();
