const fs = require('fs-extra');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const configModule = require('./configModule');
const nfoGenerator = require('./nfoGenerator');
const tempPathManager = require('./download/tempPathManager');
const { JobVideoDownload } = require('../models');
const logger = require('../logger');

const activeJobId = process.env.YOUTARR_JOB_ID;

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
// Poster image uses same filename as video but with .jpg extension
const imagePath = path.join(videoDirectory, parsedPath.name + '.jpg');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function moveWithRetries(src, dest, { retries = 5, delayMs = 200 } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      await fs.move(src, dest, { overwrite: true });
      return;
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        throw err;
      }
      const backoff = delayMs * Math.pow(2, attempt);
      await sleep(backoff);
      attempt += 1;
    }
  }

  throw lastError;
}

async function safeRemove(filePath) {
  try {
    await fs.remove(filePath);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      logger.warn({ err, filePath }, 'Error deleting temp file');
    }
  }
}

function shouldWriteChannelPosters() {
  const config = configModule.getConfig() || {};
  return config.writeChannelPosters !== false;
}

function shouldWriteVideoNfoFiles() {
  const config = configModule.getConfig() || {};
  return config.writeVideoNfoFiles !== false;
}

// Helper function to download channel thumbnail if needed
async function downloadChannelThumbnailIfMissing(channelId) {
  const channelThumbPath = path.join(
    configModule.getImagePath(),
    `channelthumb-${channelId}.jpg`
  );

  if (!fs.existsSync(channelThumbPath)) {
    try {

      // Build the channel URL from the channel ID
      const channelUrl = `https://www.youtube.com/channel/${channelId}`;

      // Build yt-dlp command with cookies if configured
      let ytdlpCmd = 'yt-dlp';
      const cookiesPath = configModule.getCookiesPath();
      if (cookiesPath) {
        ytdlpCmd += ` --cookies "${cookiesPath}"`;
      }
      ytdlpCmd += ` --skip-download --write-thumbnail --playlist-end 1 --playlist-items 0 --convert-thumbnails jpg -o "channelthumb-%(channel_id)s.jpg" "${channelUrl}"`;

      // Download the thumbnail using yt-dlp
      execSync(ytdlpCmd, {
        cwd: configModule.getImagePath(),
        stdio: 'pipe'
      });

      // Resize the thumbnail to make it smaller
      if (fs.existsSync(channelThumbPath)) {
        const tempPath = channelThumbPath + '.temp';
        execSync(
          `${configModule.ffmpegPath} -loglevel error -y -i "${channelThumbPath}" -vf "scale=iw*0.4:ih*0.4" -q:v 2 "${tempPath}"`,
          { stdio: 'pipe' }
        );
        fs.renameSync(tempPath, channelThumbPath);
      }
    } catch (err) {
      logger.warn({ err }, 'Error downloading channel thumbnail');
    }
  }
}

