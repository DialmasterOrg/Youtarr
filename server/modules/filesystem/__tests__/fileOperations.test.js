const fs = require('fs-extra');
const fsPromises = require('fs').promises;
const { execFile, execFileSync } = require('child_process');

// Mock fs-extra and fs.promises
jest.mock('fs-extra');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    open: jest.fn(),
    utimes: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn()
  },
  utimesSync: jest.fn()
}));

// Mock child_process (used by the cp fallback for FUSE-mount EPERM errors)
jest.mock('child_process', () => ({
  execFile: jest.fn(),
  execFileSync: jest.fn()
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
  moveFileNoClobber,
  safeRemove,
  safeCopy,
  copySyncWithFallback,
  pathExists,
  safeStat,
  setTimestamp,
  isFile,
  isDirectory
} = require('../fileOperations');

function eperm(syscall) {
  const err = new Error('operation not permitted');
  err.code = 'EPERM';
  err.syscall = syscall;
  return err;
}

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

    it('should fall back to cp -r on EPERM copyfile error from FUSE mounts', async () => {
      fs.move.mockRejectedValueOnce(eperm('copyfile'));
      fs.remove.mockResolvedValue();
      execFile.mockImplementation((cmd, args, callback) => callback(null, '', ''));

      await moveWithRetries('/src', '/dest');

      expect(execFile).toHaveBeenCalledWith('cp', ['-r', '--', '/src', '/dest'], expect.any(Function));
      expect(fs.remove).toHaveBeenCalledWith('/src');
    });

    it('should remove destination before falling back when overwrite is true', async () => {
      fs.move.mockRejectedValueOnce(eperm('copyfile'));
      fs.remove.mockResolvedValue();
      execFile.mockImplementation((cmd, args, callback) => callback(null, '', ''));

      await moveWithRetries('/src', '/dest', { overwrite: true });

      expect(fs.remove).toHaveBeenCalledWith('/dest');
    });

    it('should throw the fallback error when cp -r also fails', async () => {
      fs.move.mockRejectedValueOnce(eperm('copyfile'));
      fs.remove.mockResolvedValue();
      const cpError = new Error('cp: cannot create fifo');
      execFile.mockImplementation((cmd, args, callback) => callback(cpError));

      await expect(moveWithRetries('/src', '/dest')).rejects.toThrow('cp: cannot create fifo');
    });

    it('should not use the cp fallback for EPERM errors from other syscalls', async () => {
      jest.useFakeTimers();
      const error = eperm('rename');
      fs.move.mockRejectedValue(error);

      const promise = moveWithRetries('/src', '/dest', { retries: 1, delayMs: 10 });
      for (let i = 0; i < 2; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(1000);
      }

      await expect(promise).rejects.toThrow(error);
      expect(execFile).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('copySyncWithFallback', () => {
    it('should copy synchronously without fallback on success', () => {
      fs.copySync.mockReturnValueOnce();

      copySyncWithFallback('/src', '/dest');

      expect(fs.copySync).toHaveBeenCalledWith('/src', '/dest', { overwrite: true });
      expect(execFileSync).not.toHaveBeenCalled();
    });

    it('should fall back to cp -r on EPERM copyfile error', () => {
      fs.copySync.mockImplementationOnce(() => {
        throw eperm('copyfile');
      });
      fs.removeSync.mockReturnValueOnce();

      copySyncWithFallback('/src', '/dest');

      expect(fs.removeSync).toHaveBeenCalledWith('/dest');
      expect(execFileSync).toHaveBeenCalledWith('cp', ['-r', '--', '/src', '/dest']);
    });

    it('should not remove the destination first when overwrite is false', () => {
      fs.copySync.mockImplementationOnce(() => {
        throw eperm('copyfile');
      });

      copySyncWithFallback('/src', '/dest', { overwrite: false });

      expect(fs.removeSync).not.toHaveBeenCalled();
      expect(execFileSync).toHaveBeenCalledWith('cp', ['-r', '--', '/src', '/dest']);
    });

    it('should rethrow errors that are not the FUSE-mount EPERM case', () => {
      fs.copySync.mockImplementationOnce(() => {
        throw eperm('rename');
      });

      expect(() => copySyncWithFallback('/src', '/dest')).toThrow();
      expect(execFileSync).not.toHaveBeenCalled();
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

describe('moveFileNoClobber with a busy file', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fsPromises.rename.mockReset();
    fsPromises.stat.mockImplementation(async (file) => {
      if (file === '/src.mp4') return { ino: 1, dev: 1, size: 10, mtimeMs: 1 };
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    });
    fsPromises.mkdir.mockResolvedValue(undefined);
  });

  it('retries a rename while the file is busy', async () => {
    fsPromises.rename.mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EBUSY' })).mockResolvedValueOnce(undefined);
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4', { busyDelayMs: 1 })).resolves.toBe('moved');
    expect(fsPromises.rename).toHaveBeenCalledTimes(2);
  });

  it('gives up on a busy file after the retries', async () => {
    fsPromises.rename.mockRejectedValue(Object.assign(new Error('busy'), { code: 'EBUSY' }));
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4', { busyRetries: 2, busyDelayMs: 1 }))
      .rejects.toMatchObject({ code: 'EBUSY' });
    expect(fsPromises.rename).toHaveBeenCalledTimes(3);
  });

  it('does not retry a permission error', async () => {
    fsPromises.rename.mockRejectedValue(Object.assign(new Error('perm'), { code: 'EACCES' }));
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4', { busyDelayMs: 1 })).rejects.toMatchObject({ code: 'EACCES' });
    expect(fsPromises.rename).toHaveBeenCalledTimes(1);
  });
});

describe('moveFileNoClobber with a file already at the destination', () => {
  const statsWith = (destDev) => async (file) => (file === '/src.mp4'
    ? { ino: 1, dev: 1, size: 10, mtimeMs: 1000 }
    : { ino: 2, dev: destDev, size: 10, mtimeMs: 1000 });

  // A file handle over the content, read in chunks as a real one is.
  const handleOf = (content) => ({
    read: jest.fn(async (buffer, offset, length, position) => {
      const end = Math.min(content.length, position + length);
      if (position >= end) return { bytesRead: 0 };
      return { bytesRead: content.copy(buffer, offset, position, end) };
    }),
    close: jest.fn().mockResolvedValue(undefined),
  });
  const contents = (ofSrc, ofDest) => {
    fsPromises.open.mockImplementation(async (file) => handleOf(file === '/src.mp4' ? ofSrc : ofDest));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fsPromises.unlink.mockResolvedValue(undefined);
    fsPromises.open.mockReset();
  });

  it('keeps the source when a same-size, same-time file with other contents is there on the same device', async () => {
    fsPromises.stat.mockImplementation(statsWith(1));
    contents(Buffer.from('0123456789'), Buffer.from('abcdefghij'));
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4')).rejects.toMatchObject({ code: 'EEXIST' });
    expect(fsPromises.unlink).not.toHaveBeenCalledWith('/src.mp4');
  });

  it('finishes an interrupted copy on another mount of the same device', async () => {
    fsPromises.stat.mockImplementation(statsWith(1));
    contents(Buffer.from('0123456789'), Buffer.from('0123456789'));
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4')).resolves.toBe('already-moved');
    expect(fsPromises.unlink).toHaveBeenCalledWith('/src.mp4');
  });

  it('compares past the first chunk', async () => {
    const chunk = 1024 * 1024;
    const ofSrc = Buffer.alloc(chunk + 1, 'a');
    const ofDest = Buffer.alloc(chunk + 1, 'a');
    ofDest[chunk] = 'b'.charCodeAt(0);
    fsPromises.stat.mockImplementation(async (file) => ({ ino: file === '/src.mp4' ? 1 : 2, dev: 1, size: chunk + 1, mtimeMs: 1000 }));
    contents(ofSrc, ofDest);
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4')).rejects.toMatchObject({ code: 'EEXIST' });
  });

  it('closes both files after comparing them', async () => {
    fsPromises.stat.mockImplementation(statsWith(1));
    const handles = [];
    fsPromises.open.mockImplementation(async () => { const handle = handleOf(Buffer.from('0123456789')); handles.push(handle); return handle; });
    await moveFileNoClobber('/src.mp4', '/dest.mp4');
    expect(handles.map((handle) => handle.close.mock.calls.length)).toEqual([1, 1]);
  });

  it('finishes an interrupted copy across filesystems without reading the files', async () => {
    fsPromises.stat.mockImplementation(statsWith(2));
    await expect(moveFileNoClobber('/src.mp4', '/dest.mp4')).resolves.toBe('already-moved');
    expect(fsPromises.open).not.toHaveBeenCalled();
  });
});
