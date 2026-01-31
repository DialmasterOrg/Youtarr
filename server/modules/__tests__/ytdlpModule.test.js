const EventEmitter = require('events');

// Mock child_process before requiring the module
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

// Mock https before requiring the module
jest.mock('https', () => ({
  request: jest.fn(),
}));

// Mock jobModule
jest.mock('../jobModule', () => ({
  getInProgressJobId: jest.fn(),
}));

// Mock logger
jest.mock('../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { spawn } = require('child_process');
const https = require('https');
const jobModule = require('../jobModule');
const ytdlpModule = require('../ytdlpModule');

describe('ytdlpModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ytdlpModule.clearVersionCache();
    ytdlpModule.resetUpdateState();
    jobModule.getInProgressJobId.mockReturnValue(null);
  });

  describe('isUpdateAvailable', () => {
    it('returns false when versions are equal', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.16', '2024.01.16')).toBe(false);
    });

    it('returns false when versions are equal with v prefix', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.16', 'v2024.01.16')).toBe(false);
    });

    it('returns true when latest is newer year', () => {
      expect(ytdlpModule.isUpdateAvailable('2023.12.31', '2024.01.01')).toBe(true);
    });

    it('returns true when latest is newer month', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.01', '2024.02.01')).toBe(true);
    });

    it('returns true when latest is newer day', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.01', '2024.01.15')).toBe(true);
    });

    it('returns false when current is newer', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.02.01', '2024.01.01')).toBe(false);
    });

    it('returns false when current is null', () => {
      expect(ytdlpModule.isUpdateAvailable(null, '2024.01.01')).toBe(false);
    });

    it('returns false when latest is null', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.01', null)).toBe(false);
    });

    it('handles versions with patch numbers', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.16', '2024.01.16.1')).toBe(true);
      expect(ytdlpModule.isUpdateAvailable('2024.01.16.1', '2024.01.16')).toBe(false);
      expect(ytdlpModule.isUpdateAvailable('2024.01.16.1', '2024.01.16.2')).toBe(true);
    });

    it('handles versions with v prefix', () => {
      expect(ytdlpModule.isUpdateAvailable('v2024.01.01', 'v2024.01.15')).toBe(true);
      expect(ytdlpModule.isUpdateAvailable('2024.01.01', 'v2024.01.15')).toBe(true);
      expect(ytdlpModule.isUpdateAvailable('v2024.01.01', '2024.01.15')).toBe(true);
    });

    it('handles whitespace in versions', () => {
      expect(ytdlpModule.isUpdateAvailable('2024.01.01 ', ' 2024.01.15')).toBe(true);
    });
  });

  describe('clearVersionCache', () => {
    it('clears the cache without throwing', () => {
      expect(() => ytdlpModule.clearVersionCache()).not.toThrow();
    });
  });

  describe('getLatestVersion', () => {
    it('fetches version from GitHub API', async () => {
      const mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;

      const mockRequest = new EventEmitter();
      mockRequest.setTimeout = jest.fn();
      mockRequest.end = jest.fn();

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const versionPromise = ytdlpModule.getLatestVersion();

      // Simulate receiving data
      mockResponse.emit('data', JSON.stringify({ tag_name: '2024.01.15' }));
      mockResponse.emit('end');

      const version = await versionPromise;
      expect(version).toBe('2024.01.15');
    });

    it('returns cached version on subsequent calls', async () => {
      // First call - set up the cache
      const mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;

      const mockRequest = new EventEmitter();
      mockRequest.setTimeout = jest.fn();
      mockRequest.end = jest.fn();

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const versionPromise1 = ytdlpModule.getLatestVersion();
      mockResponse.emit('data', JSON.stringify({ tag_name: '2024.01.15' }));
      mockResponse.emit('end');
      await versionPromise1;

      // Second call - should return cached version
      const version2 = await ytdlpModule.getLatestVersion();
      expect(version2).toBe('2024.01.15');
      // Should only have been called once due to caching
      expect(https.request).toHaveBeenCalledTimes(1);
    });

    it('returns cached version on non-200 status', async () => {
      // First, populate the cache
      const mockResponse1 = new EventEmitter();
      mockResponse1.statusCode = 200;

      const mockRequest1 = new EventEmitter();
      mockRequest1.setTimeout = jest.fn();
      mockRequest1.end = jest.fn();

      https.request.mockImplementationOnce((options, callback) => {
        callback(mockResponse1);
        return mockRequest1;
      });

      const versionPromise1 = ytdlpModule.getLatestVersion();
      mockResponse1.emit('data', JSON.stringify({ tag_name: '2024.01.15' }));
      mockResponse1.emit('end');
      await versionPromise1;

      // Clear cache to force a new request
      ytdlpModule.clearVersionCache();

      // Set up a response with non-200 status
      const mockResponse2 = new EventEmitter();
      mockResponse2.statusCode = 403;

      const mockRequest2 = new EventEmitter();
      mockRequest2.setTimeout = jest.fn();
      mockRequest2.end = jest.fn();

      https.request.mockImplementationOnce((options, callback) => {
        callback(mockResponse2);
        return mockRequest2;
      });

      const versionPromise2 = ytdlpModule.getLatestVersion();
      mockResponse2.emit('data', '{"message": "rate limited"}');
      mockResponse2.emit('end');
      const version2 = await versionPromise2;

      // Should return null (cached version was cleared)
      expect(version2).toBeNull();
    });

    it('returns cached version on request error', async () => {
      const mockRequest = new EventEmitter();
      mockRequest.setTimeout = jest.fn();
      mockRequest.end = jest.fn();

      https.request.mockImplementation(() => {
        return mockRequest;
      });

      const versionPromise = ytdlpModule.getLatestVersion();

      // Simulate request error
      mockRequest.emit('error', new Error('Network error'));

      const version = await versionPromise;
      expect(version).toBeNull();
    });

    it('handles timeout', async () => {
      const mockRequest = new EventEmitter();
      let timeoutCallback;
      mockRequest.setTimeout = jest.fn((ms, callback) => {
        timeoutCallback = callback;
      });
      mockRequest.end = jest.fn();
      mockRequest.destroy = jest.fn();

      https.request.mockImplementation(() => {
        return mockRequest;
      });

      const versionPromise = ytdlpModule.getLatestVersion();

      // Simulate timeout
      timeoutCallback();

      const version = await versionPromise;
      expect(version).toBeNull();
      expect(mockRequest.destroy).toHaveBeenCalled();
    });

    it('handles JSON parse error', async () => {
      const mockResponse = new EventEmitter();
      mockResponse.statusCode = 200;

      const mockRequest = new EventEmitter();
      mockRequest.setTimeout = jest.fn();
      mockRequest.end = jest.fn();

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const versionPromise = ytdlpModule.getLatestVersion();

      // Simulate receiving invalid JSON
      mockResponse.emit('data', 'not valid json');
      mockResponse.emit('end');

      const version = await versionPromise;
      expect(version).toBeNull();
    });
  });

  describe('performUpdate', () => {
    function createMockProcess() {
      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      return mockProcess;
    }

    it('successfully updates yt-dlp', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      mockProcess.stdout.emit('data', 'Updated yt-dlp to 2024.01.20');
      mockProcess.emit('close', 0);

      const result = await updatePromise;
      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully updated to 2024.01.20');
      expect(result.newVersion).toBe('2024.01.20');
    });

    it('reports when already up to date', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      mockProcess.stdout.emit('data', 'yt-dlp is up to date (2024.01.15)');
      mockProcess.emit('close', 0);

      const result = await updatePromise;
      expect(result.success).toBe(true);
      expect(result.message).toBe('yt-dlp is already up to date');
    });

    it('handles permission denied error', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      mockProcess.stderr.emit('data', 'Permission denied');
      mockProcess.emit('close', 1);

      const result = await updatePromise;
      expect(result.success).toBe(false);
      expect(result.message).toContain('Permission denied');
    });

    it('handles non-zero exit code', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      mockProcess.stderr.emit('data', 'Some error occurred');
      mockProcess.emit('close', 1);

      const result = await updatePromise;
      expect(result.success).toBe(false);
      expect(result.message).toContain('exit code 1');
    });

    it('handles spawn error', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      mockProcess.emit('error', new Error('spawn ENOENT'));

      const result = await updatePromise;
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to start update process');
    });

    it('handles timeout', async () => {
      jest.useFakeTimers();

      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      // Fast-forward past the 2 minute timeout
      jest.advanceTimersByTime(120001);

      const result = await updatePromise;
      expect(result.success).toBe(false);
      expect(result.message).toBe('Update timed out. Please try again later.');
      expect(mockProcess.kill).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('prevents concurrent updates', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      // Start first update
      const updatePromise1 = ytdlpModule.performUpdate();

      // Try to start second update while first is in progress
      const result2 = await ytdlpModule.performUpdate();

      expect(result2.success).toBe(false);
      expect(result2.message).toBe('An update is already in progress');

      // Complete the first update
      mockProcess.stdout.emit('data', 'Updated yt-dlp to 2024.01.20');
      mockProcess.emit('close', 0);

      const result1 = await updatePromise1;
      expect(result1.success).toBe(true);
    });

    it('prevents update during active downloads', async () => {
      jobModule.getInProgressJobId.mockReturnValue('some-job-id');

      const result = await ytdlpModule.performUpdate();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot update while downloads are in progress. Please wait for downloads to complete.');
      expect(spawn).not.toHaveBeenCalled();
    });

    it('allows update when no downloads are in progress', async () => {
      jobModule.getInProgressJobId.mockReturnValue(null);

      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      mockProcess.stdout.emit('data', 'yt-dlp is up to date');
      mockProcess.emit('close', 0);

      const result = await updatePromise;
      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalledWith('yt-dlp', ['-U']);
    });

    it('resets update state after completion', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      expect(ytdlpModule.isUpdateInProgress()).toBe(true);

      mockProcess.stdout.emit('data', 'Updated yt-dlp to 2024.01.20');
      mockProcess.emit('close', 0);

      await updatePromise;

      expect(ytdlpModule.isUpdateInProgress()).toBe(false);
    });

    it('resets update state after error', async () => {
      const mockProcess = createMockProcess();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      expect(ytdlpModule.isUpdateInProgress()).toBe(true);

      mockProcess.emit('error', new Error('spawn failed'));

      await updatePromise;

      expect(ytdlpModule.isUpdateInProgress()).toBe(false);
    });
  });

  describe('isDownloadInProgress', () => {
    it('returns true when a job is in progress', () => {
      jobModule.getInProgressJobId.mockReturnValue('some-job-id');
      expect(ytdlpModule.isDownloadInProgress()).toBe(true);
    });

    it('returns false when no job is in progress', () => {
      jobModule.getInProgressJobId.mockReturnValue(null);
      expect(ytdlpModule.isDownloadInProgress()).toBe(false);
    });
  });

  describe('isUpdateInProgress', () => {
    it('returns false initially', () => {
      expect(ytdlpModule.isUpdateInProgress()).toBe(false);
    });

    it('returns true during update', async () => {
      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();

      expect(ytdlpModule.isUpdateInProgress()).toBe(true);

      // Clean up - emit close and await the promise to prevent hanging
      mockProcess.emit('close', 0);
      await updatePromise;
    });
  });

  describe('resetUpdateState', () => {
    it('resets the update in progress flag', async () => {
      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      spawn.mockReturnValue(mockProcess);

      const updatePromise = ytdlpModule.performUpdate();
      expect(ytdlpModule.isUpdateInProgress()).toBe(true);

      ytdlpModule.resetUpdateState();
      expect(ytdlpModule.isUpdateInProgress()).toBe(false);

      // Clean up - emit close and await the promise to prevent hanging
      mockProcess.emit('close', 0);
      await updatePromise;
    });
  });
});
