const { execFile } = require('child_process');
const logger = require('../logger');

/**
 * Measures a video file's actual pixel dimensions via ffprobe (ships in the
 * image alongside ffmpeg). The raw "WIDTHxHEIGHT" string is what gets stored
 * on Videos.video_resolution; interpreting dimensions into a display tier
 * (e.g. "1080p") is deliberately display logic and lives client-side in
 * client/src/utils/videoResolution.ts, so labeling rules can change without
 * re-probing the library.
 *
 * Also home to format_note parsing, which videoMetadataModule uses for the
 * detail modal's available-resolutions list.
 */

const FFPROBE_TIMEOUT_MS = 15000;

// YouTube's transcode ladder; mirrors TIER_LADDER in
// client/src/utils/videoResolution.ts.
const TIER_LADDER = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];

/**
 * Selection class for a vertical format's pixel height: the smallest ladder
 * rung >= height, i.e. the minimum height-capped yt-dlp selector that would
 * download the format. Mirrors the vertical branch of tierFromDimensions in
 * client/src/utils/videoResolution.ts so the modal's available-resolutions
 * list lines up with the tier labels shown elsewhere in the app.
 */
function selectionTierForHeight(height) {
  if (!Number.isFinite(height) || height <= 0) return null;
  for (const tier of TIER_LADDER) {
    if (tier >= height) return tier;
  }
  return TIER_LADDER[TIER_LADDER.length - 1];
}

/**
 * Parse a tier from a yt-dlp format_note string.
 * "1080p" -> 1080, "1080p60" -> 1080, "1080p+medium" -> 1080, else null.
 */
function parseTierFromFormatNote(formatNote) {
  if (!formatNote || typeof formatNote !== 'string') return null;
  const match = formatNote.match(/^(\d+)p/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Probe a media file's first video stream with ffprobe and return its pixel
 * dimensions as a "WIDTHxHEIGHT" string (e.g. "1920x1080"). Resolves null
 * when the probe fails or yields no usable dimensions; never rejects.
 */
function probeVideoDimensions(videoFilePath) {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0',
        videoFilePath
      ],
      { timeout: FFPROBE_TIMEOUT_MS },
      (err, stdout) => {
        if (err) {
          logger.debug({ err, videoFilePath }, 'ffprobe resolution probe failed');
          return resolve(null);
        }
        const [width, height] = String(stdout).trim().split(',').map((v) => parseInt(v, 10));
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
          return resolve(null);
        }
        resolve(`${width}x${height}`);
      }
    );
  });
}

module.exports = { parseTierFromFormatNote, probeVideoDimensions, selectionTierForHeight };
