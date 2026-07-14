const fs = require('fs-extra');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const configModule = require('./configModule');
const nfoGenerator = require('./nfoGenerator');
const ratingMapper = require('./ratingMapper');
const tempPathManager = require('./download/tempPathManager');
const downloadSettingsResolver = require('./download/downloadSettingsResolver');
const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const { JobVideoDownload } = require('../models');
const videoPersistence = require('./videoPersistence');
const { VIDEO_PERSISTED_MARKER } = require('./constants/outputMarkers');
const logger = require('../logger');
const { buildChannelPath, cleanupEmptyParents, moveWithRetries, ensureDirWithRetries, copySyncWithFallback } = require('./filesystem');

const activeJobId = process.env.YOUTARR_JOB_ID;

// Flat mode: skip video subfolder, files go directly in channel folder.
// Describes the INCOMING temp layout written by the yt-dlp output template.
const isFlatMode = process.env.YOUTARR_SKIP_VIDEO_FOLDER === 'true';

// Per-video structure mode (manual downloads): the final flat-vs-subfolder
// decision is made here per video (override -> channel -> global) instead of
// being fixed per job. Incoming temp layout is always nested in this mode.
const perVideoStructure = process.env.YOUTARR_STRUCTURE_PER_VIDEO === 'true';
const skipVideoFolderOverrideEnv = process.env.YOUTARR_SKIP_VIDEO_FOLDER_OVERRIDE;

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
// In flat mode, videoDirectory IS the channel folder; in nested mode, parent is channel folder
const actualChannelFolderName = isFlatMode
  ? path.basename(videoDirectory)
  : path.basename(path.dirname(videoDirectory));

function shouldWriteChannelPosters() {
  const config = configModule.getConfig() || {};
  return config.writeChannelPosters !== false;
}

function shouldWriteVideoNfoFiles() {
  const config = configModule.getConfig() || {};
  return config.writeVideoNfoFiles !== false;
}

function shouldWriteVideoFanart() {
  const config = configModule.getConfig() || {};
  return config.writeVideoFanart === true;
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
          TMPDIR: tempPathManager.getTempBasePath()
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
        copySyncWithFallback(channelThumbPath, channelPosterPath);
        logger.info({ channelFolderPath }, 'Channel poster.jpg created');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Error copying channel poster');
  }
}

// Parse the per-video owner-channel map (YOUTARR_OWNER_CHANNEL_MAP, set for
// playlist downloads). Maps youtube_id -> owning channel_id, from the per-video
// attribution captured at playlist sync. An entry wins over the .info.json
// channel_id, which for VEVO/Topic uploads points at the auto-generated upload
// channel instead of the channel the user subscribed to.
function parseOwnerChannelMapEnv() {
  const raw = process.env.YOUTARR_OWNER_CHANNEL_MAP;
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    logger.warn({ err }, 'Post-process: could not parse owner channel map');
    return null;
  }
}

