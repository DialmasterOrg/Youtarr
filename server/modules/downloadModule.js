const configModule = require('./configModule');
const plexModule = require('./plexModule');
const jobModule = require('./jobModule');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process'); // import spawn
const MessageEmitter = require('./messageEmitter.js'); // import the helper function

// Use proper yt-dlp fallback syntax with comma separator
// Will use uploader, fall back to channel, then uploader_id
// The @ prefix from uploader_id will be handled by --replace-in-metadata
const CHANNEL_TEMPLATE = '%(uploader,channel,uploader_id)s';
const VIDEO_FOLDER_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s - %(id)s`;
const VIDEO_FILE_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s  [%(id)s].%(ext)s`;

// Progress monitoring class for detecting stalled downloads
class DownloadProgressMonitor {
  constructor(jobId, jobType = '') {
    this.jobId = jobId;
    this.jobType = jobType;
    this.lastUpdateTimestamp = Date.now();
    this.lastPercent = 0;
    this.lastParsed = null;
    this.stallRaised = false;
    this.currentState = 'initiating';
    this.lastVideoInfo = null;
    this.lastEmittedState = null;
    this.videoCount = {
      current: 1, // The first video is #1...
      total: 0,
      completed: 0,
      skipped: 0,
      skippedThisChannel: 0
    };
    this.isChannelDownload = jobType === 'Channel Downloads';
    this.currentChannelName = '';
    this.currentVideoCompleted = false; // Track if current video is done
  }

  normalizeChannelName(name) {
    if (!name) {
      return '';
    }
    const trimmed = String(name).trim();
    if (!trimmed) {
      return '';
    }
    const upper = trimmed.toUpperCase();
    if (upper === 'NA' || upper === 'N/A') {
      return '';
    }
    return trimmed;
  }

  parseProgressJson(line) {
    // yt-dlp progress template produces clean JSON strings
    try {
      const parsed = JSON.parse(line);
      if (!parsed.percent) {
        return null;
      }

      const percent = Number(parsed.percent.replace('%', '').trim());
      const downloaded = Number(parsed.downloaded) || 0;
      const total = Number(parsed.total) || 0;
      const speed = Number(parsed.speed) || 0;

      return {
        percent,
        downloaded,
        total,
        speed,
        etaSeconds: Number(parsed.eta) || 0,
        timestamp: Date.now()
      };
    } catch (err) {
      return null;
    }
  }

  isStalled(progress, config) {
    if (!config.enableStallDetection) {
      return false;
    }

    // Convert thresholds from strings like "100K" into bytes per second
    const thresholdBytes = this.parseByteRate(config.stallDetectionRateThreshold);
    const throttledBytes = this.parseByteRate(config.downloadThrottledRate);
    const effectiveThreshold = Math.min(thresholdBytes, throttledBytes);

    const speedBytes = progress.speed;
    const percentAdvanced = progress.percent > this.lastPercent + 0.1;

    if (percentAdvanced || speedBytes === 0) {
      this.lastUpdateTimestamp = progress.timestamp;
      if (percentAdvanced) {
        this.lastPercent = progress.percent;
      }
      this.stallRaised = false;
      return false;
    }

    const secondsSinceLastUsefulUpdate =
      (progress.timestamp - this.lastUpdateTimestamp) / 1000;

    return (
      speedBytes > 0 &&
      speedBytes < effectiveThreshold &&
      secondsSinceLastUsefulUpdate >= config.stallDetectionWindowSeconds
    );
  }

  parseByteRate(rateString) {
    const match = /^(\d+(?:\.\d+)?)([KMG]?i?B?)$/i.exec(rateString.trim());
    if (!match) {
      return Number(rateString) || 0;
    }
    const value = Number(match[1]);
    const unit = match[2].toUpperCase();
    const unitMap = {
      B: 1,
      K: 1000,
      KB: 1000,
      KIB: 1024,
      M: 1000 ** 2,
      MB: 1000 ** 2,
      MIB: 1024 ** 2,
      G: 1000 ** 3,
      GB: 1000 ** 3,
      GIB: 1024 ** 3
    };
    return value * (unitMap[unit] || 1);
  }

