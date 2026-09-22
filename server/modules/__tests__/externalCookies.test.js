/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('child_process', () => ({ spawnSync: jest.fn() }));
jest.mock('../../logger', () => ({ warn: jest.fn(), info: jest.fn() }));

describe('external cookie validation and status', () => {
  let originalSource;
  let originalPath;
  let directory;
  let sourcePath;
  let executable;
  let validator;
  let logger;
  let cookies;
  let workingDirs;
  const source = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tSECRET\n';
  const helperResult = value => ({ status: 0, stdout: JSON.stringify(value) });

  beforeEach(() => {
    jest.resetModules();
    originalSource = process.env.YOUTARR_COOKIES_FILE;
    originalPath = process.env.PATH;
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-validation-test-'));
    sourcePath = path.join(directory, 'cookies.txt');
    executable = path.join(directory, 'yt-dlp');
    fs.writeFileSync(sourcePath, source);
    fs.writeFileSync(executable, 'test executable', { mode: 0o700 });
    process.env.YOUTARR_COOKIES_FILE = sourcePath;
    process.env.PATH = directory;
    validator = require('child_process').spawnSync;
    validator.mockReturnValue(helperResult({ valid: true, warnings: false }));
    logger = require('../../logger');
    cookies = require('../externalCookies');
    workingDirs = [];
    const mkdtemp = fs.mkdtempSync;
    jest.spyOn(fs, 'mkdtempSync').mockImplementation(prefix => {
      const dir = mkdtemp(prefix);
      workingDirs.push(dir);
      return dir;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalSource === undefined) delete process.env.YOUTARR_COOKIES_FILE;
    else process.env.YOUTARR_COOKIES_FILE = originalSource;
    process.env.PATH = originalPath;
    for (const dir of workingDirs) fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('reports no external status when the environment variable is unset', () => {
    delete process.env.YOUTARR_COOKIES_FILE;
    expect(cookies.getExternalCookiesStatus()).toBeNull();
    expect(validator).not.toHaveBeenCalled();
  });

  test('validates a private copy with the installed executable and reports only safe metadata', () => {
    expect(cookies.getExternalCookiesStatus()).toMatchObject({
      path: sourcePath, ready: true, lastModified: fs.statSync(sourcePath).mtime.toISOString(),
      warning: null, error: null,
    });
    expect(validator).toHaveBeenCalledWith('python3', [
      path.resolve(__dirname, '../../utils/validate-cookies.py'), executable,
      path.join(workingDirs[0], 'cookies.txt'),
    ], expect.objectContaining({ timeout: 5000, maxBuffer: 16 * 1024 }));
    expect(fs.existsSync(workingDirs[0])).toBe(false);
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(source);
  });

  test('uses only normalized contents returned by yt-dlp and surfaces warnings', () => {
    const normalized = source.replace('SECRET', 'ACCEPTED');
    validator.mockImplementation((_command, args) => {
      fs.writeFileSync(args[2], normalized);
      return helperResult({ valid: true, warnings: true });
    });
    const first = cookies.prepareExternalCookies(['--cookies', sourcePath]);
    expect(fs.readFileSync(first.args[1], 'utf8')).toBe(normalized);
    first.cleanup();
    const status = cookies.getExternalCookiesStatus();
    expect(status).toMatchObject({ ready: true, warning: expect.stringContaining('Only the cookies it loaded'), error: null });
    expect(validator).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(source);
    expect(JSON.stringify([status, logger.warn.mock.calls])).not.toContain('SECRET');
  });

  test.each([
    ['missing', () => fs.unlinkSync(sourcePath), /not found/],
    ['directory', () => { process.env.YOUTARR_COOKIES_FILE = directory; }, /regular file/],
    ['relative path', () => { process.env.YOUTARR_COOKIES_FILE = 'cookies.txt'; }, /absolute path/],
    ['oversized', () => fs.writeFileSync(sourcePath, Buffer.alloc(1024 * 1024 + 1)), /1 MB/],
    ['unreadable', () => {
      jest.spyOn(fs, 'openSync').mockImplementation(() => { throw Object.assign(new Error('SECRET'), { code: 'EACCES' }); });
    }, /not readable/],
  ])('omits a %s source and exposes a safe warning', (_name, arrange, message) => {
    arrange();
    const result = cookies.prepareExternalCookies(['--cookies', process.env.YOUTARR_COOKIES_FILE, '--dump-json']);
    expect(result).toEqual({ args: ['--dump-json'], cleanup: null });
    const status = cookies.getExternalCookiesStatus();
    expect(status.ready).toBe(false);
    expect(status.error).toMatch(message);
    expect(JSON.stringify([status, logger.warn.mock.calls])).not.toContain('SECRET');
    expect(validator).not.toHaveBeenCalled();
  });

  test.each(['invalid', 'empty'])('omits cookies when yt-dlp reports %s, caching the rejection without repeated logs', error => {
    validator.mockReturnValue(helperResult({ valid: false, error }));
    const args = ['--cookies', sourcePath, '--dump-json'];
    expect(cookies.prepareExternalCookies(args).args).toEqual(['--dump-json']);
    expect(cookies.getExternalCookiesStatus().ready).toBe(false);
    expect(validator).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(args[1]).toBe(sourcePath);
    expect(fs.existsSync(workingDirs[0])).toBe(false);
  });

  test.each([
    { status: 1, stderr: 'SECRET traceback' },
    { status: null, error: { code: 'ETIMEDOUT', message: 'SECRET timeout' } },
    { status: 0, stdout: 'SECRET invalid JSON' },
    helperResult({ valid: false, error: 'unavailable' }),
  ])('omits cookies on validator failure and retries unchanged contents', failure => {
    validator.mockReturnValueOnce(failure);
    const status = cookies.getExternalCookiesStatus();
    expect(status.ready).toBe(false);
    expect(JSON.stringify([status, logger.warn.mock.calls])).not.toContain('SECRET');
    expect(cookies.getExternalCookiesStatus().ready).toBe(true);
    expect(validator).toHaveBeenCalledTimes(2);
  });

  test('recovers from a missing yt-dlp installation without a source change', () => {
    fs.unlinkSync(executable);
    expect(cookies.getExternalCookiesStatus()).toMatchObject({ ready: false, error: expect.stringContaining('installation') });
    fs.writeFileSync(executable, 'restored', { mode: 0o700 });
    expect(cookies.getExternalCookiesStatus().ready).toBe(true);
  });

  test.each(['mkdtempSync', 'writeFileSync'])('omits cookies on %s failure and retries when storage recovers', method => {
    const failedWrite = jest.spyOn(fs, method).mockImplementation(() => { throw new Error('SECRET disk full'); });
    expect(cookies.getExternalCookiesStatus()).toMatchObject({ ready: false, error: expect.stringContaining('working copy') });
    failedWrite.mockRestore();
    const restored = cookies.prepareExternalCookies(['--cookies', sourcePath]);
    expect(restored.args).toContain('--cookies');
    restored.cleanup();
  });

  test('never falls back to accepted cookies after the source disappears', () => {
    expect(cookies.getExternalCookiesStatus().ready).toBe(true);
    fs.unlinkSync(sourcePath);
    expect(cookies.prepareExternalCookies(['--cookies', sourcePath]).args).toEqual([]);
    expect(cookies.getExternalCookiesStatus().ready).toBe(false);
  });

  test('revalidates changed contents even when file size and modification time are preserved', () => {
    cookies.getExternalCookiesStatus();
    const stat = fs.statSync(sourcePath);
    fs.writeFileSync(sourcePath, source.replace('SECRET', 'SECOND'));
    fs.utimesSync(sourcePath, stat.atime, stat.mtime);
    cookies.getExternalCookiesStatus();
    expect(validator).toHaveBeenCalledTimes(2);
  });

  test('recovers automatically after a rejected update without using the previous cookies', () => {
    cookies.getExternalCookiesStatus();
    fs.writeFileSync(sourcePath, 'bad update');
    validator.mockReturnValueOnce(helperResult({ valid: false, error: 'invalid' }));
    expect(cookies.prepareExternalCookies(['--cookies', sourcePath]).args).toEqual([]);
    fs.writeFileSync(sourcePath, source.replace('SECRET', 'FRESH'));
    const prepared = cookies.prepareExternalCookies(['--cookies', sourcePath]);
    expect(fs.readFileSync(prepared.args[1], 'utf8')).toContain('FRESH');
    prepared.cleanup();
    expect(logger.info).toHaveBeenCalledWith({ sourcePath }, 'External cookie file is ready');
  });

  test('revalidates unchanged cookie contents after a yt-dlp update', () => {
    cookies.getExternalCookiesStatus();
    fs.writeFileSync(executable, 'updated yt-dlp installation');
    cookies.getExternalCookiesStatus();
    expect(validator).toHaveBeenCalledTimes(2);
  });

  test('does not reuse a result from another configured source', () => {
    cookies.getExternalCookiesStatus();
    process.env.YOUTARR_COOKIES_FILE = path.join(directory, 'other.txt');
    fs.writeFileSync(process.env.YOUTARR_COOKIES_FILE, source);
    cookies.getExternalCookiesStatus();
    expect(validator).toHaveBeenCalledTimes(2);
  });
});
