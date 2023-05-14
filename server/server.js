const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const cron = require('node-cron');

let directoryPath;
if (process.env.IN_DOCKER_CONTAINER) {
  directoryPath = "/usr/src/app/data";
} else {
  const configFile = fs.readFileSync(
    path.join(__dirname, "../config/yt_dir.conf"),
    "utf8"
  );
  // Extract the selected_directory value
  const selectedDirectoryMatch = configFile.match(/selected_directory=(.+)/);
  if (selectedDirectoryMatch) {
    directoryPath = selectedDirectoryMatch[1];
  }
}

// Load the config file
let config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json')));


// Schedule the initial task
let task = cron.schedule(config.channelDownloadFrequency, () => {
  console.log('Running a task at interval: ' + config.channelDownloadFrequency);
});

// Watch the config file for changes
fs.watch(path.join(__dirname, '../config/config.json'), (event, filename) => {
  if (event === 'change') {
    // Stop the old task
    task.stop();

    // Load the new config file
    config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/config.json')));

    // Schedule the new task
    task = cron.schedule(config.channelDownloadFrequency, () => {
      console.log('Running a task at interval: ' + config.channelDownloadFrequency);
    });
  }
});


console.log(`Selected directory: ${directoryPath}`);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "build")));

// Function to load the config.json file
const loadConfig = require("../config/config.json");

// Put all API endpoints under '/api'
app.get("/api", (req, res) => {
  // Handle API requests here
  res.json({ message: "Hello from the API!" });
});

// Run yt-dlp and just echo the output for debug
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