  resetProgressTracking() {
    this.lastPercent = 0;
    this.lastUpdateTimestamp = Date.now();
    this.stallRaised = false;
  }

  snapshot(stateOverride, videoInfoOverride) {
    const state = stateOverride || this.currentState || 'initiating';
    const baseProgress = this.lastParsed && this.lastParsed.progress
      ? { ...this.lastParsed.progress }
      : {
        percent: state === 'complete' ? 100 : 0,
        downloadedBytes: 0,
        totalBytes: 0,
        speedBytesPerSecond: 0,
        etaSeconds: 0
      };

    if (state === 'complete') {
      baseProgress.percent = baseProgress.percent >= 100 ? baseProgress.percent : 100;
      if (baseProgress.totalBytes && baseProgress.downloadedBytes < baseProgress.totalBytes) {
        baseProgress.downloadedBytes = baseProgress.totalBytes;
      }
      baseProgress.speedBytesPerSecond = 0;
      baseProgress.etaSeconds = 0;
    }

    const videoInfo = videoInfoOverride || this.lastParsed?.videoInfo || this.lastVideoInfo || {
      channel: '',
      title: '',
      displayTitle: ''
    };

    const payload = {
      jobId: this.jobId,
      progress: baseProgress,
      stalled: state === 'stalled',
      state,
      videoInfo,
      videoCount: { ...this.videoCount },
      downloadType: this.jobType,
      currentChannelName: this.currentChannelName
    };

    this.currentState = state;
    this.lastParsed = payload;
    this.lastEmittedState = state;
    this.lastVideoInfo = videoInfo;
    this.stallRaised = state === 'stalled';

    return payload;
  }

  extractVideoInfo(line) {
    if (!line.includes('[download] Destination:')) {
      return this.lastVideoInfo;
    }

    const fullPath = line.split('Destination:')[1].trim();
    const filename = fullPath.split(/[\\/]/).pop() || '';

    const stripExtension = (name) => {
      if (!name) return '';
      let result = name;
      result = result.replace(/\.f\d+\.[^.]+$/, '');
      result = result.replace(/\.[^.]+$/, '');
      return result;
    };

    const stripIdSuffix = (name) => name.replace(/\s+\[[^\]]+\]$/, '');

    const baseNameWithId = stripExtension(filename);
    const baseName = stripIdSuffix(baseNameWithId).trim();

    const parts = baseName.split(' - ');
    const channelFromFile = parts.length > 1 ? parts[0].trim() : '';
    const normalizedChannel = this.normalizeChannelName(channelFromFile);
    const rawTitle = parts.length > 1 ? parts.slice(1).join(' - ').trim() : baseName;

    const title = rawTitle || 'Unknown Title';
    const displayTitle = title.length > 60
      ? `${title.substring(0, 57)}...`
      : title;

    this.lastVideoInfo = {
      channel: normalizedChannel || this.lastVideoInfo?.channel || this.lastParsed?.videoInfo?.channel || '',
      title,
      displayTitle
    };

    // Track current channel name for channel downloads
    if (this.lastVideoInfo.channel) {
      this.currentChannelName = this.lastVideoInfo.channel;
    }

