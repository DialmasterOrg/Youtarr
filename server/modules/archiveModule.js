const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// Centralized helpers for reading the yt-dlp download archive (complete.list)

function getArchivePath() {
  return path.join(__dirname, '../../config', 'complete.list');
}

// Read complete.list and return non-empty lines which will look like: youtube <youtube_id>
// Handles missing file by returning an empty array.
function readCompleteListLines() {
  const archivePath = getArchivePath();
  try {
    const content = fs.readFileSync(archivePath, 'utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines;
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

async function isVideoInArchive(videoId) {
  const lines = readCompleteListLines();
  return lines.some(line => {
    const parts = line.split(/\s+/).filter(Boolean);
    return parts.length >= 2 && parts[0] === 'youtube' && parts[1] === videoId;
  });
}

// Return the subset of youtubeIds listed in the archive, reading the file once.
// A read failure returns an empty set: callers only use this to annotate
// listings, which must still load when the archive cannot be read.
function filterArchivedVideoIds(youtubeIds) {
  const wanted = new Set((youtubeIds || []).filter(Boolean));
  const archived = new Set();
  if (wanted.size === 0) return archived;

  let lines;
  try {
    lines = readCompleteListLines();
  } catch (err) {
    logger.warn({ err }, 'Failed to read archive, treating videos as not archived');
    return archived;
  }

  for (const line of lines) {
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'youtube' && wanted.has(parts[1])) {
      archived.add(parts[1]);
    }
  }
  return archived;
}

// Add a video to the archive if it doesn't already exist
async function addVideoToArchive(videoId) {
  if (!videoId) {
    logger.debug('addVideoToArchive called with empty videoId, skipping');
    return false;
  }

  // Check if video already exists in archive
  const alreadyInArchive = await isVideoInArchive(videoId);
  if (alreadyInArchive) {
    logger.debug({ videoId }, 'Video already in archive, skipping');
    return false;
  }

  // Add the video to the archive
  const archivePath = getArchivePath();
  const archiveLine = `youtube ${videoId}\n`;

  try {
    // Append to the file (create if doesn't exist)
    fs.appendFileSync(archivePath, archiveLine);
    logger.debug({ videoId }, 'Added video to archive');
    return true;
  } catch (err) {
    logger.error({ videoId, err: err.message }, 'Failed to add video to archive');
    return false;
  }
}

// Remove a video from the archive (used when unignoring videos)
async function removeVideoFromArchive(videoId) {
  if (!videoId) {
    logger.debug('removeVideoFromArchive called with empty videoId, skipping');
    return false;
  }

  // Check if video exists in archive
  const alreadyInArchive = await isVideoInArchive(videoId);
  if (!alreadyInArchive) {
    logger.debug({ videoId }, 'Video not in archive, nothing to remove');
    return false;
  }

  const archivePath = getArchivePath();

  try {
    // Read all lines
    const lines = readCompleteListLines();

    // Filter out the line matching this videoId
    const filteredLines = lines.filter(line => {
      const parts = line.split(/\s+/).filter(Boolean);
      return !(parts.length >= 2 && parts[0] === 'youtube' && parts[1] === videoId);
    });

    // Write back to file
    const content = filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : '');
    fs.writeFileSync(archivePath, content, 'utf-8');

    logger.debug({ videoId }, 'Removed video from archive');
    return true;
  } catch (err) {
    logger.error({ videoId, err: err.message }, 'Failed to remove video from archive');
    return false;
  }
}

module.exports = {
  getArchivePath,
  readCompleteListLines,
  getNewVideoUrlsSince,
  isVideoInArchive,
  filterArchivedVideoIds,
  addVideoToArchive,
  removeVideoFromArchive,
};
