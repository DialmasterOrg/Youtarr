const fs = require('fs');
const path = require('path');

// Centralized helpers for reading the yt-dlp download archive (complete.list)

function getArchivePath() {
  return path.join(__dirname, '../../config', 'complete.list');
}

// Read complete.list and return non-empty lines which will look like: youtube <youtube_id>
// Handles missing file by returning an empty array.
function readCompleteListLines() {
  try {
    const content = fs.readFileSync(getArchivePath(), 'utf-8');
    return content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

// Convenience: return youtube URLs for entries added after initialCount
function getNewVideoUrlsSince(initialCount) {
  const lines = readCompleteListLines();
  const newVideoIds = lines.slice(initialCount).map((line) => {
    // Split by whitespace and filter out empty strings to handle multiple spaces
    const parts = line.split(/\s+/).filter(Boolean);
    return parts[1]; // Return the video ID (second part)
  });
  return newVideoIds.map((id) => `https://youtu.be/${id}`);
}

module.exports = {
  getArchivePath,
  readCompleteListLines,
  getNewVideoUrlsSince,
};