    return this.lastVideoInfo;
  }

  determineState(line) {
    // Detect download type from file extension
    if (line.includes('[download] Destination:')) {
      const path = line.split('Destination:')[1].trim();
      if (path.match(/\.f\d+\.mp4$/)) return 'downloading_video';
      if (path.match(/\.f\d+\.m4a$/)) return 'downloading_audio';
      if (path.includes('poster') || path.includes('thumbnail')) return 'downloading_thumbnail';
    }

    // Detect processing stages
    if (line.includes('[Merger]')) return 'merging';
    if (line.includes('[Metadata]')) return 'metadata';
    if (line.includes('[MoveFiles]')) return 'processing';
    if (line.includes('Completed:')) return 'complete';
    if (line.includes('ERROR:')) return 'error';

    return null;
  }

  /**
   * Parse the lines from yt-dlp and update counts of videos downloaded, skipped, and total.
   * Uses different logic for channel downloads vs manual URLs vs other downloads.
   * Returns early at each check.
   *
   * This directly updates the videoCount object.
   *
   * @param {string} line
   * @returns {boolean} True if the line was processed, false otherwise.
   */
  parseAndUpdateVideoCounts(line) {

    // First detect if the channel name has changed. If so and we are in a channel download, reset the counts.
    // If it's not a channel download, just update the current channel name.
    const metadataMatch = line.match(/\[download\] Downloading playlist:\s*(.+?)\s*-\s*Videos/);
    if (metadataMatch) {
      const newChannelName = metadataMatch[1].trim();

      // Reset current video count when starting a new channel BUT ONLY IN CHANNEL DOWNLOADS
      if (this.isChannelDownload) {
        if (this.currentChannelName && this.currentChannelName !== newChannelName) {
          console.log(`Starting new channel: ${newChannelName}, resetting counts`);
          this.videoCount.current = 1;
          this.videoCount.skippedThisChannel = 0;
          this.currentVideoCompleted = false;
        }
      }

      this.currentChannelName = newChannelName;
      return true;
    }

    // Parse initial playlist info: "[youtube:tab] Playlist <name>: Downloading X items"
    // This only matches on channel downloads
    // It is used to reset the counts when starting a new channel.
    const playlistInitMatch = line.match(/\[youtube:tab\] Playlist (.+): Downloading (\d+) items/);
    if (playlistInitMatch) {
      // Extract channel name from playlist name (usually format: "ChannelName - Videos")
      const playlistName = playlistInitMatch[1];
      const channelMatch = playlistName.match(/^(.+?)\s*-\s*Videos?$/i);
      const newChannelName = channelMatch
        ? channelMatch[1].trim()
        : playlistName.split(' - ')[0].trim();

      // Reset current video count when startng a new channel
      if (this.currentChannelName && this.currentChannelName !== newChannelName) {
        console.log(`Starting new channel: ${newChannelName}, resetting all counts`);
        // These don't reset because they are tracking the FULL TOTALS for this job
        // this.videoCount.completed = 0;
        this.videoCount.skippedThisChannel = 0;
        this.videoCount.current = 1; // The first video is #1...
        this.currentVideoCompleted = false;
      }

      this.currentChannelName = newChannelName;
      this.videoCount.total = parseInt(playlistInitMatch[2], 10);
      return true;
    }

    // Check if item was skipped (already in archive or does not pass filter (subscribers only))
    // If so, increment the skipped count for the current channel AND the total skipped count.
    if (line.includes('has already been recorded in the archive') || line.includes('does not pass filter')) {
      console.log(`Already in archive or does not pass filter and currentVideoCompleted is ${this.currentVideoCompleted} and videoCount.current is ${this.videoCount.current}`);
      // Only increment skipped once per video
      if (!this.currentVideoCompleted) {
        this.videoCount.skipped++;
        this.videoCount.skippedThisChannel++;
        // Increment the current count when it's not the first video
        if (this.videoCount.completed > 0) {
          this.videoCount.current++;
        }
        // this.currentVideoCompleted = true; // Mark as "completed" so we don't count it again
        console.log(`Video ${this.videoCount.current} was skipped (already archived). Total skipped: ${this.videoCount.skipped}`);
      }
      return true;
    }


    // Parse current item: "[download] Downloading item N of Y"
    // Note: yt-dlp already accounts for skipped items in N, so we use it directly
    // This only matches on channel downloads
    const itemMatch = line.match(/\[download\] Downloading item (\d+) of (\d+)/);
    if (itemMatch) {
      console.log(`Downloading item ${itemMatch[1]} of ${itemMatch[2]}`);
      const newCurrent = parseInt(itemMatch[1], 10);
      this.videoCount.total = parseInt(itemMatch[2], 10);

      // Starting a new item, reset completion flag
      this.currentVideoCompleted = false;
      this.videoCount.current = newCurrent;
      this.resetProgressTracking();
      console.log(`Starting download of item ${newCurrent} of ${this.videoCount.total}`);
      return true;
    }

    // Track individual video extractions for manual URLs
    if (line.includes('[youtube] Extracting URL:') && !line.includes('[youtube:tab]')) {
      if (this.jobType === 'Manually Added Urls') {
        // Starting a new video, reset completion flag
        this.currentVideoCompleted = false;
        // If this is the first URL, set total if not already set
        if (this.videoCount.total === 0) {
          this.videoCount.total = 1;
        }
        if (this.videoCount.completed > 0) {
          this.videoCount.current++;
        }
        this.resetProgressTracking();
      } else if (this.videoCount.total === 0) {
        // Single video download (not manual URLs)
        this.videoCount.current = 1;
        this.videoCount.total = 1;
        this.currentVideoCompleted = false;
        this.resetProgressTracking();
      }
      return true;
    }

    // Track final completion of current video (actual download)
    // A video is complete when we see various completion indicators
    const completionIndicators = [
      '[download] 100%',
      '[Merger] Merging formats into',
      '[MoveFiles] Moving file',
      '[Metadata] Adding metadata to',
      'Deleting original file'  // When yt-dlp cleans up after merging
    ];

    const isCompleted = completionIndicators.some(indicator => line.includes(indicator));

    if (isCompleted) {
      console.log(`Completed indicator found: ${line}`);
      // Only increment completed once per video and after the first video
      if (!this.currentVideoCompleted) {
        console.log(`Incrementing completed from from ${this.videoCount.completed} to ${this.videoCount.completed + 1}`);
        this.videoCount.completed++;
        this.currentVideoCompleted = true;
        console.log(`Video ${this.videoCount.current} downloaded successfully. Total completed: ${this.videoCount.completed}`);
      }
      return true;
    }

    return false;
  }

  processProgress(line, rawLine, config) {
    const parsed = this.parseProgressJson(line);

    const newState = this.determineState(rawLine);
    if (newState) {
      this.currentState = newState;
    }

    // Parse video count information and update counts.
    this.parseAndUpdateVideoCounts(rawLine);

    // Extract video info if available
    const videoInfo = this.extractVideoInfo(rawLine);

    const videoInfoChanged = !!videoInfo && (
      !this.lastParsed?.videoInfo ||
      videoInfo.displayTitle !== this.lastParsed.videoInfo.displayTitle
    );
    const shouldEmitInitial = !this.lastParsed;
    const stateChanged = !!newState && newState !== this.lastEmittedState;

    if (!parsed) {
      if (shouldEmitInitial || stateChanged || videoInfoChanged) {
        return this.snapshot(this.currentState, videoInfo || undefined);
      }
      return null;
    }

    const stalled = this.isStalled(parsed, config);

    const structuredPayload = {
      jobId: this.jobId,
      progress: {
        percent: parsed.percent,
        downloadedBytes: parsed.downloaded,
        totalBytes: parsed.total,
        speedBytesPerSecond: parsed.speed,
        etaSeconds: parsed.etaSeconds
      },
      stalled,
      state: stalled ? 'stalled' : this.currentState,
      videoInfo: videoInfo || this.lastParsed?.videoInfo || this.lastVideoInfo || {
        channel: '',
        title: '',
        displayTitle: ''
      },
      videoCount: { ...this.videoCount },
      downloadType: this.jobType,
      currentChannelName: this.currentChannelName
    };

    this.lastParsed = structuredPayload;
    this.lastEmittedState = structuredPayload.state;
    this.lastVideoInfo = structuredPayload.videoInfo;
    this.stallRaised = stalled;

    return structuredPayload;
  }

}

