const fs = require('fs-extra');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const configModule = require('./configModule');
const channelProfileModule = require('./channelProfileModule');
const nfoGeneratorModule = require('./nfoGeneratorModule');
const nfoGenerator = require('./nfoGenerator');
const { Channel, Video, VideoProfileMapping } = require('../models');

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
          `${configModule.ffmpegPath} -y -i "${channelThumbPath}" -vf "scale=iw*0.4:ih*0.4" "${tempPath}"`,
          { stdio: 'pipe' }
        );
        fs.renameSync(tempPath, channelThumbPath);
      }
    } catch (err) {
      console.log(`Error downloading channel thumbnail: ${err.message}`);
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
        console.log(`Channel poster.jpg created in ${channelFolderPath}`);
      }
    }
  } catch (err) {
    console.log(`Error copying channel poster: ${err.message}`);
  }
}

async function processVideo() {
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

  if (!fs.existsSync(jsonPath)) {
    console.log('No .info.json file found, skipping post-processing');
    return;
  }

  // Read the JSON file to get video metadata
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
        console.log(`Invalid upload_date format: ${jsonData.upload_date}`);
        uploadDate = null;
      }
    } catch (err) {
      console.log(`Error parsing upload_date: ${err.message}`);
      uploadDate = null;
    }
  }

  // Extract video ID
  const filename = path.basename(jsonPath, '.info.json');
  const matches = filename.match(/\[(.*?)\]/g);
  const id = matches
    ? matches[matches.length - 1].replace(/[[\]]/g, '')
    : 'default';

  try {
    // Check if this channel has series profiles configured
    const channel = await Channel.findOne({
      where: { channel_id: jsonData.channel_id }
    });

    if (channel) {
      // Check for series profiles
      const videoData = {
        title: jsonData.title,
        duration: jsonData.duration,
        description: jsonData.description,
        originalDate: jsonData.upload_date,
        youtubeId: id,
        youTubeChannelName: jsonData.uploader,
        youTubeVideoName: jsonData.title,
        channel_id: jsonData.channel_id
      };

      const matchedProfile = await channelProfileModule.evaluateVideoAgainstProfiles(
        videoData,
        channel.id
      );

      if (matchedProfile && matchedProfile.enabled) {

        // Store the original JSON in jobs directory FIRST
        storeOriginalJson(jsonPath, id);

        // Process with series organization
        await processWithSeriesProfile(
          videoPath,
          imagePath,
          jsonData,
          matchedProfile,
          uploadDate
        );

        return;
      }
    }

    // No profile matched or no profiles configured - use original processing
    console.log('No series profile matched, using default processing');
    await originalProcessing(
      videoPath,
      imagePath,
      jsonPath,
      id,
      uploadDate
    );

  } catch (error) {
    console.error('Error in series profile processing:', error);
    // Fallback to original processing
    await originalProcessing(
      videoPath,
      imagePath,
      jsonPath,
      id,
      uploadDate
    );
  }
}

