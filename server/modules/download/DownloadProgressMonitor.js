const logger = require('../../logger');

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
    this.hasError = false;
    this.videoCount = {
      current: 1, // The first video is #1...
      total: 0,
      completed: 0,
      skipped: 0,
      skippedThisChannel: 0
    };
    this.isChannelDownload = jobType.includes('Channel Downloads');
    this.currentChannelName = '';
    this.currentVideoCompleted = false; // Track if current video is done
    this.channelNameJustSet = false; // Track when channel name is newly set
    // Exponential Moving Average smoothing for speed and ETA (reduce jitter in UI)
    this.smoothedSpeed = null; // null until first value received
    this.smoothedEta = null; // null until first value received
    this.speedSmoothingAlpha = 0.15; // 15% new value, 85% historical (heavily smoothed to handle volatile yt-dlp speeds)
    this.etaSmoothingAlpha = 0.05; // 5% new value, 95% historical (VERY heavily smoothed - ETA is extremely volatile)
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

  applySpeedSmoothing(newValue) {
    if (this.smoothedSpeed === null || this.smoothedSpeed === 0) {
      // First value or reset - use directly
      this.smoothedSpeed = newValue;
    } else {
      // EMA formula: smoothed = alpha * new + (1 - alpha) * old
      this.smoothedSpeed = this.speedSmoothingAlpha * newValue + (1 - this.speedSmoothingAlpha) * this.smoothedSpeed;
    }
    return this.smoothedSpeed;
  }

  applyEtaSmoothing(newEta) {
    if (this.smoothedEta === null || newEta === 0) {
      // First value or ETA is 0 (download complete) - use directly
      this.smoothedEta = newEta;
    } else {
      // EMA formula with very heavy smoothing for ETA
      this.smoothedEta = this.etaSmoothingAlpha * newEta + (1 - this.etaSmoothingAlpha) * this.smoothedEta;
    }
    return Math.round(this.smoothedEta);
  }

  calculateRawEta(downloadedBytes, totalBytes, smoothedSpeed) {
    if (!totalBytes || totalBytes === 0 || !smoothedSpeed || smoothedSpeed === 0) {
      return 0;
    }
    const bytesRemaining = totalBytes - downloadedBytes;
    if (bytesRemaining <= 0) {
      return 0;
    }
    return bytesRemaining / smoothedSpeed;
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
    // Reset smoothed values for new video
    this.smoothedSpeed = null;
    this.smoothedEta = null;
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
    if (state === 'error' || state === 'failed') {
      this.hasError = true;
    }

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
    // Detect metadata fetching phase (before actual downloads start)
    if (line.includes('[youtube] Extracting URL:') && !line.includes('[youtube:tab]')) {
      return 'preparing';
    }
    if (line.match(/\[youtube\] [^:]+: Downloading webpage/)) {
      return 'preparing';
    }
    if (line.match(/\[youtube\] [^:]+: Downloading (tv|web|android|ios) (client config|player API|safari player)/)) {
      return 'preparing';
    }
    if (line.match(/\[youtube\] [^:]+: Downloading player/)) {
      return 'preparing';
    }
    if (line.match(/\[youtube\] [^:]+: Downloading m3u8 information/)) {
      return 'preparing';
    }

    // Detect subtitle download announcement (not the actual download)
    if (line.match(/\[info\] [^:]+: Downloading subtitles:/)) {
      return 'preparing_subtitles';
    }

    // Detect download type from file extension
    if (line.includes('[download] Destination:')) {
      const path = line.split('Destination:')[1].trim();
      // Detect subtitle file downloads
      if (path.match(/\.(vtt|srt)$/i)) return 'downloading_subtitles';
      if (path.match(/\.f\d+\.mp4$/)) return 'downloading_video';
      if (path.match(/\.f\d+\.m4a$/)) return 'downloading_audio';
      if (path.includes('poster') || path.includes('thumbnail')) return 'downloading_thumbnail';
    }

    // Detect thumbnail and metadata operations
    if (line.includes('[info] Downloading video thumbnail')) return 'processing_metadata';
    if (line.includes('[info] Writing video thumbnail')) return 'processing_metadata';
    if (line.includes('[info] Writing video metadata')) return 'processing_metadata';
    if (line.includes('[SubtitlesConvertor]')) return 'processing_metadata';
    if (line.includes('[ThumbnailsConvertor]')) return 'processing_metadata';

    // Detect processing stages
    if (line.includes('[Merger]')) return 'merging';
    if (line.includes('[Metadata]')) return 'metadata';
    if (line.includes('[MoveFiles]')) return 'processing';
    if (line.includes('Completed:')) return 'complete';
    if (line.includes('ERROR:')) {
      this.hasError = true;
      return 'error';
    }

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
          logger.debug({ jobId: this.jobId, newChannelName, oldChannelName: this.currentChannelName }, 'Starting new channel, resetting counts');
          this.videoCount.current = 1;
          this.videoCount.skippedThisChannel = 0;
          this.currentVideoCompleted = false;
        }
      }

      this.currentChannelName = newChannelName;
      // Force a snapshot update so the channel name is immediately available
      this.channelNameJustSet = true;
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
        logger.debug({ jobId: this.jobId, newChannelName, oldChannelName: this.currentChannelName }, 'Starting new channel, resetting all counts');
        // These don't reset because they are tracking the FULL TOTALS for this job
        // this.videoCount.completed = 0;
        this.videoCount.skippedThisChannel = 0;
        this.videoCount.current = 1; // The first video is #1...
        this.currentVideoCompleted = false;
      }

      this.currentChannelName = newChannelName;
      this.videoCount.total = parseInt(playlistInitMatch[2], 10);
      // Force a snapshot update so the channel name is immediately available
      this.channelNameJustSet = true;
      return true;
    }

    // Check if item was skipped (already in archive or does not pass filter (subscribers only))
    // If so, increment the skipped count for the current channel AND the total skipped count.
    if (line.includes('has already been recorded in the archive') || line.includes('does not pass filter')) {
      // Only increment skipped once per video
      if (!this.currentVideoCompleted) {
        this.videoCount.skipped++;
        this.videoCount.skippedThisChannel++;
        // Increment the current count when it's not the first video
        if (this.videoCount.completed > 0) {
          this.videoCount.current++;
        }
        // this.currentVideoCompleted = true; // Mark as "completed" so we don't count it again
        logger.debug({
          jobId: this.jobId,
          current: this.videoCount.current,
          totalSkipped: this.videoCount.skipped
        }, 'Video skipped (already archived or does not pass filter)');
      }
      return true;
    }


    // Parse current item: "[download] Downloading item N of Y"
    // Note: yt-dlp already accounts for skipped items in N, so we use it directly
    // This only matches on channel downloads
    const itemMatch = line.match(/\[download\] Downloading item (\d+) of (\d+)/);
    if (itemMatch) {
      const newCurrent = parseInt(itemMatch[1], 10);
      this.videoCount.total = parseInt(itemMatch[2], 10);

      // Starting a new item, reset completion flag and state
      this.currentVideoCompleted = false;
      this.videoCount.current = newCurrent;
      this.currentState = 'initiating';
      this.resetProgressTracking();
      logger.debug({
        jobId: this.jobId,
        current: newCurrent,
        total: this.videoCount.total
      }, 'Starting download of item');
      return true;
    }

    // Track individual video extractions for manual URLs
    if (line.includes('[youtube] Extracting URL:') && !line.includes('[youtube:tab]')) {
      if (this.jobType === 'Manually Added Urls') {
        // Starting a new video, reset completion flag and state
        this.currentVideoCompleted = false;
        // If this is the first URL, set total if not already set
        if (this.videoCount.total === 0) {
          this.videoCount.total = 1;
        }
        if (this.videoCount.completed > 0) {
          this.videoCount.current++;
        }
        this.currentState = 'initiating';
        this.resetProgressTracking();
      } else if (this.videoCount.total === 0) {
        // Single video download (not manual URLs)
        this.videoCount.current = 1;
        this.videoCount.total = 1;
        this.currentVideoCompleted = false;
        this.currentState = 'initiating';
        this.resetProgressTracking();
      }
      return true;
    }

    // Track final completion of current video (actual download)
    // A video is complete when we see various completion indicators
    if (line.includes('Deleting original file')) {
      const lowerLine = line.toLowerCase();
      const isNonVideoCleanup = ['.webp', '.jpg', '.jpeg', '.png', '.vtt', '.srt']
        .some(ext => lowerLine.includes(ext));
      if (isNonVideoCleanup) {
        return true;
      }
    }

    const completionIndicators = [
      '[download] 100%',
      '[Merger] Merging formats into',
      '[MoveFiles] Moving file',
      '[Metadata] Adding metadata to',
      'Deleting original file'  // When yt-dlp cleans up after merging
    ];

    const isCompleted = completionIndicators.some(indicator => line.includes(indicator));

    if (isCompleted) {
      // Only increment completed once per video and after the first video
      if (!this.currentVideoCompleted) {
        this.videoCount.completed++;
        this.currentVideoCompleted = true;
        logger.debug({
          jobId: this.jobId,
          current: this.videoCount.current,
          totalCompleted: this.videoCount.completed
        }, 'Video downloaded successfully');
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

    // Fix race condition: If we're receiving actual download progress while in 'initiating' state,
    // automatically transition to downloading state. This handles cases where JSON progress
    // appears before the [download] Destination line.
    if (!newState && this.currentState === 'initiating' && parsed && parsed.percent > 0) {
      this.currentState = 'downloading_video';
    }

    // Parse video count information and update counts.
    this.parseAndUpdateVideoCounts(rawLine);

    // Extract video info if available
    let videoInfo = this.extractVideoInfo(rawLine);

    // Clear video title ONLY when preparing the next video (between videos)
    // Keep title during subtitle/metadata processing - those are for a specific video
    if (this.currentState === 'preparing') {
      videoInfo = {
        channel: videoInfo?.channel || this.currentChannelName || '',
        title: '',
        displayTitle: ''
      };
    }

    const videoInfoChanged = !!videoInfo && (
      !this.lastParsed?.videoInfo ||
      videoInfo.displayTitle !== this.lastParsed.videoInfo.displayTitle
    );
    const shouldEmitInitial = !this.lastParsed;
    const stateChanged = !!newState && newState !== this.lastEmittedState;

    // Check if channel name was just set and force an update
    const channelNameJustSet = this.channelNameJustSet;
    if (channelNameJustSet) {
      this.channelNameJustSet = false;
    }

    if (!parsed) {
      if (shouldEmitInitial || stateChanged || videoInfoChanged || channelNameJustSet) {
        return this.snapshot(this.currentState, videoInfo || undefined);
      }
      return null;
    }

    const stalled = this.isStalled(parsed, config);

    // Apply exponential smoothing to speed to reduce UI jitter
    const smoothedSpeed = this.applySpeedSmoothing(parsed.speed);

    // Calculate raw ETA from smoothed speed, then apply heavy smoothing to ETA itself
    const rawEta = this.calculateRawEta(parsed.downloaded, parsed.total, smoothedSpeed);
    const smoothedEta = this.applyEtaSmoothing(rawEta);

    const structuredPayload = {
      jobId: this.jobId,
      progress: {
        percent: parsed.percent,
        downloadedBytes: parsed.downloaded,
        totalBytes: parsed.total,
        speedBytesPerSecond: smoothedSpeed,
        etaSeconds: smoothedEta
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

module.exports = DownloadProgressMonitor;
