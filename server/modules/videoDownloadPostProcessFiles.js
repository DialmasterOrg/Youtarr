const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const configModule = require('./configModule');

const videoPath = process.argv[2]; // get the video file path
const parsedPath = path.parse(videoPath);
// Note that the mp4 video itself contains embedded metadata for Plex
// We only need the .info.json for Youtarr to use
const jsonPath = path.format({
  dir: parsedPath.dir,
  name: parsedPath.name,
  ext: '.info.json'
});

const videoDirectory = path.dirname(videoPath);
const imagePath = path.join(videoDirectory, 'poster.jpg'); // assume the image thumbnail is named 'poster.jpg'

if (fs.existsSync(jsonPath)) {
  const filename = path.basename(jsonPath, '.info.json'); // get the filename
  const matches = filename.match(/\[(.*?)\]/g); // Extract all occurrences of video IDs enclosed in brackets
  const id = matches
    ? matches[matches.length - 1].replace(/[[\]]/g, '')
    : 'default'; // take the last match and remove brackets or use 'default'
  const directoryPath = path.resolve(__dirname, '../../jobs/info');
  const newImagePath = path.resolve(__dirname, '../images');

  fs.ensureDirSync(directoryPath); // ensures that the directory exists, if it doesn't it will create it
  const newJsonPath = path.join(directoryPath, `${id}.info.json`); // define the new path

  fs.moveSync(jsonPath, newJsonPath, { overwrite: true }); // move the file

  if (fs.existsSync(imagePath)) {
    // check if image thumbnail exists
    const newImageFullPath = path.join(newImagePath, `videothumb-${id}.jpg`); // define the new path for image thumbnail
    const newImageFullPathSmall = path.join(
      newImagePath,
      `videothumb-${id}-small.jpg`
    ); // define the new path for image thumbnail
    fs.copySync(imagePath, newImageFullPath, { overwrite: true }); // copy the image thumbnail

    // Resize the image using ffmpeg with proper settings to avoid deprecated format warnings
    // Using -loglevel error to suppress the deprecated pixel format warnings but still show actual errors
    try {
      execSync(
        `${configModule.ffmpegPath} -loglevel error -y -i "${newImageFullPath}" -vf "scale=iw*0.5:ih*0.5" -q:v 2 "${newImageFullPathSmall}"`,
        { stdio: 'inherit' }
      );
      fs.rename(newImageFullPathSmall, newImageFullPath);
      console.log('Image resized successfully');
    } catch (err) {
      console.log(`Error resizing image: ${err}`);
    }
  }
}

configModule.stopWatchingConfig();
