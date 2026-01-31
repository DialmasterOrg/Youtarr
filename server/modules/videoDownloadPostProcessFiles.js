const fs = require('fs-extra');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const configModule = require('./configModule');
const channelSettingsModule = require('./channelSettingsModule');
const nfoGenerator = require('./nfoGenerator');
const ratingMapper = require('./ratingMapper');
const tempPathManager = require('./download/tempPathManager');
const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const { JobVideoDownload } = require('../models');
const logger = require('../logger');
const { moveWithRetries, safeRemove, buildChannelPath, cleanupEmptyParents } = require('./filesystem');

const activeJobId = process.env.YOUTARR_JOB_ID;

const videoPath = process.argv[2]; // get the media file path (video or audio)
const parsedPath = path.parse(videoPath);
// Note that MP4 videos contain embedded metadata for Plex
// MP3 audio files have their own embedded metadata from yt-dlp
// We only need the .info.json for Youtarr to use
const jsonPath = path.format({
  dir: parsedPath.dir,
  name: parsedPath.name,
  ext: '.info.json'
});

const videoDirectory = path.dirname(videoPath);
// Poster image uses same filename as video but with .jpg extension
const imagePath = path.join(videoDirectory, parsedPath.name + '.jpg');

// Extract the actual channel folder name that yt-dlp created (already sanitized)
// This is more reliable than using jsonData.uploader which may contain special characters
// that yt-dlp sanitizes differently (e.g., #, :, <, >, etc.)
const actualChannelFolderName = path.basename(path.dirname(videoDirectory));

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

      // Build yt-dlp command using centralized helper so proxy/sleep/cookies are respected
      const ytdlpArgs = YtdlpCommandBuilder.buildThumbnailDownloadArgs(channelUrl, channelThumbPath);

      const result = spawnSync('yt-dlp', ytdlpArgs, {
        env: {
          ...process.env,
          TMPDIR: '/tmp'
        },
        encoding: 'utf8'
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        throw new Error(result.stderr || `yt-dlp exited with code ${result.status}`);
      }

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

    // Extract and map rating information
    const contentRating = jsonData.contentRating || jsonData.content_rating || null;
    const ageLimit = jsonData.age_limit || null;
    const ratingInfo = ratingMapper.mapFromEntry(contentRating, ageLimit);
    jsonData.content_rating = contentRating;
    jsonData.age_limit = ageLimit;
    if (ratingInfo.normalized_rating) {
      jsonData.normalized_rating = ratingInfo.normalized_rating;
      jsonData.rating_source = ratingInfo.source;
    }

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

    // Check for subfolder override from manual download (passed via environment variable)
    const subfolderOverride = process.env.YOUTARR_SUBFOLDER_OVERRIDE || null;

    if (subfolderOverride) {
      // Manual download with subfolder override
      const { ROOT_SENTINEL } = require('./filesystem/constants');
      if (subfolderOverride === ROOT_SENTINEL) {
        // Explicit root - no subfolder, download directly to output directory
        channelSubFolder = null;
        const baseDir = configModule.directoryPath;
        targetChannelFolder = buildChannelPath(baseDir, null, actualChannelFolderName);
        logger.info('[Post-Process] Using subfolder override: root directory (no subfolder)');
      } else if (subfolderOverride === channelSettingsModule.getGlobalDefaultSentinel()) {
        // Use global default subfolder
        channelSubFolder = channelSettingsModule.resolveEffectiveSubfolder(subfolderOverride);
        if (channelSubFolder) {
          const baseDir = configModule.directoryPath;
          targetChannelFolder = buildChannelPath(baseDir, channelSubFolder, actualChannelFolderName);
        }
        logger.info('[Post-Process] Using subfolder override: global default');
      } else {
        // Specific subfolder override
        channelSubFolder = subfolderOverride;
        const baseDir = configModule.directoryPath;
        targetChannelFolder = buildChannelPath(baseDir, subfolderOverride, actualChannelFolderName);
        logger.info(`[Post-Process] Using subfolder override: ${subfolderOverride}`);
      }
    } else if (jsonData.channel_id) {
      // No override - check channel settings or use global default
      try {
        const Channel = require('../models/channel');
        let channel = await Channel.findOne({
          where: { channel_id: jsonData.channel_id },
          attributes: ['id', 'sub_folder', 'uploader', 'folder_name', 'default_rating']
        });

        if (channel) {
          // Apply channel-level default rating if none exists in metadata
          if (!jsonData.normalized_rating) {
            const mapped = ratingMapper.mapFromEntry(jsonData.content_rating, jsonData.age_limit);
            if (mapped.normalized_rating) {
              jsonData.normalized_rating = mapped.normalized_rating;
              jsonData.rating_source = mapped.source;
            } else if (channel.default_rating && channel.default_rating !== 'NR') {
              jsonData.normalized_rating = channel.default_rating;
              jsonData.rating_source = 'Channel Default';
              logger.info(`[Post-Process] Applying channel default rating: ${channel.default_rating}`);
            }
          }

          // Tracked channel - resolve effective subfolder using centralized logic
          channelSubFolder = channelSettingsModule.resolveEffectiveSubfolder(channel.sub_folder);

          // Update folder_name if not set or different (channel may have been renamed on YouTube)
          if (actualChannelFolderName && channel.folder_name !== actualChannelFolderName) {
            try {
              await Channel.update(
                { folder_name: actualChannelFolderName },
                { where: { id: channel.id } }
              );
              logger.info(`[Post-Process] Updated channel folder_name to: ${actualChannelFolderName}`);
            } catch (updateErr) {
              console.error(`[Post-Process] Error updating folder_name: ${updateErr.message}`);
            }
          }
        } else {
          // Untracked channel (not in database) - auto-create with enabled=false
          logger.info(`[Post-Process] Untracked channel ${jsonData.channel_id}, auto-creating as disabled`);
          try {
            channel = await Channel.create({
              channel_id: jsonData.channel_id,
              uploader: jsonData.uploader || jsonData.channel || jsonData.uploader_id || null,
              folder_name: actualChannelFolderName,
              enabled: false,
              sub_folder: null
            });
            logger.info(`[Post-Process] Auto-created disabled channel with folder_name: ${actualChannelFolderName}`);
          } catch (createErr) {
            console.error(`[Post-Process] Error auto-creating channel: ${createErr.message}`);
          }

          // Use global default subfolder for the newly created channel
          channelSubFolder = configModule.getDefaultSubfolder();
        }

        if (channelSubFolder) {
          const baseDir = configModule.directoryPath;
          // Use the actual channel folder name from the filesystem (yt-dlp already sanitized it)
          // instead of jsonData.uploader which may contain special characters
          targetChannelFolder = buildChannelPath(baseDir, channelSubFolder, actualChannelFolderName);
          logger.info(`[Post-Process] Channel will use subfolder: ${channelSubFolder}`);
        }
      } catch (err) {
        console.error(`[Post-Process] Error checking channel subfolder: ${err.message}`);
      }
    } else {
      // No channel_id available (rare case) - use global default
      channelSubFolder = configModule.getDefaultSubfolder();
      if (channelSubFolder) {
        const baseDir = configModule.directoryPath;
        targetChannelFolder = buildChannelPath(baseDir, channelSubFolder, actualChannelFolderName);
        logger.info(`[Post-Process] No channel ID, using global default subfolder: ${channelSubFolder}`);
      }
    }

    // Phase 2: Calculate the final path for _actual_filepath with subfolder if applicable
    // Downloads always go to temp first, so we need to store the FINAL path, not the temp path
    let finalVideoPathForJson;

    if (targetChannelFolder) {
      // Channel has subfolder - calculate path with subfolder included
      const videoDirectoryName = path.basename(videoDirectory);
      const videoFileName = path.basename(videoPath);
      finalVideoPathForJson = path.join(targetChannelFolder, videoDirectoryName, videoFileName);
    } else {
      // No subfolder - use standard temp-to-final conversion
      finalVideoPathForJson = tempPathManager.convertTempToFinal(videoPath);
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

    // Check if this is an audio file (MP3) - skip video-specific metadata embedding
    const isAudioFile = parsedPath.ext.toLowerCase() === '.mp3';

    // Detect companion video file for dual-format downloads (video_mp3 mode)
    // When yt-dlp runs with --extract-audio --keep-video, it produces both MP4 and MP3
    // but only calls --exec for the final MP3 file. We need to track the MP4 as well.
    let companionVideoPath = null;
    if (isAudioFile) {
      const potentialVideoPath = path.join(parsedPath.dir, parsedPath.name + '.mp4');
      if (fs.existsSync(potentialVideoPath)) {
        companionVideoPath = potentialVideoPath;
        logger.info({ audioPath: videoPath, videoPath: companionVideoPath },
          '[Post-Process] Dual-format download detected (video_mp3 mode)');
      }
    }

    // Add additional metadata to the MP4 file that yt-dlp might have missed
    // yt-dlp already embeds basic metadata, but we can add more for better Plex compatibility
    // Skip for audio-only downloads (MP3 files)
    if (isAudioFile) {
      logger.info('[Post-Process] Audio file detected, skipping video metadata embedding');
    } else try {
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

      // Add rating metadata if available
      if (jsonData.normalized_rating) {
        ffmpegArgs.push('-metadata', `rating=${jsonData.normalized_rating}`);
      }
      if (jsonData.content_rating) {
        const ratingSource = jsonData.rating_source || 'youtube';
        ffmpegArgs.push('-metadata', `content_rating=${ratingSource}`);
      }
      if (jsonData.age_limit) {
        ffmpegArgs.push('-metadata', `age_limit=${jsonData.age_limit}`);
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
      // Set timestamp for the video/audio file (whatever was passed to post-processor)
      if (fs.existsSync(videoPath)) {
        try {
          fs.utimesSync(videoPath, uploadDate, uploadDate);
          logger.info({ timestamp: uploadDate.toISOString() }, 'Set primary file timestamp');
        } catch (err) {
          logger.warn({ err }, 'Error setting primary file timestamp');
        }
      }

      // Set timestamp for companion video file (dual-format downloads)
      if (companionVideoPath && fs.existsSync(companionVideoPath)) {
        try {
          fs.utimesSync(companionVideoPath, uploadDate, uploadDate);
          logger.info({ timestamp: uploadDate.toISOString() }, 'Set companion video timestamp');
        } catch (err) {
          logger.warn({ err }, 'Error setting companion video timestamp');
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

    // Phase 3: Move files from temp to final location
    // Downloads are always staged in temp, so we move to final location here
    // This handles subfolder routing atomically (one move instead of two)
    let finalVideoPath = videoPath;

    if (tempPathManager.isTempPath(videoPath)) {
      logger.info('[Post-Process] Moving files from temp to final location');

      // Calculate target video directory based on subfolder setting
      const videoDirectoryName = path.basename(videoDirectory);
      const videoFileName = path.basename(videoPath);
      let targetVideoDirectory;
      let targetChannelFolderForMove;

      if (targetChannelFolder) {
        // Channel has subfolder - move directly to subfolder location (atomic move)
        targetVideoDirectory = path.join(targetChannelFolder, videoDirectoryName);
        targetChannelFolderForMove = targetChannelFolder;
        logger.info(`[Post-Process] Moving to subfolder location: ${channelSubFolder}`);
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

        // Clean up yt-dlp intermediate files before moving
        // In video_mp3 mode with --extract-audio --keep-video, yt-dlp doesn't always
        // clean up these intermediate files as it normally would
        const filesInDir = await fs.readdir(videoDirectory);
        for (const file of filesInDir) {
          // Match yt-dlp fragment patterns: .f###.ext or .f###-###.ext where ext is mp4/m4a/webm/mkv
          if (/\.f[\d-]+\.(mp4|m4a|webm|mkv)$/i.test(file)) {
            const fragmentPath = path.join(videoDirectory, file);
            logger.info({ fragmentPath }, '[Post-Process] Removing yt-dlp fragment file');
            await fs.remove(fragmentPath);
          }
          // Remove original thumbnail files (.webp) - these should have been converted to .jpg
          else if (/\.webp$/i.test(file)) {
            const webpPath = path.join(videoDirectory, file);
            logger.info({ webpPath }, '[Post-Process] Removing original webp thumbnail');
            await fs.remove(webpPath);
          }
          // Remove original subtitle files (.vtt) - these should have been converted to .srt
          else if (/\.vtt$/i.test(file)) {
            const vttPath = path.join(videoDirectory, file);
            logger.info({ vttPath }, '[Post-Process] Removing original vtt subtitle');
            await fs.remove(vttPath);
          }
        }

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

        logger.info({ targetVideoDirectory }, '[Post-Process] Successfully moved to final location');

        // Clean up empty parent directories in the temp path (e.g., empty channel folder)
        const tempBasePath = tempPathManager.getTempBasePath();
        const parentDir = path.dirname(videoDirectory); // This was the channel folder in temp
        await cleanupEmptyParents(parentDir, tempBasePath);

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

    // Update the JSON file with the final path (after all moves are complete)
    // This ensures videoMetadataProcessor gets the correct location
    try {
      // Handle dual-format downloads (video_mp3 mode): track both video and audio paths
      if (isAudioFile && companionVideoPath) {
        // Calculate final path for companion video (same directory as the audio file)
        const finalCompanionVideoPath = path.join(
          path.dirname(finalVideoPath),
          path.basename(companionVideoPath)
        );

        // Store both paths for videoMetadataProcessor
        jsonData._actual_video_filepath = finalCompanionVideoPath;
        jsonData._actual_audio_filepath = finalVideoPath;
        // Keep _actual_filepath as video for backward compatibility
        jsonData._actual_filepath = finalCompanionVideoPath;

        logger.info({
          videoPath: finalCompanionVideoPath,
          audioPath: finalVideoPath
        }, '[Post-Process] Updated dual-format paths in JSON');
      } else if (isAudioFile) {
        // Audio-only download (mp3_only mode)
        jsonData._actual_audio_filepath = finalVideoPath;
        jsonData._actual_filepath = finalVideoPath;
        logger.info({ finalVideoPath }, '[Post-Process] Updated _actual_filepath in JSON (audio-only)');
      } else {
        // Standard video download
        jsonData._actual_video_filepath = finalVideoPath;
        jsonData._actual_filepath = finalVideoPath;
        logger.info({ finalVideoPath }, '[Post-Process] Updated _actual_filepath in JSON');
      }

      fs.writeFileSync(newJsonPath, JSON.stringify(jsonData, null, 2));
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