class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  getCountOfDownloadedVideos() {
    const archive = require('./archiveModule');
    return archive.readCompleteListLines().length;
  }

  getNewVideoUrls(initialCount) {
    const archive = require('./archiveModule');
    return archive.getNewVideoUrlsSince(initialCount);
  }

  async doDownload(args, jobId, jobType, urlCount = 0) {
    const initialCount = this.getCountOfDownloadedVideos();
    const config = configModule.getConfig();
    const monitor = new DownloadProgressMonitor(jobId, jobType);

    // For manual URL downloads, set the total count upfront
    if (jobType === 'Manually Added Urls' && urlCount > 0) {
      monitor.videoCount.total = urlCount;
    }

    // Calculate process timeout based on configuration
    const processTimeoutMs = Math.max(
      config.downloadSocketTimeoutSeconds * 1000 * (config.downloadRetryCount + 1),
      5 * 60 * 1000
    );

    return new Promise((resolve, reject) => {
      console.log('Setting timeout for ending job');
      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Download timeout exceeded'));
      }, processTimeoutMs);

      console.log(`Running yt-dlp for ${jobType}`);
      console.log('Command args:', args);
      const proc = spawn('yt-dlp', args);

      const partialDestinations = new Set();

      // Emit initial state so the UI reflects the job start immediately
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        {
          text: 'Initiating download...',
          progress: monitor.snapshot('initiating'),
          clearPreviousSummary: true
        }
      );

      proc.stdout.on('data', (chunk) => {
        chunk
          .toString()
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .forEach((line) => {
            console.log(line); // log the data in real-time

            // Track destination files for cleanup
            if (line.startsWith('[download] Destination:')) {
              const destPath = line.replace('[download] Destination:', '').trim();
              if (destPath) {
                partialDestinations.add(destPath);
              }
            }

            // Always try to process for state updates
            let structuredProgress = monitor.processProgress('{}', line, config);

            // Parse JSON progress if available
            const jsonStart = line.indexOf('{');
            if (jsonStart !== -1) {
              const jsonPortion = line.slice(jsonStart);
              const jsonProgress = monitor.processProgress(jsonPortion, line, config);
              if (jsonProgress) {
                structuredProgress = jsonProgress;
              }
            }

            MessageEmitter.emitMessage(
              'broadcast',
              null,
              'download',
              'downloadProgress',
              {
                text: line,
                progress: structuredProgress || monitor.lastParsed || null,
              }
            );
          });
      });

      let stderrBuffer = '';
      proc.stderr.on('data', (data) => {
        stderrBuffer += data.toString();
        console.log(data.toString()); // log the data in real-time
      });

      proc.on('exit', async (code, signal) => {
        clearTimeout(timer);
        const newVideoUrls = this.getNewVideoUrls(initialCount);
        const videoCount = newVideoUrls.length;

        let videoData = newVideoUrls
          .map((url) => {
            let id = url.split('youtu.be/')[1].trim();
            let dataPath = path.join(
              configModule.getJobsPath(),
              `info/${id}.info.json`
            );
            console.log('Looking for info.json file at', dataPath);

            if (fs.existsSync(dataPath)) {
              console.log('Found info.json file at', dataPath);
              let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
              const normalizeChannelName = (value) => {
                if (!value) return '';
                const trimmed = String(value).trim();
                if (!trimmed) return '';
                const upper = trimmed.toUpperCase();
                if (upper === 'NA' || upper === 'N/A') {
                  return '';
                }
                return trimmed;
              };

              const preferredChannelName =
                normalizeChannelName(data.uploader) ||
                normalizeChannelName(data.channel) ||
                normalizeChannelName(data.uploader_id) ||
                normalizeChannelName(data.channel_id) ||
                'Unknown Channel';
              return {
                youtubeId: data.id,
                youTubeChannelName: preferredChannelName,
                youTubeVideoName: data.title,
                duration: data.duration,
                description: data.description,
                originalDate: data.upload_date,
                channel_id: data.channel_id,
              };
            } else {
              console.log('No info.json file at', dataPath);
            }
            return null; // If for some reason .info.json file is not found, return null
          })
          .filter((data) => data !== null); // Filter out any null values

        console.log(
          `${jobType} complete (with or without errors) for Job ID: ${jobId}`
        );

        let status = '';
        let output = '';

        if (code !== 0) {
          // Cleanup partial files on failure
          await this.cleanupPartialFiles(Array.from(partialDestinations));

          const failureDetails = monitor.lastParsed || null;

          status = signal === 'SIGKILL' ? 'Killed' : 'Error';
          output = `${videoCount} videos. Error: Command exited with code ${code}`;

          // Add stall detection note if applicable
          const notes = failureDetails && failureDetails.stalled
            ? `Stall detected at ${failureDetails.progress.percent.toFixed(1)}% (${Math.round(
              failureDetails.progress.speedBytesPerSecond / 1024
            )} KiB/s)`
            : `Download failed (${signal || `exit ${code}`})`;

          await jobModule.updateJob(jobId, {
            status: status,
            endDate: Date.now(),
            output: output,
            data: { videos: videoData || [] },
            notes: notes,
          });
        } else if (stderrBuffer) {
          status = 'Complete with Warnings';
          output = `${videoCount} videos.`;
          jobModule.updateJob(jobId, {
            status: status,
            output: output,
            data: { videos: videoData },
          });
        } else {
          status = 'Complete';
          output = `${videoCount} videos.`;
          jobModule.updateJob(jobId, {
            status: status,
            output: output,
            data: { videos: videoData },
          });
        }

        const finalState = code === 0 ? 'complete' : 'error';

        // Create a more informative final message
        let finalText;
        if (finalState === 'complete') {
          const actualCount = monitor.videoCount.completed || videoCount;
          const skippedCount = monitor.videoCount.skipped || 0;
          if (actualCount > 0 && skippedCount > 0) {
            finalText = `Download completed: ${actualCount} new video${actualCount !== 1 ? 's' : ''} downloaded, ${skippedCount} already existed`;
          } else if (actualCount > 0) {
            finalText = `Download completed: ${actualCount} new video${actualCount !== 1 ? 's' : ''} downloaded`;
          } else if (skippedCount > 0) {
            finalText = `Download completed: All ${skippedCount} video${skippedCount !== 1 ? 's' : ''} already existed`;
          } else {
            finalText = 'Download completed: No new videos to download';
          }
        } else {
          finalText = 'Download failed';
        }

        // Make sure final counts are accurate
        if (monitor.videoCount.completed === 0 && videoCount > 0 && finalState === 'complete') {
          monitor.videoCount.completed = videoCount;
        }

        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          {
            text: finalText,
            progress: monitor.snapshot(finalState),
            finalSummary: {
              totalDownloaded: monitor.videoCount.completed || videoCount,
              totalSkipped: monitor.videoCount.skipped || 0,
              jobType: jobType,
              completedAt: new Date().toISOString()
            }
          }
        );

        // Clean up temporary channels file if it exists
        if (this.tempChannelsFile) {
          const fs = require('fs').promises;
          fs.unlink(this.tempChannelsFile)
            .then(() => {
              console.log('Cleaned up temporary channels file');
              this.tempChannelsFile = null;
            })
            .catch((err) => {
              console.log('Failed to clean up temp channels file:', err.message);
            });
        }

        plexModule.refreshLibrary().catch(err => {
          console.log('Failed to refresh Plex library:', err.message);
        });
        jobModule.startNextJob();
        resolve();
      });

      proc.on('error', async (err) => {
        clearTimeout(timer);
        await this.cleanupPartialFiles(Array.from(partialDestinations));
        reject(err);
      });
    }).catch((error) => {
      console.log(error.message);

      // Clean up temporary channels file on error
      if (this.tempChannelsFile) {
        const fs = require('fs').promises;
        fs.unlink(this.tempChannelsFile)
          .catch((err) => {
            console.log('Failed to clean up temp channels file:', err.message);
          });
        this.tempChannelsFile = null;
      }

      jobModule.updateJob(jobId, {
        status: 'Killed',
        output: 'Job time exceeded timeout',
      });
    });
  }

  // Cleanup function for partial files
  async cleanupPartialFiles(files) {
    const fsPromises = require('fs').promises;

    for (const file of files) {
      try {
        // Check for partial files
        const partFile = file + '.part';

        // Remove .part file
        if (await fsPromises.access(partFile).then(() => true).catch(() => false)) {
          await fsPromises.unlink(partFile);
          console.log(`Cleaned up partial file: ${partFile}`);
        }

        // Remove fragment files
        const dir = path.dirname(file);
        const dirFiles = await fsPromises.readdir(dir);
        const basename = path.basename(file).replace(/\.[^.]+$/, '');

        for (const f of dirFiles) {
          if (f.startsWith(basename + '.f')) {
            await fsPromises.unlink(path.join(dir, f));
            console.log(`Cleaned up fragment: ${f}`);
          }
        }
      } catch (error) {
        console.error(`Error cleaning up ${file}:`, error);
      }
    }
  }

  async doChannelDownloads(jobData = {}, isNextJob = false) {
    const jobType = 'Channel Downloads';
    console.log(`Running ${jobType}`);

    const jobId = await jobModule.addOrUpdateJob(
      {
        jobType: jobType,
        status: '',
        output: '',
        id: jobData.id ? jobData.id : '',
        data: jobData,
        action: this.doChannelDownloads.bind(this),
      },
      isNextJob
    );

    if (jobModule.getJob(jobId).status === 'In Progress') {
      let tempChannelsFile = null;
      try {
        // Generate temporary channels file from database
        const channelModule = require('./channelModule');
        tempChannelsFile = await channelModule.generateChannelsFile();

        // Use override settings if provided, otherwise use defaults
        const overrideSettings = jobData.overrideSettings || {};
        const resolution = overrideSettings.resolution || configModule.config.preferredResolution || '1080';
        const videoCount = overrideSettings.videoCount || configModule.config.channelFilesToDownload;

        const args = this.getBaseCommandArgs(resolution);
        args.push('-a', tempChannelsFile);
        args.push('--playlist-end', String(videoCount));

        // Store temp file path for cleanup later
        this.tempChannelsFile = tempChannelsFile;

        this.doDownload(args, jobId, jobType);
      } catch (err) {
        console.error('Error in doChannelDownloads:', err);
        if (tempChannelsFile) {
          // Clean up temp file on error
          const fs = require('fs').promises;
          try {
            await fs.unlink(tempChannelsFile);
          } catch (unlinkErr) {
            // Ignore cleanup errors
          }
        }
        await jobModule.updateJob(jobId, {
          status: 'Failed',
          output: `Error: ${err.message}`,
        });
      }
    }
  }

  async doSpecificDownloads(reqOrJobData, isNextJob = false) {
    const jobType = 'Manually Added Urls';
    const jobData = reqOrJobData.body ? reqOrJobData.body : reqOrJobData;

    console.log(
      'Running doSpecificDownloads and jobData: ',
      JSON.stringify(jobData)
    );

    const urls = reqOrJobData.body
      ? reqOrJobData.body.urls
      : reqOrJobData.data.urls;
    const jobId = await jobModule.addOrUpdateJob(
      {
        jobType: jobType,
        status: '',
        output: '',
        id: jobData.id ? jobData.id : '',
        data: jobData,
        action: this.doSpecificDownloads.bind(this),
      },
      isNextJob
    );

    if (jobModule.getJob(jobId).status === 'In Progress') {
      // Use override settings if provided, otherwise use defaults
      const overrideSettings = jobData.overrideSettings || {};
      const resolution = overrideSettings.resolution || configModule.config.preferredResolution || '1080';

      // For manual downloads, we don't apply duration filters but still exclude members-only
      const args = this.getBaseCommandArgsForManualDownload(resolution);

      // Add URLs to args array
      urls.forEach((url) => {
        if (url.startsWith('-')) {
          args.push('--', url);
        } else {
          args.push(url);
        }
      });

      // Pass URL count as additional parameter for manual downloads
      this.doDownload(args, jobId, jobType, urls.length);
    }
  }

  // Build Sponsorblock args based on configuration
  buildSponsorblockArgs(config) {
    const args = [];

    if (!config.sponsorblockEnabled) return args;

    // Build categories list from enabled categories
    const enabledCategories = Object.entries(config.sponsorblockCategories || {})
      .filter(([, enabled]) => enabled)
      .map(([category]) => category);

    if (enabledCategories.length > 0) {
      const categoriesStr = enabledCategories.join(',');

      if (config.sponsorblockAction === 'remove') {
        args.push('--sponsorblock-remove', categoriesStr);
      } else if (config.sponsorblockAction === 'mark') {
        args.push('--sponsorblock-mark', categoriesStr);
      }
    }

    // Add custom API URL if specified
    if (config.sponsorblockApiUrl && config.sponsorblockApiUrl.trim()) {
      args.push('--sponsorblock-api', config.sponsorblockApiUrl.trim());
    }

    return args;
  }

  // Build yt-dlp command args array for channel downloads
  getBaseCommandArgs(resolution) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const baseOutputPath = configModule.directoryPath;
    const args = [
      '-4',
      '--ffmpeg-location', configModule.ffmpegPath,
      '--socket-timeout', String(config.downloadSocketTimeoutSeconds || 30),
      '--throttled-rate', config.downloadThrottledRate || '100K',
      '--retries', String(config.downloadRetryCount || 2),
      '--fragment-retries', String(config.downloadRetryCount || 2),
      '--newline',
      '--progress',
      '--progress-template',
      '{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes|0)s","total":"%(progress.total_bytes|0)s","speed":"%(progress.speed|0)s","eta":"%(progress.eta|0)s"}',
      '--output-na-placeholder', 'Unknown Channel',
      // Clean @ prefix from uploader_id when it's used as fallback
      '--replace-in-metadata', 'uploader_id', '^@', '',
      '-f', `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--download-archive', './config/complete.list',
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'duration>70 & availability!=subscriber_only',
      '-o', `${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/${VIDEO_FILE_TEMPLATE}`,
      '--datebefore', 'now',
      '-o', `thumbnail:${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, './videoDownloadPostProcessFiles.js')} {}`
    ];

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(configModule.config);
    args.push(...sponsorblockArgs);

    return args;
  }

  // Build yt-dlp command args array for manual downloads - no duration filter
  getBaseCommandArgsForManualDownload(resolution) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const baseOutputPath = configModule.directoryPath;
    const args = [
      '-4',
      '--ffmpeg-location', configModule.ffmpegPath,
      '--socket-timeout', String(config.downloadSocketTimeoutSeconds || 30),
      '--throttled-rate', config.downloadThrottledRate || '100K',
      '--retries', String(config.downloadRetryCount || 2),
      '--fragment-retries', String(config.downloadRetryCount || 2),
      '--newline',
      '--progress',
      '--progress-template',
      '{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes|0)s","total":"%(progress.total_bytes|0)s","speed":"%(progress.speed|0)s","eta":"%(progress.eta|0)s"}',
      '--output-na-placeholder', 'Unknown Channel',
      // Clean @ prefix from uploader_id when it's used as fallback
      '--replace-in-metadata', 'uploader_id', '^@', '',
      '-f', `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--download-archive', './config/complete.list',
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'availability!=subscriber_only',
      '-o', `${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/${VIDEO_FILE_TEMPLATE}`,
      '--datebefore', 'now',
      '-o', `thumbnail:${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, './videoDownloadPostProcessFiles.js')} {}`
    ];

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(configModule.config);
    args.push(...sponsorblockArgs);

    return args;
  }
}

module.exports = new DownloadModule();
