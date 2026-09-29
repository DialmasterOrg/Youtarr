/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn(), spawnSync: jest.fn() }));
jest.mock('../../logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

describe('yt-dlp process snapshots', () => {
  let originalSource;
  let originalPath;
  let sourceDir;
  let sourcePath;
  let workingDirs;
  let childProcess;
  let spawnYtDlp;
  let spawnYtDlpSync;
  const cookies = value => `# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t${value}\n`;

  beforeEach(() => {
    jest.resetModules();
    originalSource = process.env.YOUTARR_COOKIES_FILE;
    originalPath = process.env.PATH;
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-process-test-'));
    sourcePath = path.join(sourceDir, 'cookies.txt');
    fs.writeFileSync(sourcePath, cookies('first'), { mode: 0o400 });
    fs.writeFileSync(path.join(sourceDir, 'yt-dlp'), 'test executable', { mode: 0o700 });
    process.env.PATH = sourceDir;
    process.env.YOUTARR_COOKIES_FILE = sourcePath;
    workingDirs = new Set();
    childProcess = require('child_process');
    childProcess.spawn.mockImplementation(() => new EventEmitter());
    childProcess.spawnSync.mockImplementation(() => ({ status: 0, stdout: '{"valid":true,"warnings":false}' }));
    ({ spawnYtDlp, spawnYtDlpSync } = require('../ytdlpProcess'));
    const mkdtemp = fs.mkdtempSync;
    jest.spyOn(fs, 'mkdtempSync').mockImplementation(prefix => {
      const dir = mkdtemp(prefix);
      workingDirs.add(dir);
      return dir;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalSource === undefined) delete process.env.YOUTARR_COOKIES_FILE;
    else process.env.YOUTARR_COOKIES_FILE = originalSource;
    process.env.PATH = originalPath;
    for (const dir of workingDirs) fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  test('preserves uploaded-cookie args and process options when the feature is unset', () => {
    delete process.env.YOUTARR_COOKIES_FILE;
    const args = ['--cookies', sourcePath];
    const options = { timeout: 1000 };
    const child = spawnYtDlp(args, options);
    expect(childProcess.spawn).toHaveBeenCalledWith('yt-dlp', args, options);
    expect(childProcess.spawn.mock.calls[0][1]).toBe(args);
    expect(child.listenerCount('close')).toBe(0);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  test.each([['--help'], ['--cookies', '/one-time-upload.txt']])('preserves unrelated arguments: %j', (...args) => {
    fs.unlinkSync(sourcePath);
    spawnYtDlp(args);
    expect(childProcess.spawn.mock.calls[0][1]).toBe(args);
    expect(childProcess.spawnSync).not.toHaveBeenCalled();
  });

  test('launches without cookies when the initial external source is missing', () => {
    fs.unlinkSync(sourcePath);
    spawnYtDlp(['--cookies', sourcePath, '--dump-json']);
    expect(childProcess.spawn).toHaveBeenCalledWith('yt-dlp', ['--dump-json'], undefined);
  });

  test('launches without cookies when no private directory can be created', () => {
    fs.mkdtempSync.mockImplementation(() => { throw new Error('disk full'); });
    spawnYtDlp(['--cookies', sourcePath, '--dump-json']);
    expect(childProcess.spawn).toHaveBeenCalledWith('yt-dlp', ['--dump-json'], undefined);
  });

  test('isolates simultaneous operations, source replacements, and yt-dlp writeback', () => {
    const args = ['--cookies', sourcePath];
    const first = spawnYtDlp(args);
    const firstCopy = childProcess.spawn.mock.calls[0][1][1];
    expect(fs.statSync(firstCopy).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(firstCopy)).mode & 0o777).toBe(0o700);
    const replacement = path.join(sourceDir, 'next.txt');
    fs.writeFileSync(replacement, cookies('second'), { mode: 0o400 });
    fs.renameSync(replacement, sourcePath);
    const second = spawnYtDlp(args);
    const secondCopy = childProcess.spawn.mock.calls[1][1][1];
    expect(secondCopy).not.toBe(firstCopy);
    expect(fs.readFileSync(firstCopy, 'utf8')).toBe(cookies('first'));
    expect(fs.readFileSync(secondCopy, 'utf8')).toBe(cookies('second'));
    fs.writeFileSync(firstCopy, cookies('writeback'));
    first.emit('close', 0);
    expect(fs.existsSync(firstCopy)).toBe(false);
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(cookies('second'));
    expect(fs.existsSync(secondCopy)).toBe(true);
    second.emit('close', null, 'SIGTERM');
    expect(fs.existsSync(secondCopy)).toBe(false);
    expect(args[1]).toBe(sourcePath);
  });

  test('keeps the snapshot until close, including after a process error', () => {
    const child = spawnYtDlp(['--cookies', sourcePath]);
    const snapshot = childProcess.spawn.mock.calls[0][1][1];
    child.on('error', () => {});
    child.emit('error', new Error('spawn failed'));
    expect(fs.existsSync(snapshot)).toBe(true);
    child.emit('close', -2);
    expect(fs.existsSync(snapshot)).toBe(false);
  });

  test('cleans the snapshot if spawning throws synchronously', () => {
    let snapshot;
    childProcess.spawn.mockImplementation((_command, args) => {
      snapshot = args[1];
      throw new Error('spawn failed');
    });
    expect(() => spawnYtDlp(['--cookies', sourcePath])).toThrow('spawn failed');
    expect(fs.existsSync(snapshot)).toBe(false);
  });

  test('cleans synchronous snapshots after yt-dlp returns', () => {
    let snapshot;
    childProcess.spawnSync.mockImplementation((command, args) => {
      if (command === 'python3') return { status: 0, stdout: '{"valid":true}' };
      snapshot = args[1];
      return { status: 0, stdout: 'ok' };
    });
    expect(spawnYtDlpSync(['--cookies', sourcePath])).toEqual({ status: 0, stdout: 'ok' });
    expect(fs.existsSync(snapshot)).toBe(false);
  });

  describe('uploaded cookies', () => {
    let uploadedPath;

    beforeEach(() => {
      delete process.env.YOUTARR_COOKIES_FILE;
      const uploadedCookies = require('../uploadedCookies');
      uploadedCookies.configDir = sourceDir;
      uploadedPath = uploadedCookies.getPath();
      fs.writeFileSync(uploadedPath, cookies('uploaded'), { mode: 0o600 });
    });

    test('never passes the uploaded file itself to yt-dlp', () => {
      spawnYtDlp(['--cookies', uploadedPath, '--dump-json']);
      const [, spawnedArgs] = childProcess.spawn.mock.calls[0];
      expect(spawnedArgs[1]).not.toBe(uploadedPath);
      expect(fs.readFileSync(spawnedArgs[1], 'utf8')).toBe(cookies('uploaded'));
    });

    test('keeps the uploaded file unchanged when yt-dlp writes back its jar', () => {
      const child = spawnYtDlp(['--cookies', uploadedPath]);
      const copy = childProcess.spawn.mock.calls[0][1][1];
      fs.writeFileSync(copy, cookies('writeback'));
      child.emit('close', 0);
      expect(fs.readFileSync(uploadedPath, 'utf8')).toBe(cookies('uploaded'));
    });

    test.each([
      ['a normal exit', [0]],
      ['a nonzero exit', [1]],
      ['a signal', [null, 'SIGKILL']],
      ['a failed spawn', [-2]],
    ])('removes the copy after %s', (_label, closeArgs) => {
      const child = spawnYtDlp(['--cookies', uploadedPath]);
      const copy = childProcess.spawn.mock.calls[0][1][1];
      child.emit('close', ...closeArgs);
      expect(fs.existsSync(copy)).toBe(false);
    });

    test('removes the copy if spawning throws synchronously', () => {
      let copy;
      childProcess.spawn.mockImplementation((_command, args) => {
        copy = args[1];
        throw new Error('spawn failed');
      });
      expect(() => spawnYtDlp(['--cookies', uploadedPath])).toThrow('spawn failed');
      expect(fs.existsSync(copy)).toBe(false);
    });

    test('removes the copy after a synchronous run', () => {
      let copy;
      childProcess.spawnSync.mockImplementation((_command, args) => {
        copy = args[1];
        return { status: 0, stdout: 'ok' };
      });
      spawnYtDlpSync(['--cookies', uploadedPath]);
      expect(copy).not.toBe(uploadedPath);
      expect(fs.existsSync(copy)).toBe(false);
    });

    test('runs without cookies rather than passing the uploaded file when no copy can be made', () => {
      jest.spyOn(fs, 'mkdtempSync').mockImplementationOnce(() => { throw new Error('no space'); });
      spawnYtDlp(['--cookies', uploadedPath, '--dump-json']);
      expect(childProcess.spawn).toHaveBeenCalledWith('yt-dlp', ['--dump-json'], undefined);
    });
  });

  test('cleans synchronous snapshots after yt-dlp throws', () => {
    let snapshot;
    childProcess.spawnSync.mockImplementation((command, args) => {
      if (command === 'python3') return { status: 0, stdout: '{"valid":true}' };
      snapshot = args[1];
      throw new Error('sync spawn failed');
    });
    expect(() => spawnYtDlpSync(['--cookies', sourcePath])).toThrow('sync spawn failed');
    expect(fs.existsSync(snapshot)).toBe(false);
  });
});