async function processWithSeriesProfile(videoPath, imagePath, jsonData, profile, uploadDate) {
  try {
    // Get next episode number
    const episodeNumber = await channelProfileModule.getNextEpisodeNumber(profile.id);
    const seasonNumber = profile.is_default ? 0 : profile.season_number;

    // Get clean title - remove channel name if present
    let cleanTitle = channelProfileModule.getCleanTitle(
      jsonData.title,
      profile.filters
    );

    // Remove channel name from title if it appears at the beginning
    const channelName = jsonData.uploader;
    if (cleanTitle.toLowerCase().startsWith(channelName.toLowerCase())) {
      cleanTitle = cleanTitle.substring(channelName.length).replace(/^[-–—:\s]+/, '').trim();
    }

    // Parse date for template variables
    let year = '', month = '', day = '';
    if (jsonData.upload_date) {
      const dateStr = jsonData.upload_date.toString();
      year = dateStr.substring(0, 4);
      month = dateStr.substring(4, 6);
      day = dateStr.substring(6, 8);
    }

    // Apply naming template
    const templateData = {
      series: profile.series_name || profile.profile_name,
      season: seasonNumber,
      episode: episodeNumber,
      title: jsonData.title,
      clean_title: cleanTitle,
      year,
      month,
      day,
      channel: jsonData.uploader,
      id: jsonData.id
    };

    const newFilename = channelProfileModule.applyNamingTemplate(
      profile.naming_template,
      templateData
    );

    // Determine destination path
    // Use the channel folder that already exists from the video download
    const videoDirectory = path.dirname(videoPath);
    const channelFolder = path.dirname(videoDirectory); // Go up one level to channel folder

    // If custom destination is set, use that instead
    const basePath = profile.destination_path || channelFolder;

    // Create season folder inside the channel/base folder
    const seasonPath = path.join(
      basePath,
      `Season ${seasonNumber}`
    );

    // Ensure directories exist
    await fs.ensureDir(seasonPath);

    // Build new file paths
    const videoExt = path.extname(videoPath);
    const newVideoPath = path.join(seasonPath, `${newFilename}${videoExt}`);
    const newImagePath = path.join(seasonPath, `${newFilename}.jpg`);

    // Move/rename files
    console.log(`Moving video to: ${newVideoPath}`);
    await fs.move(videoPath, newVideoPath, { overwrite: true });

    if (fs.existsSync(imagePath)) {
      console.log(`Moving thumbnail to: ${newImagePath}`);
      await fs.move(imagePath, newImagePath, { overwrite: true });
    }

    // Set file permissions to be readable/writable by owner and group
    try {
      fs.chmodSync(newVideoPath, 0o664);  // rw-rw-r--
      if (fs.existsSync(newImagePath)) {
        fs.chmodSync(newImagePath, 0o664);
      }
      console.log('Set file permissions to 664');
    } catch (err) {
      console.log(`Error setting permissions: ${err.message}`);
    }

    // Set file timestamps
    if (uploadDate) {
      try {
        fs.utimesSync(newVideoPath, uploadDate, uploadDate);
        if (fs.existsSync(newImagePath)) {
          fs.utimesSync(newImagePath, uploadDate, uploadDate);
        }
        console.log(`Set timestamps to ${uploadDate.toISOString()}`);
      } catch (err) {
        console.log(`Error setting timestamps: ${err.message}`);
      }
    }

    // Generate NFO files if enabled
    if (profile.generate_nfo) {
      console.log('Generating NFO files...');
      await nfoGeneratorModule.createNFOFiles({
        videoPath: path.join(seasonPath, newFilename),
        seriesPath: basePath,  // Use the channel folder for the tvshow.nfo
        videoData: {
          title: cleanTitle,
          youTubeVideoName: jsonData.title,
          description: jsonData.description,
          originalDate: jsonData.upload_date,
          youtubeId: jsonData.id,
          youTubeChannelName: jsonData.uploader,
          channel_id: jsonData.channel_id
        },
        profileData: profile,
        season: seasonNumber,
        episode: episodeNumber
      });
    }

    // Clean up empty directories
    try {
      const oldDir = path.dirname(videoPath);
      const files = await fs.readdir(oldDir);

      // Filter out hidden files and system files
      const realFiles = files.filter(file =>
        !file.startsWith('.') &&
        file !== 'Thumbs.db' &&
        !file.endsWith('.info.json')
      );

      if (realFiles.length === 0) {
        // Remove the empty directory
        await fs.remove(oldDir);
        console.log(`Removed empty directory: ${oldDir}`);
      }
    } catch (err) {
      // Silent fail - directory might already be removed or inaccessible
    }

    // Record the mapping in database
    try {
      const video = await Video.findOne({
        where: { youtubeId: jsonData.id }
      });

      if (video) {
        await VideoProfileMapping.create({
          video_id: video.id,
          profile_id: profile.id,
          season: seasonNumber,
          episode: episodeNumber
        });
      }
    } catch (err) {
      console.log(`Error recording video mapping: ${err.message}`);
    }

    // Increment episode counter
    await channelProfileModule.incrementEpisodeCounter(profile.id);

    console.log(`Successfully processed video with series profile: ${profile.profile_name}`);

  } catch (error) {
    console.error('Error in series processing:', error);
    throw error;
  }
}