// Helper function to copy channel thumb as poster.jpg to channel folder
async function copyChannelPosterIfNeeded(channelId, channelFolderPath) {
  if (!shouldWriteChannelPosters()) {
    return;
  }

  try {
    const channelPosterPath = path.join(channelFolderPath, 'poster.jpg');
    // Only copy if poster.jpg doesn't already exist
    if (!fs.existsSync(channelPosterPath)) {
      // First ensure we have the channel thumbnail
      await downloadChannelThumbnailIfMissing(channelId);

      const channelThumbPath = path.join(
        configModule.getImagePath(),
        `channelthumb-${channelId}.jpg`
      );

      if (fs.existsSync(channelThumbPath)) {
        fs.copySync(channelThumbPath, channelPosterPath);
        logger.info({ channelFolderPath }, 'Channel poster.jpg created');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Error copying channel poster');
  }
}

// Main execution wrapped in async IIFE to handle async operations
(async () => {
  if (fs.existsSync(jsonPath)) {
    // Read the JSON file to get the upload_date
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Parse the upload_date (format: YYYYMMDD) into a Date object
    let uploadDate = null;
    if (jsonData.upload_date) {
      try {
        const dateStr = jsonData.upload_date.toString();
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        uploadDate = new Date(`${year}-${month}-${day}T00:00:00`);

        // Check if the date is valid
        if (isNaN(uploadDate.getTime())) {
          logger.warn({ uploadDate: jsonData.upload_date }, 'Invalid upload_date format');
          uploadDate = null;
        }
      } catch (err) {
        logger.warn({ err, uploadDate: jsonData.upload_date }, 'Error parsing upload_date');
        uploadDate = null;
      }
    }

    const filename = path.basename(jsonPath, '.info.json'); // get the filename
    const matches = filename.match(/\[(.*?)\]/g); // Extract all occurrences of video IDs enclosed in brackets
    const id = matches
      ? matches[matches.length - 1].replace(/[[\]]/g, '')
      : 'default'; // take the last match and remove brackets or use 'default'
    const directoryPath = path.join(configModule.getJobsPath(), 'info');
    const newImagePath = configModule.getImagePath();

    fs.ensureDirSync(directoryPath); // ensures that the directory exists, if it doesn't it will create it
    const newJsonPath = path.join(directoryPath, `${id}.info.json`); // define the new path

    // Phase 1: Early subfolder detection
    // Determine target channel folder (with subfolder if applicable) BEFORE any moves
    let targetChannelFolder = null;
    let channelSubFolder = null;

    if (jsonData.channel_id) {
      try {
        const Channel = require('../models/channel');
        const channel = await Channel.findOne({
          where: { channel_id: jsonData.channel_id },
          attributes: ['sub_folder', 'uploader']
        });

        if (channel && channel.sub_folder) {
          channelSubFolder = channel.sub_folder;
          const baseDir = configModule.directoryPath;
          const channelName = jsonData.uploader || jsonData.channel || channel.uploader;
          // Add __ prefix for namespace safety
          targetChannelFolder = path.join(baseDir, `__${channel.sub_folder}`, channelName);
          console.log(`[Post-Process] Channel has subfolder setting: ${channel.sub_folder}`);
        }
      } catch (err) {
        console.error(`[Post-Process] Error checking channel subfolder: ${err.message}`);
      }
    }

    // Phase 2: Calculate the final path for _actual_filepath with subfolder if applicable
    // If temp downloads are enabled, we need to store the FINAL path, not the temp path
    let finalVideoPathForJson;

    if (tempPathManager.isEnabled() && tempPathManager.isTempPath(videoPath)) {
      // Temp downloads enabled
      if (targetChannelFolder) {
        // Channel has subfolder - calculate path with subfolder included
        const videoDirectoryName = path.basename(videoDirectory);
        const videoFileName = path.basename(videoPath);
        finalVideoPathForJson = path.join(targetChannelFolder, videoDirectoryName, videoFileName);
      } else {
        // No subfolder - use standard temp-to-final conversion
        finalVideoPathForJson = tempPathManager.convertTempToFinal(videoPath);
      }
    } else {
      // Not using temp downloads
      if (targetChannelFolder) {
        // Channel has subfolder - calculate expected path with subfolder
        const currentChannelFolder = path.dirname(videoDirectory);
        const channelName = path.basename(currentChannelFolder);
        const videoDirectoryName = path.basename(videoDirectory);
        const videoFileName = path.basename(videoPath);
        const baseDir = configModule.directoryPath;
        finalVideoPathForJson = path.join(baseDir, channelSubFolder, channelName, videoDirectoryName, videoFileName);
      } else {
        // No subfolder - use current path
        finalVideoPathForJson = videoPath;
      }
    }

    // Add the actual video filepath to the JSON data before moving it
    // IMPORTANT: This should always be the final path, never the temp path
    jsonData._actual_filepath = finalVideoPathForJson;
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

    fs.moveSync(jsonPath, newJsonPath, { overwrite: true }); // move the file

    // Generate NFO file for Jellyfin/Kodi/Emby compatibility if enabled
    if (shouldWriteVideoNfoFiles()) {
      nfoGenerator.writeVideoNfoFile(videoPath, jsonData);
    }

    // Add additional metadata to the MP4 file that yt-dlp might have missed
    // yt-dlp already embeds basic metadata, but we can add more for better Plex compatibility
    try {
      const tempPath = videoPath + '.metadata_temp.mp4';

      // Build metadata arguments as an array to avoid shell escaping issues
      const ffmpegArgs = [
        '-i', videoPath,
        '-c', 'copy',
        '-map_metadata', '0'
      ];

      // Add genre from categories (yt-dlp doesn't embed this)
      if (jsonData.categories && jsonData.categories.length > 0) {
        const genre = jsonData.categories.join(';');
        ffmpegArgs.push('-metadata', `genre=${genre}`);
      }

      // Add studio/network (channel name)
      const channelName = jsonData.uploader || jsonData.channel || jsonData.uploader_id || '';
      if (channelName) {
        ffmpegArgs.push('-metadata', `network=${channelName}`);
        ffmpegArgs.push('-metadata', `studio=${channelName}`);
        ffmpegArgs.push('-metadata', `artist=${channelName}`);
        ffmpegArgs.push('-metadata', `album=${channelName}`); // For collection grouping
        ffmpegArgs.push('-metadata', `title=${channelName} - ${jsonData.title}`); // Include channel name in title
      }

      // Add tags as keywords
      if (jsonData.tags && jsonData.tags.length > 0) {
        const keywords = jsonData.tags.slice(0, 10).join(';');
        ffmpegArgs.push('-metadata', `keywords=${keywords}`);
      }

      // Add release date for Plex/mp4 embedded metadata
      // Good lord Plex is finicky
      if (jsonData.upload_date) {
        const year = jsonData.upload_date.substring(0, 4);
        const month = jsonData.upload_date.substring(4, 6);
        const day = jsonData.upload_date.substring(6, 8);
        const releaseDate = `${year}-${month}-${day}`;
        ffmpegArgs.push('-metadata', `release_date=${releaseDate}`);
        ffmpegArgs.push('-metadata', `date=${releaseDate}`);
        ffmpegArgs.push('-metadata', `year=${year}`);
        ffmpegArgs.push('-metadata', `originaldate=${releaseDate}`);
      }

      // Add media type hint for Plex (9 = Home Video)
      ffmpegArgs.push('-metadata', 'media_type=9');

      // Output file
      ffmpegArgs.push('-y', tempPath);

      logger.info('Adding additional metadata for Plex');
      const result = spawnSync(configModule.ffmpegPath, ffmpegArgs, {
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        const stderr = result.stderr ? result.stderr.toString() : 'Unknown error';
        throw new Error(`ffmpeg exited with status ${result.status}: ${stderr}`);
      }

      // Replace original with temp file if successful
      if (await fs.pathExists(tempPath)) {
        const tempStats = await fs.stat(tempPath);
        let origStats = null;
        try {
          origStats = await fs.stat(videoPath);
        } catch (statErr) {
          if (!statErr || statErr.code !== 'ENOENT') {
            throw statErr;
          }
        }

        const originalSize = origStats ? origStats.size : 0;
        const sizeThreshold = originalSize * 0.9;
        const sizeCheckPassed = !origStats || tempStats.size >= sizeThreshold;

        if (sizeCheckPassed) {
          try {
            await moveWithRetries(tempPath, videoPath);
            logger.info('Successfully added additional metadata to video file');
          } catch (moveErr) {
            logger.warn({ err: moveErr }, 'Could not replace video with metadata-enhanced version');
            await safeRemove(tempPath);
          }
        } else {
          logger.warn('Skipped metadata update due to file size mismatch');
          await safeRemove(tempPath);
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Could not add additional metadata');
      // Clean up temp file if exists
      const tempPath = videoPath + '.metadata_temp.mp4';
      if (await fs.pathExists(tempPath)) {
        await safeRemove(tempPath);
      }
    }

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
        logger.info('Image resized successfully');
      } catch (err) {
        logger.error({ err }, 'Error resizing image');
      }
    }

    // Set the file timestamps to match the upload date
    if (uploadDate) {
      // Set timestamp for the video file
      if (fs.existsSync(videoPath)) {
        try {
          fs.utimesSync(videoPath, uploadDate, uploadDate);
          logger.info({ timestamp: uploadDate.toISOString() }, 'Set video timestamp');
        } catch (err) {
          logger.warn({ err }, 'Error setting video timestamp');
        }
      }

      // Set timestamp for the thumbnail
      if (fs.existsSync(imagePath)) {
        try {
          fs.utimesSync(imagePath, uploadDate, uploadDate);
          logger.info({ timestamp: uploadDate.toISOString() }, 'Set thumbnail timestamp');
        } catch (err) {
          logger.warn({ err }, 'Error setting thumbnail timestamp');
        }
      }

      // Set timestamp for the directory
      if (fs.existsSync(videoDirectory)) {
        try {
          fs.utimesSync(videoDirectory, uploadDate, uploadDate);
          logger.info({ timestamp: uploadDate.toISOString() }, 'Set directory timestamp');
        } catch (err) {
          logger.warn({ err }, 'Error setting directory timestamp');
        }
      }
    }

    // Phase 3: If temp downloads are enabled, move files from temp to final location
    // This now handles subfolder routing atomically (one move instead of two)
    let finalVideoPath = videoPath;
    let currentChannelFolder = path.dirname(videoDirectory);

    if (tempPathManager.isEnabled() && tempPathManager.isTempPath(videoPath)) {
      logger.info('[Post-Process] Temp downloads enabled, moving files to final location');

      // Calculate target video directory based on subfolder setting
      const videoDirectoryName = path.basename(videoDirectory);
      const videoFileName = path.basename(videoPath);
      let targetVideoDirectory;
      let targetChannelFolderForMove;

      if (targetChannelFolder) {
        // Channel has subfolder - move directly to subfolder location (atomic move)
        targetVideoDirectory = path.join(targetChannelFolder, videoDirectoryName);
        targetChannelFolderForMove = targetChannelFolder;
        console.log(`[Post-Process] Moving to subfolder location: ${channelSubFolder}`);
      } else {
        // No subfolder - move to standard location
        const standardFinalPath = tempPathManager.convertTempToFinal(videoPath);
        const standardChannelFolder = path.dirname(path.dirname(standardFinalPath));
        targetVideoDirectory = path.join(standardChannelFolder, videoDirectoryName);
        targetChannelFolderForMove = standardChannelFolder;
      }

      logger.info({ from: videoDirectory, to: targetVideoDirectory }, '[Post-Process] Moving video directory');

      try {
        // Ensure parent channel directory exists
        await fs.ensureDir(targetChannelFolderForMove);

        // Check if target video directory already exists (rare, but handle gracefully)
        const targetExists = await fs.pathExists(targetVideoDirectory);

        if (targetExists) {
          logger.warn({ targetVideoDirectory }, '[Post-Process] Target directory already exists, removing before move');
          await fs.remove(targetVideoDirectory);
        }

        // Move the entire video directory from temp to final location (atomic move)
        await fs.move(videoDirectory, targetVideoDirectory);

        // Update paths to reflect final locations
        finalVideoPath = path.join(targetVideoDirectory, videoFileName);
        currentChannelFolder = targetChannelFolderForMove;

        logger.info({ targetVideoDirectory }, '[Post-Process] Successfully moved to final location');

        // Verify the final file exists
        if (!fs.existsSync(finalVideoPath)) {
          logger.error({ finalVideoPath }, '[Post-Process] Final video file doesn\'t exist after move');
          process.exit(1);
        }

      } catch (error) {
        logger.error({ error, videoDirectory }, '[Post-Process] ERROR during move operation');
        logger.error({ videoDirectory }, '[Post-Process] Files remain in temp location');
        process.exit(1);
      }
    }

    // Phase 4: Check if channel has a subfolder setting and move if needed
    // This only runs when NOT using temp downloads (temp downloads handle subfolder atomically above)
    if (!tempPathManager.isEnabled() || !tempPathManager.isTempPath(videoPath)) {
      if (jsonData.channel_id) {
        try {
          const Channel = require('../models/channel');
          const channel = await Channel.findOne({
            where: { channel_id: jsonData.channel_id },
            attributes: ['sub_folder', 'uploader']
          });

          if (channel && channel.sub_folder) {
            const baseDir = configModule.directoryPath;
            const channelName = jsonData.uploader || jsonData.channel || channel.uploader;
            // Add __ prefix for namespace safety
            const expectedPath = path.join(baseDir, `__${channel.sub_folder}`, channelName);

            // Check if we're not already in the correct subfolder
            if (currentChannelFolder !== expectedPath) {
              logger.info({ subFolder: channel.sub_folder }, '[Post-Process] Channel has subfolder setting');
              logger.info({ from: currentChannelFolder, to: expectedPath }, '[Post-Process] Moving channel folder to subfolder');

              // Ensure the subfolder parent directory exists with __ prefix
              const subfolderParent = path.join(baseDir, `__${channel.sub_folder}`);
              await fs.ensureDir(subfolderParent);

              // Check if destination exists
              const destExists = await fs.pathExists(expectedPath);

              if (destExists) {
                // Destination exists - merge contents
                logger.info('[Post-Process] Destination exists, merging contents');

                // Get all items in the source channel folder
                const items = await fs.readdir(currentChannelFolder);

                for (const item of items) {
                  const sourcePath = path.join(currentChannelFolder, item);
                  const destPath = path.join(expectedPath, item);

                  try {
                    const destItemExists = await fs.pathExists(destPath);

                    if (destItemExists) {
                      // Item already exists at destination
                      if (item === 'poster.jpg') {
                        // Poster already exists, just remove source
                        await fs.remove(sourcePath);
                        logger.debug({ item }, '[Post-Process] Skipped (already exists)');
                      } else {
                        // For other items (shouldn't happen for video folders), log warning
                        logger.warn({ item }, '[Post-Process] Item already exists at destination, skipping');
                        await fs.remove(sourcePath);
                      }
                    } else {
                      // Move the item
                      await fs.move(sourcePath, destPath);
                      logger.debug({ item }, '[Post-Process] Moved item');
                    }
                  } catch (itemErr) {
                    logger.error({ err: itemErr, item }, '[Post-Process] Error moving item');
                    // Try to remove source item anyway to clean up
                    try {
                      await fs.remove(sourcePath);
                    } catch (removeErr) {
                      // Ignore cleanup errors
                    }
                  }
                }

                // Remove the now-empty source channel folder
                await fs.remove(currentChannelFolder);
              } else {
                // Destination doesn't exist - move entire folder
                await fs.move(currentChannelFolder, expectedPath);
              }

              // Update the final video path to reflect the new location
              const relativePath = path.relative(currentChannelFolder, finalVideoPath);
              finalVideoPath = path.join(expectedPath, relativePath);

              logger.info({ expectedPath, finalVideoPath }, '[Post-Process] Successfully moved to subfolder');
            }
          }
        } catch (err) {
          logger.error({ err }, '[Post-Process] Error moving to subfolder');
          // Don't fail the entire post-processing if subfolder move fails
          // The video is still downloaded and accessible, just not in the ideal location
        }
      }
    }

    // Update the JSON file with the final path (after all moves are complete)
    // This ensures videoMetadataProcessor gets the correct location
    try {
      jsonData._actual_filepath = finalVideoPath;
      fs.writeFileSync(newJsonPath, JSON.stringify(jsonData, null, 2));
      logger.info({ finalVideoPath }, '[Post-Process] Updated _actual_filepath in JSON');
    } catch (jsonErr) {
      logger.error({ err: jsonErr }, '[Post-Process] Error updating JSON file with final path');
      // Don't fail the process, but log the error
    }

    // Copy channel thumbnail as poster.jpg to channel folder (must be done AFTER all moves)
    // Calculate the final channel folder path based on the final video path
    const finalChannelFolderPath = path.dirname(path.dirname(finalVideoPath));
    if (jsonData.channel_id) {
      await copyChannelPosterIfNeeded(jsonData.channel_id, finalChannelFolderPath);
    }

    // Mark this video as completed in the JobVideoDownload tracking table
    // IMPORTANT: Always use final path in database, never temp path
    if (activeJobId) {
      try {
        const [updatedCount] = await JobVideoDownload.update(
          { status: 'completed', file_path: finalVideoPath },
          {
            where: {
              job_id: activeJobId,
              youtube_id: id
            }
          }
        );
        if (updatedCount > 0) {
          logger.info({ id, activeJobId, finalVideoPath }, 'Marked video as completed in tracking');
        }
      } catch (err) {
        logger.error({ err, id }, 'Error updating JobVideoDownload status');
        // Don't fail the entire post-processing if this fails
      }
    } else {
      logger.warn({ id }, 'Job ID not available while marking video as completed; skipping tracking update');
    }
  }
})().catch(err => {
  logger.error({ err }, 'Error in post-processing');
  process.exit(1);
});

configModule.stopWatchingConfig();
