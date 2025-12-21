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
    it('should always return true (staging is always enabled)', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: true });
      expect(tempPathManager.isEnabled()).toBe(true);
    });

    it('should still return true when useTmpForDownloads is false', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      expect(tempPathManager.isEnabled()).toBe(true);
    });

    it('should still return true when useTmpForDownloads is undefined', () => {
      configModule.getConfig.mockReturnValue({});
      expect(tempPathManager.isEnabled()).toBe(true);
    });
  });

  describe('isUsingExternalTemp', () => {
    it('should return true when useTmpForDownloads is true', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: true });
      expect(tempPathManager.isUsingExternalTemp()).toBe(true);
    });

    it('should return false when useTmpForDownloads is false', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      expect(tempPathManager.isUsingExternalTemp()).toBe(false);
    });

    it('should return false when useTmpForDownloads is undefined', () => {
      configModule.getConfig.mockReturnValue({});
      expect(tempPathManager.isUsingExternalTemp()).toBe(false);
    });
  });

  describe('getTempBasePath', () => {
    describe('when using external temp (useTmpForDownloads=true)', () => {
      it('should return configured temp path', () => {
        configModule.getConfig.mockReturnValue({
          useTmpForDownloads: true,
          tmpFilePath: '/custom/temp/path'
        });
        expect(tempPathManager.getTempBasePath()).toBe('/custom/temp/path');
      });

      it('should return default temp path when tmpFilePath not configured', () => {
        configModule.getConfig.mockReturnValue({ useTmpForDownloads: true });
        expect(tempPathManager.getTempBasePath()).toBe('/tmp/youtarr-downloads');
      });
    });

    describe('when using local temp (useTmpForDownloads=false)', () => {
      it('should return .youtarr_tmp in output directory', () => {
        configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
        configModule.directoryPath = '/mnt/network/youtube';
        expect(tempPathManager.getTempBasePath()).toBe('/mnt/network/youtube/.youtarr_tmp');
      });

      it('should return .youtarr_tmp in output directory when useTmpForDownloads is undefined', () => {
        configModule.getConfig.mockReturnValue({});
        configModule.directoryPath = '/data/videos';
        expect(tempPathManager.getTempBasePath()).toBe('/data/videos/.youtarr_tmp');
      });
    });
  });

  describe('getFinalBasePath', () => {
    it('should return directoryPath from configModule', () => {
      configModule.directoryPath = '/mnt/network/youtube';
      expect(tempPathManager.getFinalBasePath()).toBe('/mnt/network/youtube');
    });
  });

  describe('isTempPath', () => {
    describe('when using external temp (useTmpForDownloads=true)', () => {
      beforeEach(() => {
        configModule.getConfig.mockReturnValue({
          useTmpForDownloads: true,
          tmpFilePath: '/tmp/youtarr-downloads'
        });
      });

      it('should return true for paths in external temp directory', () => {
        const testPath = '/tmp/youtarr-downloads/Channel/video.mp4';
        expect(tempPathManager.isTempPath(testPath)).toBe(true);
      });

      it('should return false for paths outside temp directory', () => {
        const testPath = '/mnt/network/youtube/Channel/video.mp4';
        expect(tempPathManager.isTempPath(testPath)).toBe(false);
      });

      it('should handle paths with trailing slashes', () => {
        const testPath = '/tmp/youtarr-downloads/Channel/';
        expect(tempPathManager.isTempPath(testPath)).toBe(true);
      });

      it('should return true for exact temp base path', () => {
        const testPath = '/tmp/youtarr-downloads';
        expect(tempPathManager.isTempPath(testPath)).toBe(true);
      });

      it('should handle temp base path with trailing separator', () => {
        configModule.getConfig.mockReturnValue({
          useTmpForDownloads: true,
          tmpFilePath: '/tmp/youtarr-downloads/'  // Note trailing slash
        });
        const testPath = '/tmp/youtarr-downloads/Channel/video.mp4';
        expect(tempPathManager.isTempPath(testPath)).toBe(true);
      });
    });

    describe('when using local temp (useTmpForDownloads=false)', () => {
      beforeEach(() => {
        configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
        configModule.directoryPath = '/mnt/network/youtube';
      });

      it('should return true for paths in local .youtarr_tmp directory', () => {
        const testPath = '/mnt/network/youtube/.youtarr_tmp/Channel/video.mp4';
        expect(tempPathManager.isTempPath(testPath)).toBe(true);
      });

      it('should return false for paths in final directory', () => {
        const testPath = '/mnt/network/youtube/Channel/video.mp4';
        expect(tempPathManager.isTempPath(testPath)).toBe(false);
      });

      it('should return true for exact local temp base path', () => {
        const testPath = '/mnt/network/youtube/.youtarr_tmp';
        expect(tempPathManager.isTempPath(testPath)).toBe(true);
      });
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
    });

    afterEach(() => {
      mockEnsureDir.mockRestore();
    });

    it('should create external temp directory when useTmpForDownloads is true', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      await tempPathManager.ensureTempDirectory();
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Ensured temp directory exists'
      );
    });

    it('should create local .youtarr_tmp directory when useTmpForDownloads is false', async () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      configModule.directoryPath = '/mnt/network/youtube';
      await tempPathManager.ensureTempDirectory();
      expect(mockEnsureDir).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/mnt/network/youtube/.youtarr_tmp' },
        'Ensured temp directory exists'
      );
    });

    it('should throw error if directory creation fails', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
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
    });

    afterEach(() => {
      mockPathExists.mockRestore();
      mockRemove.mockRestore();
      mockEnsureDir.mockRestore();
    });

    it('should remove and recreate external temp directory when useTmpForDownloads is true', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
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

    it('should remove and recreate local .youtarr_tmp directory when useTmpForDownloads is false', async () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      configModule.directoryPath = '/mnt/network/youtube';
      await tempPathManager.cleanTempDirectory();

      expect(mockPathExists).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(mockRemove).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(mockEnsureDir).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/mnt/network/youtube/.youtarr_tmp' },
        'Cleaning temp directory'
      );
    });

    it('should create temp directory when it does not exist', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
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

    it('should throw error if cleanup fails', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      mockRemove.mockRejectedValue(new Error('Deletion failed'));
      await expect(tempPathManager.cleanTempDirectory()).rejects.toThrow('Failed to clean temp directory');
      expect(logger.error).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads', err: expect.any(Error) },
        'Error cleaning temp directory'
      );
    });
  });

  describe('getStatus', () => {
    it('should return status with external temp when useTmpForDownloads is true', () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      configModule.directoryPath = '/mnt/network/youtube';

      const status = tempPathManager.getStatus();

      expect(status).toEqual({
        enabled: true,
        isUsingExternalTemp: true,
        tempBasePath: '/tmp/youtarr-downloads',
        finalBasePath: '/mnt/network/youtube'
      });
    });

    it('should return status with local temp when useTmpForDownloads is false', () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      configModule.directoryPath = '/mnt/network/youtube';

      const status = tempPathManager.getStatus();

      expect(status).toEqual({
        enabled: true,
        isUsingExternalTemp: false,
        tempBasePath: '/mnt/network/youtube/.youtarr_tmp',
        finalBasePath: '/mnt/network/youtube'
      });
    });
  });
});
