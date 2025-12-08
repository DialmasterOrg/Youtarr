const fs = require('fs-extra');
const fsPromises = require('fs').promises;

// Mock fs-extra and fs.promises
jest.mock('fs-extra');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readdir: jest.fn(),
    rmdir: jest.fn(),
    access: jest.fn()
  }
}));

// Mock logger
jest.mock('../../../logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

const {
  ensureDir,
  ensureDirSync,
  isDirectoryEmpty,
  removeIfEmpty,
  isVideoDirectory,
  isChannelDirectory,
  isSubfolderDir,
  cleanupEmptyChannelDirectory,
  listDirectory,
  listSubdirectories,
  isMainVideoFile
} = require('../directoryManager');

describe('filesystem/directoryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDir', () => {
    it('should call fs.ensureDir', async () => {
      fs.ensureDir.mockResolvedValueOnce();

      await ensureDir('/path/to/dir');

      expect(fs.ensureDir).toHaveBeenCalledWith('/path/to/dir');
    });
  });

  describe('ensureDirSync', () => {
    it('should call fs.ensureDirSync', () => {
      ensureDirSync('/path/to/dir');

      expect(fs.ensureDirSync).toHaveBeenCalledWith('/path/to/dir');
    });
  });

  describe('isDirectoryEmpty', () => {
    it('should return true for empty directory', async () => {
      fsPromises.readdir.mockResolvedValueOnce([]);

      const result = await isDirectoryEmpty('/path/empty');

      expect(result).toBe(true);
    });

    it('should return false for non-empty directory', async () => {
      fsPromises.readdir.mockResolvedValueOnce(['file1', 'file2']);

      const result = await isDirectoryEmpty('/path/full');

      expect(result).toBe(false);
    });

    it('should return false for non-existent directory', async () => {
      fsPromises.readdir.mockRejectedValueOnce(new Error('Not found'));

      const result = await isDirectoryEmpty('/path/missing');

      expect(result).toBe(false);
    });
  });

  describe('removeIfEmpty', () => {
    it('should remove empty directory', async () => {
      fsPromises.readdir.mockResolvedValueOnce([]);
      fsPromises.rmdir.mockResolvedValueOnce();

      const result = await removeIfEmpty('/path/empty');

      expect(result).toBe(true);
      expect(fsPromises.rmdir).toHaveBeenCalledWith('/path/empty');
    });

    it('should not remove non-empty directory', async () => {
      fsPromises.readdir.mockResolvedValueOnce(['file']);

      const result = await removeIfEmpty('/path/full');

      expect(result).toBe(false);
      expect(fsPromises.rmdir).not.toHaveBeenCalled();
    });
  });

  describe('isVideoDirectory', () => {
    it('should return true for video directories', () => {
      expect(isVideoDirectory('/path/Channel - Title - dQw4w9WgXcQ')).toBe(true);
      expect(isVideoDirectory('/path/Channel - Long Title Here - abc123defgh')).toBe(true);
    });

    it('should return false for channel directories', () => {
      expect(isVideoDirectory('/path/ChannelName')).toBe(false);
      expect(isVideoDirectory('/path/Channel - Name')).toBe(false);
    });

    it('should return false for directories without valid video ID', () => {
      expect(isVideoDirectory('/path/Channel - Title - short')).toBe(false);
      // 13+ characters is too long
      expect(isVideoDirectory('/path/Channel - Title - toolong123456')).toBe(false);
    });

    it('should validate video ID characters', () => {
      expect(isVideoDirectory('/path/Channel - Title - abc_123-XYZ')).toBe(true);
      expect(isVideoDirectory('/path/Channel - Title - abc!@#$%^&')).toBe(false);
    });
  });

  describe('isChannelDirectory', () => {
    const baseDir = '/videos';

    it('should return true for direct child of baseDir', () => {
      expect(isChannelDirectory('/videos/ChannelName', baseDir)).toBe(true);
    });

    it('should return true for child of subfolder', () => {
      expect(isChannelDirectory('/videos/__Subfolder/ChannelName', baseDir)).toBe(true);
    });

    it('should return false for baseDir itself', () => {
      expect(isChannelDirectory('/videos', baseDir)).toBe(false);
    });

    it('should return true for paths 2 levels below baseDir (video folders or channels in subfolders)', () => {
      // Note: This function only checks depth, not directory type.
      // In practice, callers should check isVideoDirectory first.
      expect(isChannelDirectory('/videos/Channel/Video - Title - abc123', baseDir)).toBe(true);
    });

    it('should return true for subfolder directories (1 level below baseDir)', () => {
      // Subfolder directories ARE 1 level below baseDir
      expect(isChannelDirectory('/videos/__Subfolder', baseDir)).toBe(true);
    });

    it('should return false for paths too deep', () => {
      expect(isChannelDirectory('/videos/Channel/Video/File', baseDir)).toBe(false);
    });
  });

  describe('isSubfolderDir', () => {
    it('should return true for directories starting with __', () => {
      expect(isSubfolderDir('__MyFolder')).toBe(true);
      expect(isSubfolderDir('__')).toBe(true);
    });

    it('should return false for regular directories', () => {
      expect(isSubfolderDir('MyFolder')).toBe(false);
      expect(isSubfolderDir('_MyFolder')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isSubfolderDir(null)).toBe(false);
      expect(isSubfolderDir(undefined)).toBe(false);
    });
  });

  describe('cleanupEmptyChannelDirectory', () => {
    const baseDir = '/videos';

    it('should remove empty channel directory', async () => {
      fsPromises.access.mockResolvedValueOnce();
      fsPromises.readdir.mockResolvedValueOnce([]);
      fsPromises.rmdir.mockResolvedValueOnce();

      await cleanupEmptyChannelDirectory('/videos/ChannelName', baseDir);

      expect(fsPromises.rmdir).toHaveBeenCalledWith('/videos/ChannelName');
    });

    it('should not remove non-channel directory', async () => {
      await cleanupEmptyChannelDirectory('/videos', baseDir);

      expect(fsPromises.rmdir).not.toHaveBeenCalled();
    });

    it('should not remove non-empty channel directory', async () => {
      fsPromises.access.mockResolvedValueOnce();
      fsPromises.readdir.mockResolvedValueOnce(['video-folder']);

      await cleanupEmptyChannelDirectory('/videos/ChannelName', baseDir);

      expect(fsPromises.rmdir).not.toHaveBeenCalled();
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents with file types', async () => {
      const mockEntries = [
        { name: 'file1', isDirectory: () => false },
        { name: 'dir1', isDirectory: () => true }
      ];
      fsPromises.readdir.mockResolvedValueOnce(mockEntries);

      const result = await listDirectory('/path');

      expect(result).toEqual(mockEntries);
      expect(fsPromises.readdir).toHaveBeenCalledWith('/path', { withFileTypes: true });
    });

    it('should return empty array for missing directory', async () => {
      const error = new Error('Not found');
      error.code = 'ENOENT';
      fsPromises.readdir.mockRejectedValueOnce(error);

      const result = await listDirectory('/missing');

      expect(result).toEqual([]);
    });
  });

  describe('listSubdirectories', () => {
    it('should return only directories', async () => {
      const mockEntries = [
        { name: 'file1', isDirectory: () => false },
        { name: 'dir1', isDirectory: () => true },
        { name: 'dir2', isDirectory: () => true }
      ];
      fsPromises.readdir.mockResolvedValueOnce(mockEntries);

      const result = await listSubdirectories('/path');

      expect(result).toEqual(['/path/dir1', '/path/dir2']);
    });
  });

  describe('isMainVideoFile', () => {
    it('should return true for main video files', () => {
      expect(isMainVideoFile('Channel - Title [dQw4w9WgXcQ].mp4')).toBe(true);
      expect(isMainVideoFile('Channel - Title [dQw4w9WgXcQ].mkv')).toBe(true);
      expect(isMainVideoFile('Channel - Title [dQw4w9WgXcQ].webm')).toBe(true);
    });

    it('should return false for fragment files', () => {
      expect(isMainVideoFile('video.f137.mp4')).toBe(false);
      expect(isMainVideoFile('video.f140.m4a')).toBe(false);
    });

    it('should return false for thumbnails', () => {
      expect(isMainVideoFile('poster.jpg')).toBe(false);
    });

    it('should return false for info files', () => {
      expect(isMainVideoFile('Channel - Title [dQw4w9WgXcQ].info.json')).toBe(false);
    });
  });
});
