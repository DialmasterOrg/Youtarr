/* eslint-env jest */

const DownloadProgressMonitor = require('../DownloadProgressMonitor');

describe('DownloadProgressMonitor', () => {
  let monitor;
  const mockJobId = 'test-job-123';
  const mockConfig = {
    enableStallDetection: true,
    stallDetectionRateThreshold: '100K',
    downloadThrottledRate: '50K',
    stallDetectionWindowSeconds: 30
  };

  beforeEach(() => {
    monitor = new DownloadProgressMonitor(mockJobId, 'Channel Downloads');
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      const monitor = new DownloadProgressMonitor('job-123', 'Manual');
      expect(monitor.jobId).toBe('job-123');
      expect(monitor.jobType).toBe('Manual');
      expect(monitor.lastPercent).toBe(0);
      expect(monitor.stallRaised).toBe(false);
      expect(monitor.currentState).toBe('initiating');
      expect(monitor.videoCount.current).toBe(1);
      expect(monitor.videoCount.total).toBe(0);
      expect(monitor.videoCount.completed).toBe(0);
      expect(monitor.videoCount.skipped).toBe(0);
      expect(monitor.isChannelDownload).toBe(false);
    });

    it('should correctly identify channel downloads', () => {
      const channelMonitor = new DownloadProgressMonitor('job-123', 'Channel Downloads');
      expect(channelMonitor.isChannelDownload).toBe(true);
    });
  });

  describe('normalizeChannelName', () => {
    it('should return empty string for null or empty input', () => {
      expect(monitor.normalizeChannelName(null)).toBe('');
      expect(monitor.normalizeChannelName('')).toBe('');
      expect(monitor.normalizeChannelName('  ')).toBe('');
    });

    it('should return empty string for "NA" or "N/A"', () => {
      expect(monitor.normalizeChannelName('NA')).toBe('');
      expect(monitor.normalizeChannelName('na')).toBe('');
      expect(monitor.normalizeChannelName('N/A')).toBe('');
      expect(monitor.normalizeChannelName('n/a')).toBe('');
    });

    it('should trim and return valid channel names', () => {
      expect(monitor.normalizeChannelName('  Test Channel  ')).toBe('Test Channel');
      expect(monitor.normalizeChannelName('ValidChannel')).toBe('ValidChannel');
    });
  });

  describe('parseProgressJson', () => {
    it('should parse valid progress JSON', () => {
      const line = JSON.stringify({
        percent: '45.5%',
        downloaded: 1024000,
        total: 2048000,
        speed: 512000,
        eta: 2
      });

      const result = monitor.parseProgressJson(line);
      expect(result.percent).toBe(45.5);
      expect(result.downloaded).toBe(1024000);
      expect(result.total).toBe(2048000);
      expect(result.speed).toBe(512000);
      expect(result.etaSeconds).toBe(2);
      expect(result.timestamp).toBe(1000000);
    });

    it('should return null for invalid JSON', () => {
      expect(monitor.parseProgressJson('not json')).toBeNull();
    });

    it('should return null for JSON without percent field', () => {
      const line = JSON.stringify({
        downloaded: 1024000,
        total: 2048000
      });
      expect(monitor.parseProgressJson(line)).toBeNull();
    });

    it('should handle missing optional fields', () => {
      const line = JSON.stringify({
        percent: '50%'
      });
      const result = monitor.parseProgressJson(line);
      expect(result.percent).toBe(50);
      expect(result.downloaded).toBe(0);
      expect(result.total).toBe(0);
      expect(result.speed).toBe(0);
      expect(result.etaSeconds).toBe(0);
    });
  });

  describe('parseByteRate', () => {
    it('should parse plain numbers', () => {
      expect(monitor.parseByteRate('1000')).toBe(1000);
      expect(monitor.parseByteRate('0')).toBe(0);
    });

    it('should parse KB rates', () => {
      expect(monitor.parseByteRate('100K')).toBe(100000);
      expect(monitor.parseByteRate('100KB')).toBe(100000);
      expect(monitor.parseByteRate('100KiB')).toBe(102400);
    });

    it('should parse MB rates', () => {
      expect(monitor.parseByteRate('1M')).toBe(1000000);
      expect(monitor.parseByteRate('1MB')).toBe(1000000);
      expect(monitor.parseByteRate('1MiB')).toBe(1048576);
    });

    it('should parse GB rates', () => {
      expect(monitor.parseByteRate('1G')).toBe(1000000000);
      expect(monitor.parseByteRate('1GB')).toBe(1000000000);
      expect(monitor.parseByteRate('1GiB')).toBe(1073741824);
    });

    it('should handle decimal values', () => {
      expect(monitor.parseByteRate('1.5K')).toBe(1500);
      expect(monitor.parseByteRate('2.5M')).toBe(2500000);
    });

    it('should handle invalid input', () => {
      expect(monitor.parseByteRate('invalid')).toBe(0);
      expect(monitor.parseByteRate('')).toBe(0);
    });
  });

  describe('isStalled', () => {
    it('should return false when stall detection is disabled', () => {
      const config = { ...mockConfig, enableStallDetection: false };
      const progress = { speed: 10, percent: 10, timestamp: Date.now() };
      expect(monitor.isStalled(progress, config)).toBe(false);
    });

    it('should not be stalled when speed is 0', () => {
      const progress = { speed: 0, percent: 10, timestamp: Date.now() };
      expect(monitor.isStalled(progress, mockConfig)).toBe(false);
    });

    it('should not be stalled when percent advances', () => {
      monitor.lastPercent = 10;
      const progress = { speed: 100, percent: 10.2, timestamp: Date.now() };
      expect(monitor.isStalled(progress, mockConfig)).toBe(false);
      expect(monitor.lastPercent).toBe(10.2);
    });

    it('should detect stall when speed is below threshold for too long', () => {
      const now = Date.now();
      monitor.lastPercent = 10; // Set last percent to avoid percent advancement
      monitor.lastUpdateTimestamp = now - 35000; // 35 seconds ago
      // 10K is below the 50K throttled rate threshold (minimum of 100K and 50K)
      const progress = { speed: 10000, percent: 10, timestamp: now };
      expect(monitor.isStalled(progress, mockConfig)).toBe(true);
    });

    it('should not detect stall before window threshold', () => {
      const now = Date.now();
      monitor.lastPercent = 10; // Set last percent to avoid percent advancement
      monitor.lastUpdateTimestamp = now - 25000; // 25 seconds ago (less than 30 second window)
      // Even though speed is below threshold, not enough time has passed
      const progress = { speed: 10000, percent: 10, timestamp: now };
      expect(monitor.isStalled(progress, mockConfig)).toBe(false);
    });

    it('should use minimum of stallDetectionRateThreshold and downloadThrottledRate', () => {
      const config = {
        ...mockConfig,
        stallDetectionRateThreshold: '100K',
        downloadThrottledRate: '10K'
      };
      const now = Date.now();
      monitor.lastPercent = 10; // Set last percent to avoid percent advancement
      monitor.lastUpdateTimestamp = now - 35000;
      // 15K is above 10K threshold but below 100K
      const progress = { speed: 15000, percent: 10, timestamp: now };
      expect(monitor.isStalled(progress, config)).toBe(false);

      // 5K is below both thresholds
      const progress2 = { speed: 5000, percent: 10, timestamp: now };
      expect(monitor.isStalled(progress2, config)).toBe(true);
    });
  });

  describe('resetProgressTracking', () => {
    it('should reset tracking values', () => {
      monitor.lastPercent = 50;
      monitor.stallRaised = true;
      monitor.lastUpdateTimestamp = 0;

      monitor.resetProgressTracking();

      expect(monitor.lastPercent).toBe(0);
      expect(monitor.stallRaised).toBe(false);
      expect(monitor.lastUpdateTimestamp).toBe(1000000);
    });
  });

  describe('extractVideoInfo', () => {
    it('should extract video info from download destination line', () => {
      const line = '[download] Destination: /path/to/TestChannel - Video Title [abc123].f137.mp4';
      const result = monitor.extractVideoInfo(line);

      expect(result.channel).toBe('TestChannel');
      expect(result.title).toBe('Video Title');
      expect(result.displayTitle).toBe('Video Title');
    });

    it('should handle long titles with truncation', () => {
      const longTitle = 'A'.repeat(70);
      const line = `[download] Destination: /path/to/Channel - ${longTitle} [abc123].mp4`;
      const result = monitor.extractVideoInfo(line);

      expect(result.title).toBe(longTitle);
      expect(result.displayTitle).toBe('A'.repeat(57) + '...');
    });

    it('should handle files without channel separator', () => {
      const line = '[download] Destination: /path/to/VideoWithoutChannel [abc123].mp4';
      const result = monitor.extractVideoInfo(line);

      expect(result.channel).toBe('');
      expect(result.title).toBe('VideoWithoutChannel');
    });

    it('should strip various extensions correctly', () => {
      const line = '[download] Destination: /path/to/Channel - Title [id].f137.mp4';
      const result = monitor.extractVideoInfo(line);
      expect(result.title).toBe('Title');
    });

    it('should return lastVideoInfo for non-destination lines', () => {
      monitor.lastVideoInfo = { channel: 'OldChannel', title: 'OldTitle', displayTitle: 'OldTitle' };
      const result = monitor.extractVideoInfo('Some other line');
      expect(result).toEqual(monitor.lastVideoInfo);
    });

    it('should update currentChannelName when channel is found', () => {
      const line = '[download] Destination: /path/to/NewChannel - Title [id].mp4';
      monitor.extractVideoInfo(line);
      expect(monitor.currentChannelName).toBe('NewChannel');
    });
  });

  describe('determineState', () => {
    it('should identify downloading_video state', () => {
      expect(monitor.determineState('[download] Destination: file.f137.mp4')).toBe('downloading_video');
    });

    it('should identify downloading_audio state', () => {
      expect(monitor.determineState('[download] Destination: file.f140.m4a')).toBe('downloading_audio');
    });

    it('should identify downloading_thumbnail state', () => {
      expect(monitor.determineState('[download] Destination: poster.jpg')).toBe('downloading_thumbnail');
      expect(monitor.determineState('[download] Destination: thumbnail.png')).toBe('downloading_thumbnail');
    });

    it('should identify merging state', () => {
      expect(monitor.determineState('[Merger] Merging formats')).toBe('merging');
    });

    it('should identify metadata state', () => {
      expect(monitor.determineState('[Metadata] Adding metadata')).toBe('metadata');
    });

    it('should identify processing state', () => {
      expect(monitor.determineState('[MoveFiles] Moving file')).toBe('processing');
    });

    it('should identify complete state', () => {
      expect(monitor.determineState('Completed: file.mp4')).toBe('complete');
    });

    it('should identify error state', () => {
      expect(monitor.determineState('ERROR: Something went wrong')).toBe('error');
    });

    it('should return null for unrecognized lines', () => {
      expect(monitor.determineState('Random line')).toBeNull();
    });
  });

  describe('parseAndUpdateVideoCounts', () => {
    beforeEach(() => {
      monitor = new DownloadProgressMonitor(mockJobId, 'Channel Downloads');
    });

    it('should parse playlist initialization', () => {
      const line = '[youtube:tab] Playlist TestChannel - Videos: Downloading 10 items';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.currentChannelName).toBe('TestChannel');
      expect(monitor.videoCount.total).toBe(10);
      expect(monitor.channelNameJustSet).toBe(true);
    });

    it('should parse metadata playlist info', () => {
      const line = '[download] Downloading playlist: MyChannel - Videos';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.currentChannelName).toBe('MyChannel');
      expect(monitor.channelNameJustSet).toBe(true);
    });

    it('should reset counts when channel changes in channel downloads', () => {
      monitor.currentChannelName = 'OldChannel';
      monitor.videoCount.current = 5;
      monitor.videoCount.skippedThisChannel = 2;

      const line = '[youtube:tab] Playlist NewChannel - Videos: Downloading 8 items';
      monitor.parseAndUpdateVideoCounts(line);

      expect(monitor.currentChannelName).toBe('NewChannel');
      expect(monitor.videoCount.current).toBe(1);
      expect(monitor.videoCount.skippedThisChannel).toBe(0);
      expect(monitor.currentVideoCompleted).toBe(false);
    });

    it('should track skipped videos', () => {
      monitor.videoCount.skipped = 0;
      monitor.videoCount.skippedThisChannel = 0;
      monitor.currentVideoCompleted = false;

      const line = 'Video has already been recorded in the archive';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.videoCount.skipped).toBe(1);
      expect(monitor.videoCount.skippedThisChannel).toBe(1);
    });

    it('should track item downloads', () => {
      const line = '[download] Downloading item 3 of 10';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.videoCount.current).toBe(3);
      expect(monitor.videoCount.total).toBe(10);
      expect(monitor.currentVideoCompleted).toBe(false);
    });

    it('should track video extraction for manual URLs', () => {
      monitor = new DownloadProgressMonitor(mockJobId, 'Manually Added Urls');
      monitor.videoCount.total = 0;

      const line = '[youtube] Extracting URL: https://youtube.com/watch?v=123';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.videoCount.total).toBe(1);
      expect(monitor.currentVideoCompleted).toBe(false);
    });

    it('should track video completion', () => {
      monitor.currentVideoCompleted = false;
      monitor.videoCount.completed = 0;

      const line = '[download] 100% of 10.00MiB';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.videoCount.completed).toBe(1);
      expect(monitor.currentVideoCompleted).toBe(true);
    });

    it('should track completion through merger', () => {
      monitor.currentVideoCompleted = false;
      monitor.videoCount.completed = 0;

      const line = '[Merger] Merging formats into "output.mp4"';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.videoCount.completed).toBe(1);
      expect(monitor.currentVideoCompleted).toBe(true);
    });

    it('should not double-count completions', () => {
      monitor.currentVideoCompleted = true;
      monitor.videoCount.completed = 1;

      const line = '[download] 100% of 10.00MiB';
      monitor.parseAndUpdateVideoCounts(line);

      expect(monitor.videoCount.completed).toBe(1);
    });

    it('should handle filter rejection', () => {
      monitor.videoCount.skipped = 0;
      monitor.currentVideoCompleted = false;

      const line = 'Video does not pass filter (subscriber_count)';
      const result = monitor.parseAndUpdateVideoCounts(line);

      expect(result).toBe(true);
      expect(monitor.videoCount.skipped).toBe(1);
    });
  });

  describe('snapshot', () => {
    it('should create a snapshot with current state', () => {
      monitor.jobType = 'Manual';
      monitor.currentState = 'downloading_video';
      monitor.videoCount.current = 2;
      monitor.videoCount.total = 5;

      const snapshot = monitor.snapshot();

      expect(snapshot.jobId).toBe(mockJobId);
      expect(snapshot.state).toBe('downloading_video');
      expect(snapshot.stalled).toBe(false);
      expect(snapshot.downloadType).toBe('Manual');
      expect(snapshot.videoCount.current).toBe(2);
      expect(snapshot.videoCount.total).toBe(5);
    });

    it('should override state when provided', () => {
      monitor.currentState = 'downloading_video';
      const snapshot = monitor.snapshot('complete');

      expect(snapshot.state).toBe('complete');
      expect(monitor.currentState).toBe('complete');
    });

    it('should set 100% progress for complete state', () => {
      const snapshot = monitor.snapshot('complete');

      expect(snapshot.progress.percent).toBe(100);
      expect(snapshot.progress.speedBytesPerSecond).toBe(0);
      expect(snapshot.progress.etaSeconds).toBe(0);
    });

    it('should override video info when provided', () => {
      const videoInfo = {
        channel: 'TestChannel',
        title: 'TestTitle',
        displayTitle: 'TestTitle'
      };

      const snapshot = monitor.snapshot(null, videoInfo);
      expect(snapshot.videoInfo).toEqual(videoInfo);
    });

    it('should update internal state after snapshot', () => {
      monitor.currentState = 'downloading_video';
      monitor.stallRaised = false;

      monitor.snapshot('stalled');

      expect(monitor.currentState).toBe('stalled');
      expect(monitor.stallRaised).toBe(true);
      expect(monitor.lastEmittedState).toBe('stalled');
    });

    it('should preserve lastParsed data structure', () => {
      monitor.lastParsed = {
        progress: {
          percent: 50,
          downloadedBytes: 500,
          totalBytes: 1000,
          speedBytesPerSecond: 100,
          etaSeconds: 5
        }
      };

      const snapshot = monitor.snapshot();
      expect(snapshot.progress.percent).toBe(50);
      expect(snapshot.progress.downloadedBytes).toBe(500);
    });
  });

  describe('processProgress', () => {
    it('should process progress JSON and return structured payload', () => {
      const progressLine = JSON.stringify({
        percent: '25%',
        downloaded: 250000,
        total: 1000000,
        speed: 100000,
        eta: 10
      });

      const result = monitor.processProgress(progressLine, 'raw line', mockConfig);

      expect(result).toBeTruthy();
      expect(result.jobId).toBe(mockJobId);
      expect(result.progress.percent).toBe(25);
      expect(result.progress.downloadedBytes).toBe(250000);
      expect(result.stalled).toBe(false);
    });

    it('should detect and report stalled state', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      monitor.lastPercent = 25; // Set last percent to match current to avoid advancement
      monitor.lastUpdateTimestamp = now - 40000; // 40 seconds ago

      const progressLine = JSON.stringify({
        percent: '25%',
        downloaded: 250000,
        total: 1000000,
        speed: 1000, // Below threshold
        eta: 10
      });

      const result = monitor.processProgress(progressLine, 'raw line', mockConfig);

      expect(result.stalled).toBe(true);
      expect(result.state).toBe('stalled');
    });

    it('should update state from raw line', () => {
      const progressLine = JSON.stringify({
        percent: '100%',
        downloaded: 1000000,
        total: 1000000,
        speed: 0,
        eta: 0
      });

      const rawLine = '[Merger] Merging formats into output.mp4';
      const result = monitor.processProgress(progressLine, rawLine, mockConfig);

      expect(result.state).toBe('merging');
    });

    it('should extract video info from raw line', () => {
      const progressLine = JSON.stringify({
        percent: '50%',
        downloaded: 500000,
        total: 1000000,
        speed: 100000,
        eta: 5
      });

      const rawLine = '[download] Destination: /path/TestChannel - TestVideo [id].mp4';
      const result = monitor.processProgress(progressLine, rawLine, mockConfig);

      expect(result.videoInfo.channel).toBe('TestChannel');
      expect(result.videoInfo.title).toBe('TestVideo');
    });

    it('should update video counts from raw line', () => {
      const progressLine = '{}';
      const rawLine = '[download] Downloading item 2 of 10';

      monitor.processProgress(progressLine, rawLine, mockConfig);

      expect(monitor.videoCount.current).toBe(2);
      expect(monitor.videoCount.total).toBe(10);
    });

    it('should emit initial snapshot even without progress', () => {
      monitor.lastParsed = null;
      const result = monitor.processProgress('invalid json', 'some line', mockConfig);

      expect(result).toBeTruthy();
      expect(result.state).toBe('initiating');
    });

    it('should emit on state change', () => {
      monitor.lastParsed = { state: 'downloading_video' };
      monitor.lastEmittedState = 'downloading_video';

      const result = monitor.processProgress('{}', '[Merger] Merging', mockConfig);

      expect(result).toBeTruthy();
      expect(result.state).toBe('merging');
    });

    it('should emit on video info change', () => {
      monitor.lastParsed = {
        videoInfo: { displayTitle: 'OldVideo', channel: 'OldChannel', title: 'OldVideo' }
      };

      const rawLine = '[download] Destination: /path/NewChannel - NewVideo [id].mp4';
      const result = monitor.processProgress('{}', rawLine, mockConfig);

      expect(result).toBeTruthy();
      expect(result.videoInfo.displayTitle).toBe('NewVideo');
    });

    it('should emit when channel name is just set', () => {
      monitor.channelNameJustSet = true;
      const result = monitor.processProgress('{}', 'some line', mockConfig);

      expect(result).toBeTruthy();
      expect(monitor.channelNameJustSet).toBe(false);
    });

    it('should maintain download type in payload', () => {
      monitor.jobType = 'Channel Downloads';
      const progressLine = JSON.stringify({
        percent: '50%',
        downloaded: 500000,
        total: 1000000,
        speed: 100000,
        eta: 5
      });

      const result = monitor.processProgress(progressLine, 'line', mockConfig);
      expect(result.downloadType).toBe('Channel Downloads');
    });

    it('should maintain current channel name in payload', () => {
      monitor.currentChannelName = 'MyChannel';
      const progressLine = JSON.stringify({
        percent: '50%',
        downloaded: 500000,
        total: 1000000,
        speed: 100000,
        eta: 5
      });

      const result = monitor.processProgress(progressLine, 'line', mockConfig);
      expect(result.currentChannelName).toBe('MyChannel');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined config values gracefully', () => {
      const incompleteConfig = {
        enableStallDetection: true,
        stallDetectionRateThreshold: '100K',
        downloadThrottledRate: '50K'
        // Missing stallDetectionWindowSeconds
      };
      const progress = { speed: 100, percent: 10, timestamp: Date.now() };

      expect(() => monitor.isStalled(progress, incompleteConfig)).not.toThrow();
    });

    it('should handle malformed progress percentages', () => {
      const line = JSON.stringify({
        percent: 'invalid%',
        downloaded: 1000
      });

      const result = monitor.parseProgressJson(line);
      expect(result.percent).toBeNaN();
    });

    it('should handle empty video info gracefully', () => {
      const snapshot = monitor.snapshot();
      expect(snapshot.videoInfo).toHaveProperty('channel');
      expect(snapshot.videoInfo).toHaveProperty('title');
      expect(snapshot.videoInfo).toHaveProperty('displayTitle');
    });

    it('should handle rapid state changes', () => {
      monitor.currentState = 'downloading_video';
      monitor.processProgress('{}', '[Merger] Merging', mockConfig);
      expect(monitor.currentState).toBe('merging');

      monitor.processProgress('{}', '[Metadata] Adding', mockConfig);
      expect(monitor.currentState).toBe('metadata');

      monitor.processProgress('{}', 'Completed: file.mp4', mockConfig);
      expect(monitor.currentState).toBe('complete');
    });

    it('should preserve video count integrity across operations', () => {
      monitor.videoCount = {
        current: 5,
        total: 10,
        completed: 4,
        skipped: 1,
        skippedThisChannel: 1
      };

      const snapshot = monitor.snapshot();
      expect(snapshot.videoCount).toEqual({
        current: 5,
        total: 10,
        completed: 4,
        skipped: 1,
        skippedThisChannel: 1
      });

      // Original should not be modified
      expect(monitor.videoCount.current).toBe(5);
    });
  });
});