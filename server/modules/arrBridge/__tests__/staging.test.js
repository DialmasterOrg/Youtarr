/* eslint-env jest */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStaging } = require('../staging');

const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';
const YOUTUBE_ID = 'abcdefghijk';
const PIPE_RELEASE_MS = 500;
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
      expect(result).toEqual({ stagedPath: expected, bytes: 11, method: 'hardlink', subtitles: 0 });
      expect(fs.readdirSync(path.dirname(expected))).toEqual([`${TITLE}.mkv`]);
      expect(fs.statSync(sourcePath).nlink).toBe(2);
      expect(fs.statSync(expected).ino).toBe(fs.statSync(sourcePath).ino);
    });

    describe('subtitles', () => {
      const target = () => ({ category: 'tv', releaseTitle: TITLE, sourcePath, youtubeId: YOUTUBE_ID });
      const stagedFolder = () => path.join(outputRoot, '.arr-staging', 'tv', TITLE);
      const librarySubtitle = (code) => path.join(
        path.dirname(sourcePath), `The Office - Diversity Day [${YOUTUBE_ID}].${code}.srt`
      );

      test('puts a subtitle beside the video, named like the release with a short language code', async () => {
        fs.writeFileSync(librarySubtitle('en-GB'), 'subtitle-text');

        const result = await staging().stage(target());

        expect(fs.readdirSync(stagedFolder()).sort()).toEqual([`${TITLE}.en.srt`, `${TITLE}.mkv`]);
        expect(fs.readFileSync(path.join(stagedFolder(), `${TITLE}.en.srt`), 'utf8')).toBe('subtitle-text');
        expect(result.subtitles).toBe(1);
      });

      // A tool that edits a subtitle in place must not reach the library file.
      test('copies a subtitle, never links it', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'subtitle-text');

        await staging().stage(target());

        const staged = path.join(stagedFolder(), `${TITLE}.en.srt`);
        expect(fs.statSync(staged).ino).not.toBe(fs.statSync(librarySubtitle('en')).ino);
        expect(fs.statSync(librarySubtitle('en')).nlink).toBe(1);
      });

      test('stages every track of a language, numbered', async () => {
        fs.writeFileSync(librarySubtitle('en-CA'), 'canadian');
        fs.writeFileSync(librarySubtitle('en-GB'), 'british');

        const result = await staging().stage(target());

        expect(fs.readFileSync(path.join(stagedFolder(), `${TITLE}.1.en.srt`), 'utf8')).toBe('canadian');
        expect(fs.readFileSync(path.join(stagedFolder(), `${TITLE}.2.en.srt`), 'utf8')).toBe('british');
        expect(result.subtitles).toBe(2);
      });

      // YouTube lists one English track under en, en-CA and en-GB on some videos.
      test('stages tracks of one language that hold the same text only once', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'same-text');
        fs.writeFileSync(librarySubtitle('en-CA'), 'same-text');
        fs.writeFileSync(librarySubtitle('en-GB'), 'british');

        const result = await staging().stage(target());

        expect(fs.readdirSync(stagedFolder()).sort()).toEqual([
          `${TITLE}.1.en.srt`, `${TITLE}.2.en.srt`, `${TITLE}.mkv`,
        ]);
        expect(fs.readFileSync(path.join(stagedFolder(), `${TITLE}.1.en.srt`), 'utf8')).toBe('same-text');
        expect(fs.readFileSync(path.join(stagedFolder(), `${TITLE}.2.en.srt`), 'utf8')).toBe('british');
        expect(result.subtitles).toBe(2);
      });

      test('drops the number when the tracks of a language are all the same', async () => {
        fs.writeFileSync(librarySubtitle('en-CA'), 'same-text');
        fs.writeFileSync(librarySubtitle('en-GB'), 'same-text');

        await staging().stage(target());

        expect(fs.readdirSync(stagedFolder()).sort()).toEqual([`${TITLE}.en.srt`, `${TITLE}.mkv`]);
      });

      test('keeps tracks of different languages that hold the same text', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'same-text');
        fs.writeFileSync(librarySubtitle('es'), 'same-text');

        await staging().stage(target());

        expect(fs.readdirSync(stagedFolder()).sort()).toEqual([
          `${TITLE}.en.srt`, `${TITLE}.es.srt`, `${TITLE}.mkv`,
        ]);
      });

      // A video can have a subtitle per language YouTube translates to; only
      // one language's files are held in memory at a time.
      test('stages the tracks of one language before it reads the next', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'english');
        fs.writeFileSync(librarySubtitle('es'), 'spanish');
        const opened = [];
        const open = jest.fn((file, ...rest) => {
          opened.push(path.basename(file));
          return fs.promises.open(file, ...rest);
        });

        await staging({ fsp: { ...fs.promises, open } }).stage(target());

        expect(opened).toEqual([
          `The Office - Diversity Day [${YOUTUBE_ID}].en.srt`,
          `${TITLE}.en.srt`,
          `The Office - Diversity Day [${YOUTUBE_ID}].es.srt`,
          `${TITLE}.es.srt`,
        ]);
      });

      test('stages the video with the other subtitles when one cannot be read', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'english');
        fs.writeFileSync(librarySubtitle('es'), 'spanish');
        const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
        const open = jest.fn((target, ...rest) => (
          target === librarySubtitle('en') ? Promise.reject(denied) : fs.promises.open(target, ...rest)
        ));

        const result = await staging({ fsp: { ...fs.promises, open } }).stage(target());

        expect(fs.readdirSync(stagedFolder()).sort()).toEqual([`${TITLE}.es.srt`, `${TITLE}.mkv`]);
        expect(result).toMatchObject({ method: 'hardlink', subtitles: 1 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      test('leaves no half-written subtitle behind when a write fails', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'english');
        fs.writeFileSync(librarySubtitle('es'), 'spanish');
        const stagedEnglish = path.join(stagedFolder(), `${TITLE}.en.srt`);
        const full = Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
        const open = jest.fn(async (target, ...rest) => {
          const handle = await fs.promises.open(target, ...rest);
          if (target !== stagedEnglish) return handle;
          return {
            writeFile: async () => {
              await handle.writeFile('eng');
              throw full;
            },
            close: () => handle.close(),
          };
        });

        const result = await staging({ fsp: { ...fs.promises, open } }).stage(target());

        expect(fs.readdirSync(stagedFolder()).sort()).toEqual([`${TITLE}.es.srt`, `${TITLE}.mkv`]);
        expect(result).toMatchObject({ method: 'hardlink', subtitles: 1 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      // The library folder may be a share others write to: a link named like
      // a subtitle could point at any file the server can read.
      test('does not hand over the target of a link named like a subtitle', async () => {
        const elsewhere = path.join(outputRoot, 'elsewhere.txt');
        fs.writeFileSync(elsewhere, 'not a subtitle');
        fs.symlinkSync(elsewhere, librarySubtitle('en'));

        const result = await staging().stage(target());

        expect(fs.readdirSync(stagedFolder())).toEqual([`${TITLE}.mkv`]);
        expect(result).toMatchObject({ method: 'hardlink', subtitles: 0 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      test('is not held up by a pipe named like a subtitle', async () => {
        execFileSync('mkfifo', [librarySubtitle('en')]);
        // Releases any reader that waits on the pipe after all, so a regression
        // ends as a failed test and not as a run that never exits.
        const release = setInterval(() => {
          try {
            fs.closeSync(fs.openSync(librarySubtitle('en'), fs.constants.O_WRONLY | fs.constants.O_NONBLOCK));
          } catch (error) {
            // No reader was waiting.
          }
        }, PIPE_RELEASE_MS);

        try {
          const result = await staging().stage(target());

          expect(fs.readdirSync(stagedFolder())).toEqual([`${TITLE}.mkv`]);
          expect(result).toMatchObject({ method: 'hardlink', subtitles: 0 });
          expect(logger.warn).toHaveBeenCalledTimes(1);
        } finally {
          clearInterval(release);
        }
      });

      test('leaves a file larger than any subtitle out', async () => {
        fs.writeFileSync(librarySubtitle('en'), '');
        fs.truncateSync(librarySubtitle('en'), 10 * 1024 * 1024 + 1);

        const result = await staging().stage(target());

        expect(fs.readdirSync(stagedFolder())).toEqual([`${TITLE}.mkv`]);
        expect(result).toMatchObject({ method: 'hardlink', subtitles: 0 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      // The staging folder is shared with the apps: an entry that appears at
      // the subtitle's name is neither written through nor removed.
      test('neither follows nor removes an entry someone else put at the subtitle name', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'english');
        const theirs = path.join(outputRoot, 'theirs.txt');
        fs.writeFileSync(theirs, 'their file');
        const stagedEnglish = path.join(stagedFolder(), `${TITLE}.en.srt`);
        const mkdir = jest.fn(async (folder, options) => {
          await fs.promises.mkdir(folder, options);
          if (folder === stagedFolder()) fs.symlinkSync(theirs, stagedEnglish);
        });

        const result = await staging({ fsp: { ...fs.promises, mkdir } }).stage(target());

        expect(fs.readFileSync(theirs, 'utf8')).toBe('their file');
        expect(fs.readlinkSync(stagedEnglish)).toBe(theirs);
        expect(result).toMatchObject({ method: 'hardlink', subtitles: 0 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });

      test('stages the video alone when the library folder cannot be listed', async () => {
        fs.writeFileSync(librarySubtitle('en'), 'english');
        const unreadable = Object.assign(new Error('input/output error'), { code: 'EIO' });
        const fsp = { ...fs.promises, readdir: jest.fn().mockRejectedValue(unreadable) };

        const result = await staging({ fsp }).stage(target());

        expect(fs.readdirSync(stagedFolder())).toEqual([`${TITLE}.mkv`]);
        expect(result).toMatchObject({ method: 'hardlink', subtitles: 0 });
        expect(logger.warn).toHaveBeenCalledTimes(1);
      });
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
