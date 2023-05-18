const fs = require('fs-extra');
const path = require('path');

const videoPath = process.argv[2]; // get the video file path
const jsonPath = videoPath.replace(/\.mp4$/, '.info.json'); // replace .mp4 with .info.json

if (fs.existsSync(jsonPath)) {
  const filename = path.basename(jsonPath, '.info.json'); // get the filename
  const matches = filename.match(/\[(.*?)\]/g); // Extract all occurrences of video IDs enclosed in brackets
  const id = matches ? matches[matches.length - 1].replace(/[\[\]]/g, '') : 'default'; // take the last match and remove brackets or use 'default'
  const directoryPath = path.resolve(__dirname, '../../jobs/info');
  fs.ensureDirSync(directoryPath); // ensures that the directory exists, if it doesn't it will create it
  const newJsonPath = path.join(directoryPath, `${id}.info.json`); // define the new path
  fs.moveSync(jsonPath, newJsonPath, { overwrite: true }); // move the file
}
