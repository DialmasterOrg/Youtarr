/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

describe('uploadedCookies', () => {
  const cookies = value => `# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t${value}\n`;
  let configDir;
  let uploadedPath;
  let uploadedCookies;
  let logger;
  let createdDirs;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-uploaded-test-'));
    uploadedCookies = require('../uploadedCookies');
    logger = require('../../logger');
    uploadedCookies.configDir = configDir;
    uploadedPath = uploadedCookies.getPath();
    fs.writeFileSync(uploadedPath, cookies('uploaded'), { mode: 0o600 });
    createdDirs = [];
    const mkdtemp = fs.mkdtempSync;
    jest.spyOn(fs, 'mkdtempSync').mockImplementation(prefix => {
      const dir = mkdtemp(prefix);
      createdDirs.push(dir);
      return dir;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const dir of createdDirs) fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(configDir, { recursive: true, force: true });
  });

  test('stores uploads as cookies.user.txt in the config directory', () => {
    expect(uploadedPath).toBe(path.join(configDir, 'cookies.user.txt'));
  });

  test('passes other arguments through unchanged', () => {
    const args = ['--cookies', '/somewhere/else.txt', '--dump-json'];
    const prepared = uploadedCookies.prepare(args);
    expect(prepared.args).toBe(args);
    expect(prepared.cleanup).toBeNull();
  });

  test('replaces the uploaded path with a private owner-only copy', () => {
    const args = ['--dump-json', '--cookies', uploadedPath, 'https://example.com'];
    const prepared = uploadedCookies.prepare(args);
    const copyPath = prepared.args[2];

    expect(copyPath).not.toBe(uploadedPath);
    expect(fs.readFileSync(copyPath, 'utf8')).toBe(cookies('uploaded'));
    expect(fs.statSync(copyPath).mode & 0o777).toBe(0o600);
    expect(prepared.args).toEqual(['--dump-json', '--cookies', copyPath, 'https://example.com']);
    expect(args[2]).toBe(uploadedPath);
    prepared.cleanup();
  });

  test('gives each run its own copy', () => {
    const first = uploadedCookies.prepare(['--cookies', uploadedPath]);
    const second = uploadedCookies.prepare(['--cookies', uploadedPath]);
    expect(first.args[1]).not.toBe(second.args[1]);
    first.cleanup();
    second.cleanup();
  });

  test('never changes the uploaded file when a run rewrites its copy', () => {
    const prepared = uploadedCookies.prepare(['--cookies', uploadedPath]);
    fs.writeFileSync(prepared.args[1], cookies('rotated-by-yt-dlp'));
    prepared.cleanup();
    expect(fs.readFileSync(uploadedPath, 'utf8')).toBe(cookies('uploaded'));
  });

  test('removes the copy on cleanup and tolerates a second cleanup', () => {
    const prepared = uploadedCookies.prepare(['--cookies', uploadedPath]);
    const copyDir = path.dirname(prepared.args[1]);
    prepared.cleanup();
    prepared.cleanup();
    expect(fs.existsSync(copyDir)).toBe(false);
  });

  test('logs instead of throwing when the copy cannot be removed', () => {
    const prepared = uploadedCookies.prepare(['--cookies', uploadedPath]);
    jest.spyOn(fs, 'rmSync').mockImplementationOnce(() => { throw new Error('busy'); });
    expect(() => prepared.cleanup()).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Failed to remove temporary copy of uploaded cookies'
    );
  });

  test('runs without cookies when the upload was deleted before the run', () => {
    fs.unlinkSync(uploadedPath);
    const prepared = uploadedCookies.prepare(['--cookies', uploadedPath, '--dump-json']);

    expect(prepared.args).toEqual(['--dump-json']);
    expect(prepared.cleanup).toBeNull();
    expect(logger.info).toHaveBeenCalledWith('Uploaded cookies were deleted before yt-dlp started; running without cookies');
  });

  test('runs without cookies and logs an error when the upload cannot be read', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    });
    const prepared = uploadedCookies.prepare(['--cookies', uploadedPath, '--dump-json']);

    expect(prepared.args).toEqual(['--dump-json']);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.objectContaining({ code: 'EACCES' }) }),
      'Could not read uploaded cookies; running yt-dlp without cookies'
    );
  });

  test('never passes the uploaded file itself when the private copy cannot be written', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('disk full'); });
    const prepared = uploadedCookies.prepare(['--cookies', uploadedPath, '--dump-json']);

    expect(prepared.args).toEqual(['--dump-json']);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Could not make a private copy of uploaded cookies; running yt-dlp without cookies'
    );
  });

  test('removes a partial copy directory when copying fails', () => {
    jest.spyOn(fs, 'writeFileSync').mockImplementationOnce(() => { throw new Error('disk full'); });
    uploadedCookies.prepare(['--cookies', uploadedPath]);

    expect(createdDirs).toHaveLength(1);
    expect(fs.existsSync(createdDirs[0])).toBe(false);
  });
});
