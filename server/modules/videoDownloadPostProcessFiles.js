const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const configModule = require('./configModule');

const videoPath = process.argv[2]; // get the video file path
const jsonPath = videoPath.replace(/\.mp4$/, '.info.json'); // replace .mp4 with .info.json
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
    fs.copySync(imagePath, newImageFullPath, { overwrite: true }); // copy the image thumbnail

    // Resize the image using ffmpeg
    try {
      execSync(
        `${configModule.ffmpegPath} -y -i ${newImageFullPath} -vf "scale=iw*0.5:ih*0.5" ${newImageFullPath}`,
        { stdio: 'inherit' }
      );
      console.log('Image resized successfully');
    } catch (err) {
      console.log(`Error resizing image: ${err}`);
    }
  }
}

configModule.stopWatchingConfig();
