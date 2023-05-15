const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Load the config file
let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json')));

// Check if a UUID exists in the config
if (!config.uuid) {
  // Generate a new UUID
  config.uuid = uuidv4();

  // Save the new UUID to the config file
  fs.writeFileSync(path.join(__dirname, '../config/config.json'), JSON.stringify(config, null, 2));
}

let directoryPath;
if (process.env.IN_DOCKER_CONTAINER) {
  directoryPath = "/usr/src/app/data";
} else {
  directoryPath = config.youtubeOutputDirectory;
}

console.log(`Youtube downloads directory from config: ${directoryPath}`);

// Schedule the initial task
let task = cron.schedule(config.channelDownloadFrequency, () => {
  console.log('Running a task at interval: ' + config.channelDownloadFrequency);
});

function channelAutoDownload() {
  console.log('The current time is ' + new Date());
  console.log('Running new Channel Downloads at interval: ' + config.channelDownloadFrequency);
}

// Watch the config file for changes
fs.watch(path.join(__dirname, '../config/config.json'), (event, filename) => {
  if (event === 'change') {
    // Stop the old task
    task.stop();

    // Load the new config file
    config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json')));

    // Schedule the new task
    task = cron.schedule(config.channelDownloadFrequency, () => {
      channelAutoDownload();
    });
  }
});

app.get("/getconfig", (req, res) => {
  // Just send the current config object as a JSON response.
  res.json(config);
});

app.post("/updateconfig", (req, res) => {
  console.log('Updating config');
  // Update the config object with the new data
  config = req.body;

  // Write the new config data to the file
  fs.writeFileSync(path.join(__dirname, '../config/config.json'), JSON.stringify(config, null, 2));

  // Send a response to indicate success
  res.json({ status: 'success' });
});


function refreshLibrary() {
  console.log('Refreshing library in Plex');
  // Example GET http://[plexIP]:32400/library/sections/[plexYoutubeLibraryId]/refresh?X-Plex-Token=[plexApiKey]
  const response = axios.get(`http://${config.plexIP}:32400/library/sections/${config.plexYoutubeLibraryId}/refresh?X-Plex-Token=${config.plexApiKey}`);
  console.log(response);
}

// Not sure if this is needed, but lets expose it for now for testing
app.get("/refreshlibrary", (req, res) => {
  refreshLibrary();
})


app.get('/plex/auth-url', async (req, res) => {
  try {
    const response = await axios.post('https://plex.tv/api/v2/pins',
      { strong: true },
      {
        headers: {
          'X-Plex-Product': 'YoutubePlexArr',
          'X-Plex-Client-Identifier': config.uuid,
        }
      }
    );
    const { id, code } = response.data;
    const authUrl = `https://app.plex.tv/auth#?clientID=${config.uuid}&code=${code}&context%5Bdevice%5D%5Bproduct%5D=YoutubePlexArr`;
    res.json({ authUrl, pinId: id });
  } catch (error) {
    console.log('PIN ERROR!!' + error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/plex/check-pin/:pinId', async (req, res) => {
  try {
    const { pinId } = req.params;
    const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
      headers: {
        'X-Plex-Client-Identifier': config.uuid
      }
    });
    const { authToken } = response.data;
    if (authToken) {
      // Save the authToken to your config here, and send a response
      // indicating that the PIN has been claimed.
      config.plexApiKey = authToken;
      fs.writeFileSync(path.join(__dirname, '../config/config.json'), JSON.stringify(config, null, 2));
      res.json({ authToken });
    } else {
      // If the PIN hasn't been claimed yet, just send a response indicating so.
      res.json({ authToken: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run yt-dlp and just echo the output for debug
// ! Note that currently this only works inside the production/Dockerized container
// TODO: Make it so that this can work with a locally installed (host) yt-dlp and ffmpeg
app.get("/yt-dlp-test", (req, res) => {
  // Get the path to ffmpeg
  exec("which ffmpeg", (error, ffmpegPath, stderr) => {
    if (error) {
      console.log(`error: ${error.message}`);
      return res.send(`Error: ${error.message}`);
    }
    if (stderr) {
      console.log(`stderr: ${stderr}`);
      return res.send(`Error: ${stderr}`);
    }

    // Remove the newline character from the end of the path
    ffmpegPath = ffmpegPath.replace("\n", "");

    console.log(`ffmpegPath: ${ffmpegPath}`);
    // Get the version of ffmpeg
    exec(`${ffmpegPath} -version`, (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return res.send(`Error: ${error.message}`);
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return res.send(`Error: ${stderr}`);
      }
      console.log(`ffmpeg version: ${stdout}`);
    });

    // Get the version of yt-dlp
    exec("yt-dlp --version", (error, stdout, stderr) => {
      if (error) {
        console.log(`error: ${error.message}`);
        return res.send(`Error: ${error.message}`);
      }
      if (stderr) {
        console.log(`stderr: ${stderr}`);
        return res.send(`Error: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      res.send(`yt-dlp version: ${stdout}\nffmpeg path: ${ffmpegPath}`);
    });
  });
});

// Serve static files from the React app
//app.use(express.static(path.join(__dirname, "build")));

// Serve any static files built by React
//app.use(express.static(path.join(__dirname, "../client/build")));

// Handle any requests that don't match the ones above
//app.get("*", (req, res) => {
//  res.sendFile(path.join(__dirname, "../client/build/index.html"));
//});

const port = process.env.PORT || 3011;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
