/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStaging } = require('../staging');

const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';
const exists = (target) => fs.existsSync(target);

describe('staging', () => {
  let outputRoot;
  let sourcePath;
  let settings;
  let logger;

  function staging(overrides = {}) {
    return createStaging({
      getOutputRoot: () => outputRoot,
      getSettings: () => settings,
      logger,
      ...overrides,
    });
  }

  beforeEach(() => {
    outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arr-staging-test-'));
    const channelDir = path.join(outputRoot, 'NBC', 'The Office - Diversity Day - abcdefghijk');
    fs.mkdirSync(channelDir, { recursive: true });
    sourcePath = path.join(channelDir, 'The Office - Diversity Day [abcdefghijk].mkv');
    fs.writeFileSync(sourcePath, 'video-bytes');
    settings = {
      categories: [{ name: 'tv', subfolder: null }, { name: 'movies', subfolder: null }],
      stagingPath: null,
    };
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  });

  test('the staging root is a hidden folder under the downloads folder', () => {
    expect(staging().stagingRoot()).toBe(path.join(outputRoot, '.arr-staging'));
  });

  describe('stage', () => {
    test('hardlinks the file alone into a folder named like the release', async () => {
      const result = await staging().stage({ category: 'tv', releaseTitle: TITLE, sourcePath });

      const expected = path.join(outputRoot, '.arr-staging', 'tv', TITLE, `${TITLE}.mkv`);
      expect(result).toEqual({ stagedPath: expected, bytes: 11, method: 'hardlink' });
      expect(fs.readdirSync(path.dirname(expected))).toEqual([`${TITLE}.mkv`]);
      expect(fs.statSync(sourcePath).nlink).toBe(2);
      expect(fs.statSync(expected).ino).toBe(fs.statSync(sourcePath).ino);
    });

    test('copies with a warning when the file is on another filesystem', async () => {
      const crossDevice = Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
      const fsp = { ...fs.promises, link: jest.fn().mockRejectedValue(crossDevice) };

      const result = await staging({ fsp }).stage({ category: 'tv', releaseTitle: TITLE, sourcePath });

      expect(result.method).toBe('copy');
      expect(fs.readFileSync(result.stagedPath, 'utf8')).toBe('video-bytes');
      expect(fs.statSync(sourcePath).nlink).toBe(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    test('replaces a stale folder left by an earlier grab of the same release', async () => {
      const folder = path.join(outputRoot, '.arr-staging', 'tv', TITLE);
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'stale.mp4'), 'old');

      await staging().stage({ category: 'tv', releaseTitle: TITLE, sourcePath });

      expect(fs.readdirSync(folder)).toEqual([`${TITLE}.mkv`]);
    });

    test('rejects without leaving a folder when the library file is gone', async () => {
      fs.rmSync(sourcePath);

      await expect(staging().stage({ category: 'tv', releaseTitle: TITLE, sourcePath }))
        .rejects.toMatchObject({ code: 'ENOENT' });

      expect(exists(path.join(outputRoot, '.arr-staging', 'tv', TITLE))).toBe(false);
    });

    test('removes the folder again when linking fails for another reason', async () => {
      const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
      const fsp = { ...fs.promises, link: jest.fn().mockRejectedValue(denied) };

      await expect(staging({ fsp }).stage({ category: 'tv', releaseTitle: TITLE, sourcePath }))
        .rejects.toMatchObject({ code: 'EACCES' });

      expect(exists(path.join(outputRoot, '.arr-staging', 'tv', TITLE))).toBe(false);
    });

    test.each([
      ['a category that is a path', { category: '../x', releaseTitle: TITLE }],
      ['a category with a slash', { category: 'a/b', releaseTitle: TITLE }],
      ['a title that is a parent reference', { category: 'tv', releaseTitle: '..' }],
      ['a title with a slash', { category: 'tv', releaseTitle: 'a/b' }],
    ])('refuses %s before touching the disk', async (_name, target) => {
      await expect(staging().stage({ ...target, sourcePath })).rejects.toThrow(/Invalid/);
      expect(exists(path.join(outputRoot, '.arr-staging'))).toBe(false);
    });
  });

  describe('remove', () => {
    test('deletes that release folder and leaves its neighbors', async () => {
      const subject = staging();
      await subject.stage({ category: 'tv', releaseTitle: TITLE, sourcePath });
      const other = 'The.Office.US.S01E03.1080p.WEB-DL-NBC';
      await subject.stage({ category: 'tv', releaseTitle: other, sourcePath });

      await subject.remove({ category: 'tv', releaseTitle: TITLE });

      const categoryDir = path.join(outputRoot, '.arr-staging', 'tv');
      expect(fs.readdirSync(categoryDir)).toEqual([other]);
      expect(exists(sourcePath)).toBe(true);
    });

    test('is a no-op when the folder is already gone', async () => {
      await expect(staging().remove({ category: 'tv', releaseTitle: TITLE })).resolves.toBeUndefined();
    });

    test('refuses a title that could reach outside the staging folder', async () => {
      await expect(staging().remove({ category: 'tv', releaseTitle: '..' })).rejects.toThrow(/Invalid/);
      expect(exists(sourcePath)).toBe(true);
    });
  });

  describe('clientPath', () => {
    const staged = () => path.join(outputRoot, '.arr-staging', 'tv', TITLE, `${TITLE}.mkv`);

    test('is the local path when no client path is set', () => {
      expect(staging().clientPath(staged())).toBe(staged());
    });

    test('swaps the staging root for the path Sonarr and Radarr see', () => {
      settings.stagingPath = '/downloads/staging';
      expect(staging().clientPath(staged())).toBe(`/downloads/staging/tv/${TITLE}/${TITLE}.mkv`);
      expect(staging().clientPath(staging().stagingRoot())).toBe('/downloads/staging');
    });

    test('leaves a path outside the staging root alone', () => {
      settings.stagingPath = '/downloads/staging';
      expect(staging().clientPath(sourcePath)).toBe(sourcePath);
    });

    test('writes a path on a Windows drive with backslashes', () => {
      settings.stagingPath = 'E:\\Youtube16TB\\.arr-staging';
      expect(staging().clientPath(staged())).toBe(`E:\\Youtube16TB\\.arr-staging\\tv\\${TITLE}\\${TITLE}.mkv`);
      expect(staging().clientPath(staging().stagingRoot())).toBe('E:\\Youtube16TB\\.arr-staging');
    });

    test('writes a path on a Windows share with backslashes', () => {
      settings.stagingPath = '\\\\nas\\videos\\.arr-staging';
      expect(staging().clientPath(staged())).toBe(`\\\\nas\\videos\\.arr-staging\\tv\\${TITLE}\\${TITLE}.mkv`);
    });
  });

  describe('ensureCategoryFolders', () => {
    test('creates a folder per category and the media server ignore files', async () => {
      await staging().ensureCategoryFolders();

      const root = path.join(outputRoot, '.arr-staging');
      expect(fs.readdirSync(root).sort()).toEqual(['.ignore', '.plexignore', 'movies', 'tv']);
      expect(fs.readFileSync(path.join(root, '.plexignore'), 'utf8')).toBe('*\n');
    });

    test('is safe to repeat and keeps staged files', async () => {
      const subject = staging();
      await subject.ensureCategoryFolders();
      const { stagedPath } = await subject.stage({ category: 'tv', releaseTitle: TITLE, sourcePath });

      await subject.ensureCategoryFolders();

      expect(exists(stagedPath)).toBe(true);
    });
  });
});
