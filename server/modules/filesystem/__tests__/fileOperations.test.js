const fs = require('fs-extra');
const fsPromises = require('fs').promises;

// Mock fs-extra and fs.promises
jest.mock('fs-extra');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    utimes: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn()
  },
  utimesSync: jest.fn()
}));

// Mock logger
jest.mock('../../../logger', () => ({
  debug: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn()
}));

const {
  sleep,
  moveWithRetries,
  safeRemove,
  safeCopy,
  pathExists,
  safeStat,
  setTimestamp,
  isFile,
  isDirectory
} = require('../fileOperations');

describe('filesystem/fileOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sleep', () => {
    it('should wait for specified milliseconds', async () => {
      jest.useFakeTimers();
      const promise = sleep(100);
      jest.advanceTimersByTime(100);
      await promise;
      jest.useRealTimers();
    });
  });

  describe('moveWithRetries', () => {
    it('should move file successfully on first try', async () => {
      fs.move.mockResolvedValueOnce();

      await moveWithRetries('/src', '/dest');

      expect(fs.move).toHaveBeenCalledWith('/src', '/dest', { overwrite: true });
      expect(fs.move).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      jest.useFakeTimers();
      fs.move
        .mockRejectedValueOnce(new Error('EBUSY'))
        .mockResolvedValueOnce();

      const promise = moveWithRetries('/src', '/dest', { retries: 2, delayMs: 100 });

      // First attempt fails immediately
      await Promise.resolve();

      // Advance past first retry delay (100ms)
      jest.advanceTimersByTime(100);

      await promise;

      expect(fs.move).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('should throw after all retries exhausted', async () => {
      jest.useFakeTimers();
      const error = new Error('Persistent error');
      fs.move.mockRejectedValue(error);

      const promise = moveWithRetries('/src', '/dest', { retries: 2, delayMs: 10 });

      // Advance through all retries
      for (let i = 0; i < 3; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(1000);
      }

      await expect(promise).rejects.toThrow('Persistent error');
      jest.useRealTimers();
    });

    it('should use custom overwrite option', async () => {
      fs.move.mockResolvedValueOnce();

      await moveWithRetries('/src', '/dest', { overwrite: false });

      expect(fs.move).toHaveBeenCalledWith('/src', '/dest', { overwrite: false });
    });
  });

  describe('safeRemove', () => {
    it('should remove file successfully', async () => {
      fs.remove.mockResolvedValueOnce();

      await safeRemove('/path/to/file');

      expect(fs.remove).toHaveBeenCalledWith('/path/to/file');
    });

    it('should ignore ENOENT errors', async () => {
      const error = new Error('File not found');
      error.code = 'ENOENT';
      fs.remove.mockRejectedValueOnce(error);

      await expect(safeRemove('/path/to/file')).resolves.not.toThrow();
    });

    it('should log warning for other errors', async () => {
      const logger = require('../../../logger');
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fs.remove.mockRejectedValueOnce(error);

      await safeRemove('/path/to/file');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('safeCopy', () => {
    it('should copy file successfully', async () => {
      fs.copy.mockResolvedValueOnce();

      await safeCopy('/src', '/dest');

      expect(fs.copy).toHaveBeenCalledWith('/src', '/dest', { overwrite: false });
    });

    it('should use overwrite option', async () => {
      fs.copy.mockResolvedValueOnce();

      await safeCopy('/src', '/dest', { overwrite: true });

      expect(fs.copy).toHaveBeenCalledWith('/src', '/dest', { overwrite: true });
    });
  });

  describe('pathExists', () => {
    it('should return true when path exists', async () => {
      fsPromises.access.mockResolvedValueOnce();

      const result = await pathExists('/path/exists');

      expect(result).toBe(true);
    });

    it('should return false for ENOENT', async () => {
      const error = new Error('Not found');
      error.code = 'ENOENT';
      fsPromises.access.mockRejectedValueOnce(error);

      const result = await pathExists('/path/missing');

      expect(result).toBe(false);
    });

    it('should return false for ENOTDIR', async () => {
      const error = new Error('Not a directory');
      error.code = 'ENOTDIR';
      fsPromises.access.mockRejectedValueOnce(error);

      const result = await pathExists('/path/invalid');

      expect(result).toBe(false);
    });

    it('should throw for other errors', async () => {
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      fsPromises.access.mockRejectedValueOnce(error);

      await expect(pathExists('/path')).rejects.toThrow('Permission denied');
    });
  });

  describe('safeStat', () => {
    it('should return stats for existing file', async () => {
      const mockStats = { isFile: () => true, isDirectory: () => false };
      fsPromises.stat.mockResolvedValueOnce(mockStats);

      const result = await safeStat('/path/file');

      expect(result).toEqual({ path: '/path/file', stats: mockStats });
    });

    it('should return null for missing file', async () => {
      const error = new Error('Not found');
      error.code = 'ENOENT';
      fsPromises.stat.mockRejectedValueOnce(error);

      const result = await safeStat('/path/missing');

      expect(result).toBeNull();
    });
  });

  describe('setTimestamp', () => {
    it('should set timestamp from Date object', async () => {
      fsPromises.utimes.mockResolvedValueOnce();
      const date = new Date('2024-01-01T00:00:00Z');

      await setTimestamp('/path/file', date);

      expect(fsPromises.utimes).toHaveBeenCalledWith('/path/file', date, date);
    });

    it('should set timestamp from Unix seconds', async () => {
      fsPromises.utimes.mockResolvedValueOnce();
      const unixSeconds = 1704067200; // 2024-01-01T00:00:00Z

      await setTimestamp('/path/file', unixSeconds);

      expect(fsPromises.utimes).toHaveBeenCalled();
      const [, atime] = fsPromises.utimes.mock.calls[0];
      expect(atime.getTime()).toBe(unixSeconds * 1000);
    });
  });

  describe('isFile', () => {
    it('should return true for files', async () => {
      fsPromises.stat.mockResolvedValueOnce({
        isFile: () => true,
        isDirectory: () => false
      });

      const result = await isFile('/path/file');

      expect(result).toBe(true);
    });

    it('should return false for directories', async () => {
      fsPromises.stat.mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true
      });

      const result = await isFile('/path/dir');

      expect(result).toBe(false);
    });

    it('should return false for missing paths', async () => {
      const error = new Error('Not found');
      error.code = 'ENOENT';
      fsPromises.stat.mockRejectedValueOnce(error);

      const result = await isFile('/path/missing');

      expect(result).toBe(false);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', async () => {
      fsPromises.stat.mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true
      });

      const result = await isDirectory('/path/dir');

      expect(result).toBe(true);
    });

    it('should return false for files', async () => {
      fsPromises.stat.mockResolvedValueOnce({
        isFile: () => true,
        isDirectory: () => false
      });

      const result = await isDirectory('/path/file');

      expect(result).toBe(false);
    });
  });
});
