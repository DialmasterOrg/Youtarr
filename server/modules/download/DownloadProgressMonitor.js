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
    this.isChannelDownload = jobType === 'Channel Downloads';
    this.currentChannelName = '';
    this.currentVideoCompleted = false; // Track if current video is done
    this.channelNameJustSet = false; // Track when channel name is newly set
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
          console.log(`Starting new channel: ${newChannelName}, resetting counts`);
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
        console.log(`Starting new channel: ${newChannelName}, resetting all counts`);
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
    if (line.includes('Deleting original file')) {
      const lowerLine = line.toLowerCase();
      const isThumbnailCleanup = ['.webp', '.jpg', '.jpeg', '.png']
        .some(ext => lowerLine.includes(ext));
      if (isThumbnailCleanup) {
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

module.exports = DownloadProgressMonitor;