// Find the tracked channel that owns this video when no explicit owner was
// passed (manual URL paste, channel auto-download). `channelvideos` records
// every channel that listed a video; for a VEVO/Topic upload that includes both
// the untracked auto-channel (the video's own channel_id) and the
// subscribed/artist channel. Prefer the video's own channel_id when tracked,
// otherwise any tracked associated channel; never an untracked id.
async function resolveTrackedOwnerChannelId(youtubeId, metadataChannelId) {
  if (!youtubeId || youtubeId === 'default') {
    return null;
  }
  try {
    const ChannelVideo = require('../models/channelvideo');
    const { Channel } = require('../models');

    const rows = await ChannelVideo.findAll({
      where: { youtube_id: youtubeId },
      attributes: ['channel_id'],
    });
    // Video's own channel first, then the channels that listed it.
    const candidates = [metadataChannelId, ...rows.map((r) => r.channel_id)].filter(Boolean);
    const unique = [...new Set(candidates)];
    if (unique.length === 0) {
      return null;
    }

    const tracked = await Channel.findAll({
      where: { channel_id: unique },
      attributes: ['channel_id', 'enabled'],
    });
    const enabledIds = new Set(tracked.filter((c) => c.enabled).map((c) => c.channel_id));
    const trackedIds = new Set(tracked.map((c) => c.channel_id));
    // Prefer an enabled owner: only enabled channels contribute routing
    // settings downstream, so a disabled candidate (e.g. a hidden auto-created
    // playlist source channel) must not shadow a later enabled association.
    // A disabled-only match still returns so metadata backfill keeps working.
    for (const candidate of unique) {
      if (enabledIds.has(candidate)) {
        return candidate;
      }
    }
    for (const candidate of unique) {
      if (trackedIds.has(candidate)) {
        return candidate;
      }
    }
    return null;
  } catch (err) {
    logger.warn({ err, youtubeId }, 'Post-process: tracked owner channel lookup failed');
    return null;
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

    // Check for subfolder override from manual download (passed via environment variable)
    const subfolderOverride = process.env.YOUTARR_SUBFOLDER_OVERRIDE || null;

    // Check for explicit rating override from manual download
    const ratingOverrideEnv = process.env.YOUTARR_OVERRIDE_RATING;

    // Soft fallbacks (playlist defaults); used only when the real channel has no setting.
    // A present hard rating override always wins, so suppress the rating fallback in that case.
    const subfolderFallbackEnv = process.env.YOUTARR_SUBFOLDER_FALLBACK || null;
    const ratingFallbackEnv = process.env.YOUTARR_OVERRIDE_RATING ? null : (process.env.YOUTARR_RATING_FALLBACK || null);

    // Resolve which channel owns this download, in priority order: explicit
    // owner env (channel-page download) > per-video map (playlist download) >
    // tracked channel already associated with this video > the video's own
    // channel_id. The .info.json channel_id alone misses VEVO/Topic uploads,
    // whose auto-generated channel differs from the subscribed channel.
    const ownerChannelId = process.env.YOUTARR_OWNER_CHANNEL_ID
      ? process.env.YOUTARR_OWNER_CHANNEL_ID.trim()
      : null;
    const ownerChannelMap = ownerChannelId ? null : parseOwnerChannelMapEnv();
    const mappedOwnerChannelId = ownerChannelMap && ownerChannelMap[id] ? String(ownerChannelMap[id]).trim() : null;
    const metadataChannelId = jsonData.channel_id ? jsonData.channel_id.trim() : null;
    const explicitOwnerChannelId = ownerChannelId || mappedOwnerChannelId;
    const trackedOwnerChannelId = explicitOwnerChannelId
      ? null
      : await resolveTrackedOwnerChannelId(id, metadataChannelId);
    const lookupChannelId = explicitOwnerChannelId || trackedOwnerChannelId || metadataChannelId;

    // Always look up channel to apply default rating (independent of subfolder)
    let channelRecord = null;
    if (lookupChannelId) {
      try {
        // Use the centralized models export to ensure proper associations/initialization
        const { Channel } = require('../models');

        const channelId = lookupChannelId;
        channelRecord = await Channel.findOne({
          where: { channel_id: channelId },
          attributes: ['id', 'sub_folder', 'title', 'uploader', 'folder_name', 'default_rating', 'enabled', 'skip_video_folder']
        });

        logger.info({ channelId, ownerProvided: !!ownerChannelId, found: !!channelRecord }, 'Post-process channel lookup');
        if (channelRecord) {
          logger.info({ channelId, defaultRating: channelRecord.default_rating }, 'Post-process channel default rating');

          // Backfill channel metadata learned from the download. folder_name is the
          // yt-dlp-sanitized directory name; title/uploader use the raw channel name
          // and are only filled when currently empty (e.g. a channel auto-seeded from
          // a playlist with just a channel_id, before the playlist sync captured a
          // channel_name), so an activated/refreshed channel is never clobbered.
          // Only when the record was resolved via the video's own channel_id: the
          // on-disk folder is named after the video's uploader, so for an
          // owner-resolved record (e.g. the artist channel of a VEVO/Topic upload)
          // these values describe a different channel and must not be written.
          const isUploaderChannel = lookupChannelId === metadataChannelId;
          const realChannelName = jsonData.uploader || jsonData.channel || null;
          const channelPatch = {};
          if (isUploaderChannel && actualChannelFolderName && channelRecord.folder_name !== actualChannelFolderName) {
            channelPatch.folder_name = actualChannelFolderName;
          }
          if (isUploaderChannel && realChannelName && !channelRecord.title) channelPatch.title = realChannelName;
          if (isUploaderChannel && realChannelName && !channelRecord.uploader) channelPatch.uploader = realChannelName;
          if (Object.keys(channelPatch).length > 0) {
            try {
              await Channel.update(channelPatch, { where: { id: channelRecord.id } });
              Object.assign(channelRecord, channelPatch);
              logger.info({ channelId, patch: channelPatch }, 'Post-process backfilled channel metadata');
            } catch (updateErr) {
              logger.error({ err: updateErr }, 'Post-process error updating channel metadata');
            }
          }
        } else {
          logger.info({ channelId }, 'Post-process channel not found; assuming no channel default rating');
        }
      } catch (err) {
        logger.error({ err }, 'Post-process error looking up channel');
      }
    }

    // Only an enabled channel contributes routing settings (rating, subfolder). A disabled
    // channel is invisible in the UI, so treat it as untracked and fall through to the
    // playlist fallback -> global. channelRecord above is still used for metadata backfill
    // regardless of enabled state.
    const settingsChannelRecord = channelRecord && channelRecord.enabled ? channelRecord : null;

    // Outgoing layout: in per-video mode, resolve flat-vs-subfolder from the
    // video's real channel (hard override -> channel tri-state -> global);
    // fixed mode keeps the per-job layout. Incoming per-video layout is always
    // nested, so the only conversion ever performed is nested -> flat.
    const outgoingFlat = perVideoStructure
      ? downloadSettingsResolver.resolveSkipVideoFolder({
        override: skipVideoFolderOverrideEnv === undefined
          ? {}
          : { skipVideoFolder: skipVideoFolderOverrideEnv === 'true' },
        channel: settingsChannelRecord,
        config: configModule.getConfig(),
      })
      : isFlatMode;
    logger.info({ perVideoStructure, incomingFlat: isFlatMode, outgoingFlat }, 'Post-process resolved file structure');

    // Determine effective rating using strict priority order:
    // 1. Manual Override
    // 2. Channel Default
    // 3. Mapped Metadata
    // 4. NR
    const manualOverride = (ratingOverrideEnv !== undefined && ratingOverrideEnv !== null && ratingOverrideEnv !== '')
      ? ratingOverrideEnv
      : undefined;

    const effectiveRating = ratingMapper.determineEffectiveRating(
      jsonData,
      settingsChannelRecord ? settingsChannelRecord.default_rating : null,
      manualOverride,
      ratingFallbackEnv
    );

    jsonData.normalized_rating = effectiveRating.normalized_rating;
    jsonData.rating_source = effectiveRating.rating_source;

    // Log the decision
    if (jsonData.normalized_rating) {
      logger.info({ rating: jsonData.normalized_rating, source: jsonData.rating_source }, 'Post-process applied rating');
    } else {
      logger.info({ source: jsonData.rating_source || 'None' }, 'Post-process no rating applied');
    }

    // Per-video subfolder precedence; see resolveFinalSubfolder for the full contract.
    channelSubFolder = downloadSettingsResolver.resolveFinalSubfolder({
      hardOverride: subfolderOverride,
      channelRecord: settingsChannelRecord,
      softFallback: subfolderFallbackEnv,
      globalDefault: configModule.getDefaultSubfolder(),
    });
    if (channelSubFolder) {
      const baseDir = configModule.directoryPath;
      targetChannelFolder = buildChannelPath(baseDir, channelSubFolder, actualChannelFolderName);
    }
    logger.info({ subfolder: channelSubFolder }, 'Post-process resolved target subfolder');

    // Phase 2: Calculate the final path for _actual_filepath with subfolder if applicable
    // Downloads always go to temp first, so we need to store the FINAL path, not the temp path
    let finalVideoPathForJson;

    if (targetChannelFolder) {
      // Channel has subfolder - calculate path with subfolder included
      const videoFileName = path.basename(videoPath);
      if (outgoingFlat) {
        finalVideoPathForJson = path.join(targetChannelFolder, videoFileName);
      } else {
        const videoDirectoryName = path.basename(videoDirectory);
        finalVideoPathForJson = path.join(targetChannelFolder, videoDirectoryName, videoFileName);
      }
    } else {
      // No subfolder - use standard temp-to-final conversion
      const standardFinalPath = tempPathManager.convertTempToFinal(videoPath);
      if (outgoingFlat && !isFlatMode) {
        // Incoming nested, outgoing flat: hoist the file out of its video folder
        finalVideoPathForJson = path.join(
          path.dirname(path.dirname(standardFinalPath)),
          path.basename(standardFinalPath)
        );
      } else {
        finalVideoPathForJson = standardFinalPath;
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

    // Embed iTunes-compatible metadata into the MP4 using AtomicParsley.
    // AtomicParsley writes directly to the iTunes atom container (moov.udta.meta.ilst)
    // which Plex reads for "Other Videos" / Personal Media libraries.
    // It modifies the file in-place (--overWrite), so no temp file dance is needed.
    // Skip for audio-only downloads (MP3 files)
    if (isAudioFile) {
      logger.info('[Post-Process] Audio file detected, skipping video metadata embedding');
    } else try {
      const apArgs = [videoPath];

      // Title (channel name + video title)
      const channelName = jsonData.uploader || jsonData.channel || jsonData.uploader_id || '';
      if (channelName && jsonData.title) {
        apArgs.push('--title', `${channelName} - ${jsonData.title}`);
      }

      // Genre from YouTube categories
      if (jsonData.categories && jsonData.categories.length > 0) {
        apArgs.push('--genre', jsonData.categories.join(';'));
      }

      // Channel name metadata
      if (channelName) {
        apArgs.push('--TVNetwork', channelName);
        apArgs.push('--copyright', channelName);  // Plex maps cprt atom → Studio
        apArgs.push('--artist', channelName);
        apArgs.push('--album', channelName);       // Plex maps album → Collection
      }

      // Tags as keywords
      if (jsonData.tags && jsonData.tags.length > 0) {
        apArgs.push('--keyword', jsonData.tags.slice(0, 10).join(';'));
      }

      // Add release date for Plex/mp4 embedded metadata
      // Good lord Plex is finicky
      if (jsonData.upload_date) {
        const year = jsonData.upload_date.substring(0, 4);
        const month = jsonData.upload_date.substring(4, 6);
        const day = jsonData.upload_date.substring(6, 8);
        const releaseDate = `${year}-${month}-${day}`;
        apArgs.push('--year', `${releaseDate}`);
      }

      // Description for Plex Summary
      if (jsonData.description) {
        apArgs.push('--description', jsonData.description.substring(0, 255));
        apArgs.push('--longdesc', jsonData.description);
      }

      // Media type (stik=9 → Movie, used by Plex for personal media)
      apArgs.push('--stik', 'Movie');

      // Content rating via iTunEXTC atom — this is what Plex actually reads
      const iTunEXTC = ratingMapper.mapToITunEXTC(jsonData.normalized_rating);
      if (iTunEXTC) {
        apArgs.push('--rDNSatom', iTunEXTC, 'name=iTunEXTC', 'domain=com.apple.iTunes');
      }

      apArgs.push('--overWrite');

      logger.info('Embedding metadata via AtomicParsley for Plex');
      const result = spawnSync(configModule.atomicParsleyPath, apArgs, {
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        const stderr = result.stderr ? result.stderr.toString() : 'Unknown error';
        throw new Error(`AtomicParsley exited with status ${result.status}: ${stderr}`);
      }

      logger.info('Successfully embedded metadata via AtomicParsley');
    } catch (err) {
      logger.warn({ err }, 'Could not embed metadata via AtomicParsley');
    }

    if (fs.existsSync(imagePath)) {
      // check if image thumbnail exists
      const newImageFullPath = path.join(newImagePath, `videothumb-${id}.jpg`); // define the new path for image thumbnail
      const newImageFullPathSmall = path.join(
        newImagePath,
        `videothumb-${id}-small.jpg`
      ); // define the new path for image thumbnail
      copySyncWithFallback(imagePath, newImageFullPath, { overwrite: true }); // copy the image thumbnail

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
      logger.info({ isFlatMode }, '[Post-Process] Moving files from temp to final location');

      // Calculate target video directory based on subfolder setting
      const videoDirectoryName = path.basename(videoDirectory);
      const videoFileName = path.basename(videoPath);
      let targetVideoDirectory;
      let targetChannelFolderForMove;

      if (targetChannelFolder) {
        targetVideoDirectory = outgoingFlat
          ? targetChannelFolder
          : path.join(targetChannelFolder, videoDirectoryName);
        targetChannelFolderForMove = targetChannelFolder;
        console.log(`[Post-Process] Moving to subfolder location: ${channelSubFolder}`);
      } else {
        // No subfolder - move to standard location
        const standardFinalPath = tempPathManager.convertTempToFinal(videoPath);
        // standardFinalPath mirrors the INCOMING temp layout; derive the
        // channel folder from that layout before applying the outgoing one.
        targetChannelFolderForMove = isFlatMode
          ? path.dirname(standardFinalPath)
          : path.dirname(path.dirname(standardFinalPath));
        targetVideoDirectory = outgoingFlat
          ? targetChannelFolderForMove
          : path.join(targetChannelFolderForMove, videoDirectoryName);
      }

      logger.info({ from: videoDirectory, to: targetVideoDirectory, isFlatMode }, '[Post-Process] Moving video directory');

      try {
        // Ensure parent channel directory exists (with retries for NFS/cross-filesystem transient errors)
        await ensureDirWithRetries(targetChannelFolderForMove, { retries: 5, delayMs: 500 });

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

        if (outgoingFlat) {
          // Flat mode: move individual files from temp channel folder to final channel folder
          // Filter by video ID to avoid moving files belonging to other downloads
          const allFilesInDir = await fs.readdir(videoDirectory);
          // Bracketed form [ID] is the yt-dlp default; dash form " - ID" is a fallback
          const updatedFilesInDir = allFilesInDir.filter(
            file => file.includes(`[${id}]`) || file.includes(` - ${id}`)
          );
          for (const file of updatedFilesInDir) {
            const srcPath = path.join(videoDirectory, file);
            const destPath = path.join(targetVideoDirectory, file);
            // Overwrite if the file already exists at destination
            if (await fs.pathExists(destPath)) {
              logger.warn({ destPath }, '[Post-Process] Target file already exists, overwriting');
              await fs.remove(destPath);
            }
            await moveWithRetries(srcPath, destPath, { retries: 5, delayMs: 500 });
            logger.info({ file }, '[Post-Process] Moved file (flat mode)');
          }

          // Update paths to reflect final locations
          finalVideoPath = path.join(targetVideoDirectory, videoFileName);

          logger.info({ targetVideoDirectory }, '[Post-Process] Successfully moved files to final location (flat mode)');
        } else {
          // Nested mode: move the entire video directory atomically

          // Check if target video directory already exists (rare, but handle gracefully)
          const targetExists = await fs.pathExists(targetVideoDirectory);

          if (targetExists) {
            logger.warn({ targetVideoDirectory }, '[Post-Process] Target directory already exists, removing before move');
            await fs.remove(targetVideoDirectory);
          }

          // Move the entire video directory from temp to final location (with retries for NFS/cross-filesystem transient errors)
          await moveWithRetries(videoDirectory, targetVideoDirectory, { retries: 5, delayMs: 500 });

          // Update paths to reflect final locations
          finalVideoPath = path.join(targetVideoDirectory, videoFileName);

          logger.info({ targetVideoDirectory }, '[Post-Process] Successfully moved to final location');
        }

        // Clean up empty parent directories in the temp path (e.g., empty channel folder)
        const tempBasePath = tempPathManager.getTempBasePath();
        const parentDir = (outgoingFlat && !isFlatMode)
          ? videoDirectory
          : (isFlatMode ? videoDirectory : path.dirname(videoDirectory));
        await cleanupEmptyParents(parentDir, tempBasePath);

        // Verify the final file exists
        if (!fs.existsSync(finalVideoPath)) {
          logger.error({ finalVideoPath }, '[Post-Process] Final video file doesn\'t exist after move');
          process.exit(1);
        }

      } catch (error) {
        logger.error({
          error: error.message,
          code: error.code,
          syscall: error.syscall,
          src: videoDirectory,
          dest: targetVideoDirectory
        }, '[Post-Process] ERROR during move operation (all retries exhausted)');
        logger.error({ videoDirectory }, '[Post-Process] Files remain in temp location');
        // Log filesystem diagnostics to help debug NFS/permission issues
        // Use async stat with timeout to avoid hanging on stale NFS mounts
        try {
          const parentDir = path.dirname(targetVideoDirectory);
          const statPromise = require('fs').promises.stat(parentDir);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('stat timed out')), 5000)
          );
          const parentStats = await Promise.race([statPromise, timeoutPromise]);
          logger.error({
            parentDir,
            mode: parentStats.mode.toString(8),
            uid: parentStats.uid,
            gid: parentStats.gid
          }, '[Post-Process] Target parent directory permissions');
        } catch (diagErr) {
          logger.error({ diagErr: diagErr.message }, '[Post-Process] Could not read target parent directory stats');
        }
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

    // Create fanart.jpg in video folder if enabled (for Plex background image on compatible clients)
    // This complements the poster.jpg (which comes from channel thumbnail)
    if (shouldWriteVideoFanart()) {
      try {
        const videoDir = path.dirname(finalVideoPath);
        const videoBaseName = path.parse(finalVideoPath).name; // filename without extension
        const finalImagePath = path.join(videoDir, `${videoBaseName}.jpg`);
        const fanartPath = path.join(videoDir, `${videoBaseName}-fanart.jpg`);

        // Copy the video thumbnail as fanart (if the thumbnail exists in the final location and -fanart doesn't already exist)
        if (fs.existsSync(finalImagePath) && !fs.existsSync(fanartPath)) {
          copySyncWithFallback(finalImagePath, fanartPath);
          logger.info({ fanartPath }, '[Post-Process] Created video fanart file');
        } else {
          logger.debug({ finalImagePath }, '[Post-Process] No image copied for fanart creation');
        }
      } catch (err) {
        logger.warn({ err }, '[Post-Process] Error creating video fanart');
        // Don't fail the process, but log the warning
      }
    }

    // Copy channel thumbnail as poster.jpg to channel folder (must be done AFTER all moves)
    // Calculate the final channel folder path based on the final video path
    // In flat mode, the file is directly in the channel folder
    const finalChannelFolderPath = outgoingFlat
      ? path.dirname(finalVideoPath)
      : path.dirname(path.dirname(finalVideoPath));
    if (jsonData.channel_id) {
      await copyChannelPosterIfNeeded(jsonData.channel_id, finalChannelFolderPath);
    }

    // Save to the videos + channelvideos tables now so listing pages can show
    // this video mid-batch. The end-of-batch save still runs; a failure here
    // must not fail the download.
    if (activeJobId) {
      try {
        const persisted = await videoPersistence.persistDownloadedVideoForJob({ jobId: activeJobId, youtubeId: id });
        if (persisted) {
          // Control marker, not a log line: stdout flows through yt-dlp to
          // YtdlpOutputRouter, which broadcasts videosUpdated to the listing pages.
          process.stdout.write(`${VIDEO_PERSISTED_MARKER}${id}\n`);
        }
      } catch (err) {
        logger.error({ err, id }, 'Error persisting downloaded video during post-processing');
      }
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
