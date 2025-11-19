const fs = require('fs-extra');

// Mock configModule BEFORE requiring tempPathManager
jest.mock('../../configModule', () => ({
  getConfig: jest.fn(),
  directoryPath: '',
  stopWatchingConfig: jest.fn()
}));

// Mock logger
jest.mock('../../../logger');

const tempPathManager = require('../tempPathManager');
const configModule = require('../../configModule');
const logger = require('../../../logger');

describe('TempPathManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up any resources
    if (configModule.stopWatchingConfig) {
      configModule.stopWatchingConfig();
    }
  });

  describe('isEnabled', () => {
    it('should return true when useTmpForDownloads is enabled', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: true });
      expect(tempPathManager.isEnabled()).toBe(true);
    });

    it('should return false when useTmpForDownloads is disabled', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      expect(tempPathManager.isEnabled()).toBe(false);
    });

    it('should return false when useTmpForDownloads is undefined', () => {
      configModule.getConfig.mockReturnValue({});
      expect(tempPathManager.isEnabled()).toBe(false);
    });
  });

  describe('getTempBasePath', () => {
    it('should return configured temp path', () => {
      configModule.getConfig.mockReturnValue({ tmpFilePath: '/custom/temp/path' });
      expect(tempPathManager.getTempBasePath()).toBe('/custom/temp/path');
    });

    it('should return default temp path when not configured', () => {
      configModule.getConfig.mockReturnValue({});
      expect(tempPathManager.getTempBasePath()).toBe('/tmp/youtarr-downloads');
    });
  });

  describe('getFinalBasePath', () => {
    it('should return directoryPath from configModule', () => {
      configModule.directoryPath = '/mnt/network/youtube';
      expect(tempPathManager.getFinalBasePath()).toBe('/mnt/network/youtube');
    });
  });

  describe('isTempPath', () => {
    beforeEach(() => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
    });

    it('should return true for paths in temp directory', () => {
      const testPath = '/tmp/youtarr-downloads/Channel/video.mp4';
      expect(tempPathManager.isTempPath(testPath)).toBe(true);
    });

    it('should return false for paths outside temp directory', () => {
      const testPath = '/mnt/network/youtube/Channel/video.mp4';
      expect(tempPathManager.isTempPath(testPath)).toBe(false);
    });

    it('should return false when temp downloads are disabled', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      const testPath = '/tmp/youtarr-downloads/Channel/video.mp4';
      expect(tempPathManager.isTempPath(testPath)).toBe(false);
    });

    it('should handle paths with trailing slashes', () => {
      const testPath = '/tmp/youtarr-downloads/Channel/';
      expect(tempPathManager.isTempPath(testPath)).toBe(true);
    });
  });

  describe('convertTempToFinal', () => {
    beforeEach(() => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      configModule.directoryPath = '/mnt/network/youtube';
    });

    it('should convert temp path to final path', () => {
      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID/video.mp4';
      const expected = '/mnt/network/youtube/Channel/Video - ID/video.mp4';
      expect(tempPathManager.convertTempToFinal(tempPath)).toBe(expected);
    });

    it('should return path as-is if not a temp path', () => {
      const finalPath = '/mnt/network/youtube/Channel/Video - ID/video.mp4';
      expect(tempPathManager.convertTempToFinal(finalPath)).toBe(finalPath);
    });

    it('should handle paths with special characters', () => {
      const tempPath = '/tmp/youtarr-downloads/Channel: Name/Video (2023) - ID/video.mp4';
      const expected = '/mnt/network/youtube/Channel: Name/Video (2023) - ID/video.mp4';
      expect(tempPathManager.convertTempToFinal(tempPath)).toBe(expected);
    });

    it('should handle directory paths without trailing slash', () => {
      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID';
      const expected = '/mnt/network/youtube/Channel/Video - ID';
      expect(tempPathManager.convertTempToFinal(tempPath)).toBe(expected);
    });
  });

  describe('convertFinalToTemp', () => {
    beforeEach(() => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      configModule.directoryPath = '/mnt/network/youtube';
    });

    it('should convert final path to temp path', () => {
      const finalPath = '/mnt/network/youtube/Channel/Video - ID/video.mp4';
      const expected = '/tmp/youtarr-downloads/Channel/Video - ID/video.mp4';
      expect(tempPathManager.convertFinalToTemp(finalPath)).toBe(expected);
    });

    it('should handle paths with special characters', () => {
      const finalPath = '/mnt/network/youtube/Channel: Name/Video (2023) - ID/video.mp4';
      const expected = '/tmp/youtarr-downloads/Channel: Name/Video (2023) - ID/video.mp4';
      expect(tempPathManager.convertFinalToTemp(finalPath)).toBe(expected);
    });
  });

  describe('ensureTempDirectory', () => {
    let mockEnsureDir;

    beforeEach(() => {
      mockEnsureDir = jest.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
    });

    afterEach(() => {
      mockEnsureDir.mockRestore();
    });

    it('should create temp directory when enabled', async () => {
      await tempPathManager.ensureTempDirectory();
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Ensured temp directory exists'
      );
    });

    it('should not create directory when temp downloads are disabled', async () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      await tempPathManager.ensureTempDirectory();
      expect(mockEnsureDir).not.toHaveBeenCalled();
    });

    it('should throw error if directory creation fails', async () => {
      mockEnsureDir.mockRejectedValue(new Error('Permission denied'));
      await expect(tempPathManager.ensureTempDirectory()).rejects.toThrow('Cannot create temp directory');
      expect(logger.error).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads', err: expect.any(Error) },
        'Failed to create temp directory'
      );
    });
  });

  describe('cleanTempDirectory', () => {
    let mockPathExists;
    let mockRemove;
    let mockEnsureDir;

    beforeEach(() => {
      mockPathExists = jest.spyOn(fs, 'pathExists').mockResolvedValue(true);
      mockRemove = jest.spyOn(fs, 'remove').mockResolvedValue(undefined);
      mockEnsureDir = jest.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
    });

    afterEach(() => {
      mockPathExists.mockRestore();
      mockRemove.mockRestore();
      mockEnsureDir.mockRestore();
    });

    it('should remove and recreate temp directory when it exists', async () => {
      await tempPathManager.cleanTempDirectory();

      expect(mockPathExists).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(mockRemove).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Cleaning temp directory'
      );
      expect(logger.info).toHaveBeenCalledWith('Removed temp directory');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Recreated temp directory'
      );
    });

    it('should create temp directory when it does not exist', async () => {
      mockPathExists.mockResolvedValue(false);
      await tempPathManager.cleanTempDirectory();

      expect(mockPathExists).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(logger.debug).toHaveBeenCalledWith('Temp directory doesn\'t exist, nothing to clean');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Recreated temp directory'
      );
    });

    it('should not do anything when temp downloads are disabled', async () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      await tempPathManager.cleanTempDirectory();

      expect(mockPathExists).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockEnsureDir).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith('Temp downloads disabled, skipping cleanup');
    });

    it('should throw error if cleanup fails', async () => {
      mockRemove.mockRejectedValue(new Error('Deletion failed'));
      await expect(tempPathManager.cleanTempDirectory()).rejects.toThrow('Failed to clean temp directory');
      expect(logger.error).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads', err: expect.any(Error) },
        'Error cleaning temp directory'
      );
    });
  });

  describe('moveToFinal', () => {
    let mockStat;
    let mockPathExists;
    let mockEnsureDir;
    let mockMove;

    beforeEach(() => {
      mockStat = jest.spyOn(fs, 'stat').mockResolvedValue({ isDirectory: () => true });
      mockPathExists = jest.spyOn(fs, 'pathExists')
        .mockResolvedValueOnce(true)  // Source exists
        .mockResolvedValueOnce(true); // Destination exists after move
      mockEnsureDir = jest.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
      mockMove = jest.spyOn(fs, 'move').mockResolvedValue(undefined);

      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      configModule.directoryPath = '/mnt/network/youtube';
    });

    afterEach(() => {
      mockStat.mockRestore();
      mockPathExists.mockRestore();
      mockEnsureDir.mockRestore();
      mockMove.mockRestore();
    });

    it('should successfully move directory from temp to final', async () => {
      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID';
      const result = await tempPathManager.moveToFinal(tempPath);

      expect(result.success).toBe(true);
      expect(result.finalPath).toBe('/mnt/network/youtube/Channel/Video - ID');
      expect(mockMove).toHaveBeenCalledWith(
        tempPath,
        '/mnt/network/youtube/Channel/Video - ID',
        { overwrite: true }
      );
      expect(logger.debug).toHaveBeenCalledWith(
        { sourcePath: tempPath, destinationPath: '/mnt/network/youtube/Channel/Video - ID' },
        'Moving from temp to final'
      );
      expect(logger.info).toHaveBeenCalledWith(
        { sourcePath: tempPath, destinationPath: '/mnt/network/youtube/Channel/Video - ID' },
        'Successfully moved to final location'
      );
    });

    it('should use provided final path if given', async () => {
      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID';
      const finalPath = '/custom/final/path';
      await tempPathManager.moveToFinal(tempPath, finalPath);

      expect(mockMove).toHaveBeenCalledWith(tempPath, finalPath, { overwrite: true });
    });

    it('should return error if source does not exist', async () => {
      // Reset mocks for this test
      mockPathExists.mockReset().mockResolvedValue(false); // Source doesn't exist

      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID';
      const result = await tempPathManager.moveToFinal(tempPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Source path does not exist');
      expect(logger.error).toHaveBeenCalledWith(
        { tempPath, finalPath: null, err: expect.any(Error) },
        'Error moving to final location'
      );
    });

    it('should return error if move fails', async () => {
      mockMove.mockRejectedValue(new Error('Move failed'));

      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID';
      const result = await tempPathManager.moveToFinal(tempPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Move failed');
      expect(logger.error).toHaveBeenCalledWith(
        { tempPath, finalPath: null, err: expect.any(Error) },
        'Error moving to final location'
      );
    });

    it('should return error if destination does not exist after move', async () => {
      // Reset and set up specific mock sequence
      mockPathExists.mockReset()
        .mockResolvedValueOnce(true)  // Source exists
        .mockResolvedValueOnce(false); // Destination doesn't exist after move

      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID';
      const result = await tempPathManager.moveToFinal(tempPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Move completed but destination doesn\'t exist');
      expect(logger.error).toHaveBeenCalledWith(
        { tempPath, finalPath: null, err: expect.any(Error) },
        'Error moving to final location'
      );
    });

    it('should handle file path by moving parent directory', async () => {
      mockStat.mockResolvedValue({ isDirectory: () => false });

      const tempPath = '/tmp/youtarr-downloads/Channel/Video - ID/video.mp4';
      const result = await tempPathManager.moveToFinal(tempPath);

      expect(result.success).toBe(true);
      expect(mockMove).toHaveBeenCalledWith(
        '/tmp/youtarr-downloads/Channel/Video - ID',
        '/mnt/network/youtube/Channel/Video - ID',
        { overwrite: true }
      );
    });
  });

  describe('getStatus', () => {
    it('should return status when enabled', () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      configModule.directoryPath = '/mnt/network/youtube';

      const status = tempPathManager.getStatus();

      expect(status).toEqual({
        enabled: true,
        tempBasePath: '/tmp/youtarr-downloads',
        finalBasePath: '/mnt/network/youtube'
      });
    });

    it('should return status when disabled', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      configModule.directoryPath = '/mnt/network/youtube';

      const status = tempPathManager.getStatus();

      expect(status).toEqual({
        enabled: false,
        tempBasePath: null,
        finalBasePath: '/mnt/network/youtube'
      });
    });
  });
});
