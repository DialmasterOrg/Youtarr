const fs = require('fs-extra');
const os = require('os');
const path = require('path');

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
const directoryManager = require('../../filesystem/directoryManager');

describe('TempPathManager', () => {
  let originalDirectoryPath;

  beforeEach(() => {
    jest.clearAllMocks();
    originalDirectoryPath = configModule.directoryPath;
  });

  afterEach(() => {
    configModule.directoryPath = originalDirectoryPath;
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
    let mockReaddir;
    let mockRemove;
    let mockEnsureDir;

    beforeEach(() => {
      mockReaddir = jest.spyOn(fs, 'readdir').mockResolvedValue(['Channel', '.leftover.part']);
      mockRemove = jest.spyOn(directoryManager, 'removeDirectoryResilient').mockResolvedValue(undefined);
      mockEnsureDir = jest.spyOn(fs, 'ensureDir').mockResolvedValue(undefined);
    });

    afterEach(() => {
      mockReaddir.mockRestore();
      mockRemove.mockRestore();
      mockEnsureDir.mockRestore();
    });

    it('should clean external temp contents without removing the root', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      await tempPathManager.cleanTempDirectory();

      expect(mockReaddir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(mockRemove).toHaveBeenCalledTimes(2);
      expect(mockRemove).toHaveBeenCalledWith('/tmp/youtarr-downloads/Channel');
      expect(mockRemove).toHaveBeenCalledWith('/tmp/youtarr-downloads/.leftover.part');
      expect(mockRemove).not.toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Cleaning temp directory'
      );
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Cleaned temp directory contents'
      );
    });

    it('should clean local temp contents without removing the root', async () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
      configModule.directoryPath = '/mnt/network/youtube';
      await tempPathManager.cleanTempDirectory();

      expect(mockReaddir).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(mockRemove).toHaveBeenCalledTimes(2);
      expect(mockRemove).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp/Channel');
      expect(mockRemove).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp/.leftover.part');
      expect(mockRemove).not.toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(mockEnsureDir).toHaveBeenCalledWith('/mnt/network/youtube/.youtarr_tmp');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/mnt/network/youtube/.youtarr_tmp' },
        'Cleaning temp directory'
      );
    });

    it('should leave an empty temp directory in place', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      mockReaddir.mockResolvedValue([]);
      await tempPathManager.cleanTempDirectory();

      expect(mockReaddir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(mockRemove).not.toHaveBeenCalled();
      expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/youtarr-downloads');
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' },
        'Cleaned temp directory contents'
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
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.anything(), 'Cleaned temp directory contents'
      );
    });

    it('should attempt every entry and aggregate failures after the sweep', async () => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      mockReaddir.mockResolvedValue(['locked.part', 'Channel', '@eaDir', '.leftover.part']);
      const locked = Object.assign(new Error('File is locked'), { code: 'EBUSY' });
      const notEmpty = Object.assign(new Error('Directory is not empty'), { code: 'ENOTEMPTY' });
      mockRemove.mockRejectedValueOnce(locked)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(notEmpty)
        .mockResolvedValueOnce(undefined);

      const cleanup = tempPathManager.cleanTempDirectory();
      await expect(cleanup).rejects.toBeInstanceOf(AggregateError);
      await expect(cleanup).rejects.toMatchObject({
        message: 'Failed to clean temp directory: could not remove 2 of 4 entries',
        errors: [locked, notEmpty]
      });
      expect(mockRemove).toHaveBeenCalledTimes(4);
      expect(mockRemove).toHaveBeenNthCalledWith(2, '/tmp/youtarr-downloads/Channel');
      expect(mockRemove).toHaveBeenNthCalledWith(4, '/tmp/youtarr-downloads/.leftover.part');
      expect(logger.error).toHaveBeenCalledWith(
        { err: locked, entryPath: '/tmp/youtarr-downloads/locked.part' },
        'Failed to remove temp entry'
      );
      expect(logger.error).toHaveBeenCalledWith(
        { err: notEmpty, entryPath: '/tmp/youtarr-downloads/@eaDir' },
        'Failed to remove temp entry'
      );
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.anything(), 'Cleaned temp directory contents'
      );
    });

    it.each(['EACCES', 'EIO'])('should report directory read errors (%s)', async (code) => {
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: '/tmp/youtarr-downloads'
      });
      const error = Object.assign(new Error('Cannot read temp directory'), { code });
      mockReaddir.mockRejectedValue(error);

      await expect(tempPathManager.cleanTempDirectory()).rejects.toThrow(
        'Failed to clean temp directory: Cannot read temp directory'
      );
      expect(mockRemove).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads', err: error },
        'Error cleaning temp directory'
      );
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.anything(), 'Cleaned temp directory contents'
      );
    });

    it('should report directory creation errors before attempting cleanup', async () => {
      configModule.getConfig.mockReturnValue({ useTmpForDownloads: true });
      const error = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
      mockEnsureDir.mockRejectedValue(error);

      await expect(tempPathManager.cleanTempDirectory()).rejects.toThrow(
        'Cannot create temp directory: Permission denied'
      );
      expect(mockReaddir).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads' }, 'Cleaning temp directory'
      );
      expect(logger.error).toHaveBeenCalledWith(
        { tempBasePath: '/tmp/youtarr-downloads', err: error },
        'Failed to create temp directory'
      );
    });
  });

  describe('cleanTempDirectory filesystem behavior', () => {
    let workspace;
    let tempBase;

    beforeEach(async () => {
      workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'youtarr-temp-cleanup-'));
      tempBase = path.join(workspace, 'staging');
      configModule.getConfig.mockReturnValue({
        useTmpForDownloads: true,
        tmpFilePath: tempBase
      });
    });

    afterEach(async () => {
      await fs.remove(workspace);
    });

    it('should create a missing temp directory and support repeated cleanup', async () => {
      await tempPathManager.cleanTempDirectory();
      const original = await fs.stat(tempBase);
      await tempPathManager.cleanTempDirectory();

      expect(await fs.readdir(tempBase)).toEqual([]);
      const remaining = await fs.stat(tempBase);
      expect(remaining.isDirectory()).toBe(true);
      expect(remaining.ino).toBe(original.ino);
    });

    it.each([true, false])('should preserve the root and remove nested and hidden contents (external: %s)', async (external) => {
      if (!external) {
        configModule.getConfig.mockReturnValue({ useTmpForDownloads: false });
        configModule.directoryPath = workspace;
        tempBase = path.join(workspace, '.youtarr_tmp');
      }
      await fs.ensureDir(path.join(tempBase, 'Channel', 'Video'));
      await fs.writeFile(path.join(tempBase, 'Channel', 'Video', 'video.mp4.part'), 'partial');
      await fs.writeFile(path.join(tempBase, '.leftover'), 'hidden');
      await fs.chmod(tempBase, 0o750);
      const original = await fs.stat(tempBase);

      await tempPathManager.cleanTempDirectory();

      expect(await fs.readdir(tempBase)).toEqual([]);
      const remaining = await fs.stat(tempBase);
      expect(remaining.ino).toBe(original.ino);
      expect(remaining.mode).toBe(original.mode);
      expect(remaining.uid).toBe(original.uid);
      expect(remaining.gid).toBe(original.gid);
    });

    it('should remove child symlinks without deleting their targets', async () => {
      const outside = path.join(workspace, 'outside');
      await fs.ensureDir(outside);
      await fs.writeFile(path.join(outside, 'keep.txt'), 'keep');
      await fs.ensureDir(path.join(tempBase, 'nested'));
      await fs.symlink(outside, path.join(tempBase, 'linked-directory'), 'dir');
      await fs.symlink(path.join(outside, 'keep.txt'), path.join(tempBase, 'nested', 'linked-file'), 'file');

      await tempPathManager.cleanTempDirectory();

      expect(await fs.readdir(tempBase)).toEqual([]);
      expect(await fs.readFile(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep');
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
