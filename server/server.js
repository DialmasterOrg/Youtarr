const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const configModule = require('./modules/configModule');
const channelModule = require('./modules/channelModule');
const plexModule = require('./modules/plexModule');
const downloadModule = require('./modules/downloadModule');
const jobModule = require('./modules/jobModule');

channelModule.subscribe();

console.log(`Youtube downloads directory from config: ${configModule.directoryPath}`);

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

app.get('/getplexlibraries', verifyToken, async (req, res) => {
  try {
    const libraries = await plexModule.getLibraries();
    res.json(libraries);
  } catch (error) {
    console.log('Error: ' + error.message);
    res.status(500).json({ error: 'Failed to get libraries from Plex' });
  }
});

app.get("/getconfig", verifyToken, (req, res) => {
  // Just send the current config object as a JSON response.
  res.json(configModule.getConfig());
});

app.post("/updateconfig", verifyToken, (req, res) => {
  console.log('Updating config');
  // Update the config object with the new data
  configModule.updateConfig(req.body);

  res.json({ status: 'success' });
});

app.get("/getchannels", verifyToken, (req, res) => {
  const channels = channelModule.readChannels();
  res.json(channels);
});

app.post("/updatechannels", verifyToken, (req, res) => {
  const channels = req.body;
  channelModule.writeChannels(channels);
  res.json({ status: 'success' });
});

// Not sure if this is needed, but lets expose it for now for testing
app.get("/refreshlibrary", verifyToken, (req, res) => {
  plexModule.refreshLibrary();
})

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


// Takes a list of specific youtube urls and downloads them
app.post('/triggerspecificdownloads', verifyToken, (req, res) => {
  let jobId = downloadModule.doSpecificDownloads(req);
  res.json({ status: 'success', jobId: jobId });
});

// Manually trigger the channel downloads
app.post('/triggerchanneldownloads', verifyToken, (req, res) => {
  let jobId = downloadModule.doChannelDownloads();
  res.json({ status: 'success', jobId: jobId });
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


// Serve static files from the React app
app.use(express.static(path.join(__dirname, "build")));

// Serve any static files built by React
app.use(express.static(path.join(__dirname, "../client/build")));

// Handle any requests that don't match the ones above
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

const port = process.env.PORT || 3011;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