async function originalProcessing(videoPath, imagePath, jsonPath, id, uploadDate, jsonData) {
  const videoDirectory = path.dirname(videoPath);
  const directoryPath = path.join(configModule.getJobsPath(), 'info');
  const newImagePath = configModule.getImagePath();

  fs.ensureDirSync(directoryPath);
  const newJsonPath = path.join(directoryPath, `${id}.info.json`);

  fs.moveSync(jsonPath, newJsonPath, { overwrite: true });

  // Generate NFO file for Jellyfin/Kodi/Emby compatibility if enabled
  console.log(`Should write video NFO files: ${shouldWriteVideoNfoFiles()}`);
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
    const channelName = jsonData.uploader || jsonData.channel || '';
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

    // Add media type hint for Plex (9 = Home Video)
    ffmpegArgs.push('-metadata', 'media_type=9');

    // Output file
    ffmpegArgs.push('-y', tempPath);

    console.log('Adding additional metadata for Plex...');
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
    if (fs.existsSync(tempPath)) {
      const tempStats = fs.statSync(tempPath);
      const origStats = fs.statSync(videoPath);

      // Basic sanity check
      if (tempStats.size >= origStats.size * 0.9) {
        fs.renameSync(tempPath, videoPath);
        console.log('Successfully added additional metadata to video file');
      } else {
        fs.unlinkSync(tempPath);
        console.log('Skipped metadata update due to file size mismatch');
      }
    }
  } catch (err) {
    console.log(`Note: Could not add additional metadata: ${err.message}`);
    // Clean up temp file if exists
    const tempPath = videoPath + '.metadata_temp.mp4';
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (e) {
        console.log(`Error deleting temp file: ${e.message}`);
      }
    }
  }

  // Channel folder is one level up from videoDirectory
  const channelFolderPath = path.dirname(videoDirectory);

  // Copy channel thumbnail as poster.jpg to channel folder if needed
  if (jsonData.channel_id) {
    await copyChannelPosterIfNeeded(jsonData.channel_id, channelFolderPath);
  }

  if (fs.existsSync(imagePath)) {
    const newImageFullPath = path.join(newImagePath, `videothumb-${id}.jpg`);
    const newImageFullPathSmall = path.join(
      newImagePath,
      `videothumb-${id}-small.jpg`
    );
    fs.copySync(imagePath, newImageFullPath, { overwrite: true });

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

  // Set file permissions to be readable/writable by owner and group
  try {
    if (fs.existsSync(videoPath)) {
      fs.chmodSync(videoPath, 0o664);  // rw-rw-r--
    }
    if (fs.existsSync(imagePath)) {
      fs.chmodSync(imagePath, 0o664);
    }
    console.log('Set file permissions to 664');
  } catch (err) {
    console.log(`Error setting permissions: ${err.message}`);
  }

  // Set the file timestamps to match the upload date
  if (uploadDate) {
    if (fs.existsSync(videoPath)) {
      try {
        fs.utimesSync(videoPath, uploadDate, uploadDate);
        console.log(`Set video timestamp to ${uploadDate.toISOString()}`);
      } catch (err) {
        console.log(`Error setting video timestamp: ${err.message}`);
      }
    }

    if (fs.existsSync(imagePath)) {
      try {
        fs.utimesSync(imagePath, uploadDate, uploadDate);
        console.log(`Set thumbnail timestamp to ${uploadDate.toISOString()}`);
      } catch (err) {
        console.log(`Error setting thumbnail timestamp: ${err.message}`);
      }
    }

    if (fs.existsSync(videoDirectory)) {
      try {
        fs.utimesSync(videoDirectory, uploadDate, uploadDate);
        console.log(`Set directory timestamp to ${uploadDate.toISOString()}`);
      } catch (err) {
        console.log(`Error setting directory timestamp: ${err.message}`);
      }
    }
  }
}

function storeOriginalJson(jsonPath, id) {
  try {
    const directoryPath = path.join(configModule.getJobsPath(), 'info');
    fs.ensureDirSync(directoryPath);
    const newJsonPath = path.join(directoryPath, `${id}.info.json`);
    fs.moveSync(jsonPath, newJsonPath, { overwrite: true });
    console.log(`Stored original JSON: ${newJsonPath}`);
  } catch (error) {
    console.error('Error storing original JSON:', error);
  }
}

// Run the async processing
processVideo()
  .then(() => {
    console.log('Post-processing complete');
    configModule.stopWatchingConfig();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error in post-processing:', error);
    configModule.stopWatchingConfig();
    process.exit(1);
  });