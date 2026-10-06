jest.mock('../../../logger');

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const logger = require('../../../logger');
const {
  resolveLibraryFolder,
  locateEpisodeFolders,
  cleanupEmptyShowFolders,
  cleanupOrphanShowFolder
} = require('../showFolderCleanup');

describe('showFolderCleanup', () => {
  const baseDir = '/downloads';

  describe('resolveLibraryFolder', () => {
    it('places a path outside any subfolder in the main folder', () => {
      expect(resolveLibraryFolder('/downloads/Show/Season 2024/ep.mp4', baseDir))
        .toEqual({ libraryFolder: '', libraryRoot: '/downloads' });
    });

    it('places a path under a __subfolder in that subfolder, named without the prefix', () => {
      expect(resolveLibraryFolder('/downloads/__TV Shows/Show/Season 01/ep.mp4', baseDir))
        .toEqual({ libraryFolder: 'TV Shows', libraryRoot: '/downloads/__TV Shows' });
    });

    it.each([
      ['the downloads folder itself', '/downloads'],
      ['a subfolder itself', '/downloads/__kids'],
      ['a path outside the downloads folder', '/elsewhere/Show/Season 01/ep.mp4'],
    ])('returns null for %s', (_label, targetPath) => {
      expect(resolveLibraryFolder(targetPath, baseDir)).toBeNull();
    });
  });

  describe('locateEpisodeFolders', () => {
    it('returns the season and show folders of an episode in a season folder', () => {
      expect(locateEpisodeFolders('/downloads/__tv/Show/Season 2024/S2024E01151200 - T [abcdefghijk].mp4', '/downloads/__tv'))
        .toEqual({ showDir: '/downloads/__tv/Show', seasonDir: '/downloads/__tv/Show/Season 2024' });
    });

    it('accepts Season 00', () => {
      expect(locateEpisodeFolders('/downloads/Show/Season 00/S00E03 - T [abcdefghijk].mp4', baseDir))
        .toEqual({ showDir: '/downloads/Show', seasonDir: '/downloads/Show/Season 00' });
    });

    it.each([
      ['a per-video folder', '/downloads/Channel/Channel - Title - abcdefghijk/Channel - Title [abcdefghijk].mp4'],
      ['a flat channel folder', '/downloads/Channel/Channel - Title [abcdefghijk].mp4'],
      ['a deeper folder', '/downloads/Show/Season 01/extra/ep [abcdefghijk].mp4'],
      ['a show folder named like a subfolder', '/downloads/__kids/Season 01/ep [abcdefghijk].mp4'],
      ['a hidden show folder', '/downloads/.trash/Season 01/ep [abcdefghijk].mp4'],
      ['a folder that is only almost a season folder', '/downloads/Show/Season one/ep [abcdefghijk].mp4'],
    ])('returns null for %s', (_label, filePath) => {
      expect(locateEpisodeFolders(filePath, baseDir)).toBeNull();
    });
  });

  describe('on disk', () => {
    let tmp;
    let showDir;
    let seasonDir;

    beforeEach(async () => {
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'tvclean-'));
      showDir = path.join(tmp, 'Show');
      seasonDir = path.join(showDir, 'Season 2024');
      await fs.ensureDir(seasonDir);
      await fs.writeFile(path.join(showDir, 'tvshow.nfo'), '<tvshow/>');
      await fs.writeFile(path.join(showDir, 'poster.jpg'), 'x');
      await fs.writeFile(path.join(showDir, 'backdrop.jpg'), 'x');
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
      await fs.remove(tmp);
    });

    // chmod 000 does not stop root, so unreadable folders are simulated.
    const failFsCall = (method, failingPath, code) => {
      const fsPromises = require('fs').promises;
      const original = fsPromises[method].bind(fsPromises);
      jest.spyOn(fsPromises, method).mockImplementation((target, ...rest) => {
        if (target === failingPath) {
          return Promise.reject(Object.assign(new Error(`${code}: ${method} ${target}`), { code }));
        }
        return original(target, ...rest);
      });
    };

    describe('cleanupEmptyShowFolders', () => {
      it('removes a season folder holding only season metadata, then the show folder', async () => {
        await fs.writeFile(path.join(seasonDir, 'season.nfo'), '<season/>');
        await fs.writeFile(path.join(seasonDir, '.DS_Store'), 'x');

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect({ result, showExists: await fs.pathExists(showDir) })
          .toEqual({ result: { removedSeason: true, removedShow: true }, showExists: false });
      });

      it('keeps a season folder that still holds another episode', async () => {
        await fs.writeFile(path.join(seasonDir, 'S2024E02011200 - Other [bbbbbbbbbbb].mp4'), 'x');

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect(result).toEqual({ removedSeason: false, removedShow: false });
      });

      it('keeps the show folder while another season folder exists', async () => {
        await fs.ensureDir(path.join(showDir, 'Season 2023'));

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect({ result, showExists: await fs.pathExists(path.join(showDir, 'tvshow.nfo')) })
          .toEqual({ result: { removedSeason: true, removedShow: false }, showExists: true });
      });

      it('keeps the show folder when it holds a file that is not show metadata', async () => {
        await fs.writeFile(path.join(showDir, 'notes.txt'), 'x');

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect(result).toEqual({ removedSeason: true, removedShow: false });
      });

      it('does not treat tvshow.nfo as removable inside a season folder', async () => {
        await fs.writeFile(path.join(seasonDir, 'tvshow.nfo'), '<tvshow/>');

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect(result).toEqual({ removedSeason: false, removedShow: false });
      });

      it('reports nothing removed when the season folder is already gone', async () => {
        await fs.remove(seasonDir);

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect(result).toEqual({ removedSeason: false, removedShow: false });
      });

      it('warns when the show folder cannot be removed after its metadata was deleted', async () => {
        failFsCall('rmdir', showDir, 'EBUSY');

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect({ result, warned: logger.warn.mock.calls.map(([context]) => [context.dirPath, context.deleted.sort()]) })
          .toEqual({
            result: { removedSeason: true, removedShow: false },
            warned: [[showDir, ['backdrop.jpg', 'poster.jpg', 'tvshow.nfo']]]
          });
      });

      it('does not warn about a season folder it could not read', async () => {
        failFsCall('readdir', seasonDir, 'EACCES');

        const result = await cleanupEmptyShowFolders({ showDir, seasonDir });

        expect({ result, warnings: logger.warn.mock.calls.length })
          .toEqual({ result: { removedSeason: false, removedShow: false }, warnings: 0 });
      });
    });

    describe('cleanupOrphanShowFolder', () => {
      it('removes empty season folders and then the emptied show folder', async () => {
        await fs.ensureDir(path.join(showDir, 'Season 2023'));

        const removed = await cleanupOrphanShowFolder(showDir);

        expect(removed.sort()).toEqual([showDir, path.join(showDir, 'Season 2023'), seasonDir].sort());
      });

      it('keeps season folders with episodes and the show that holds them', async () => {
        await fs.writeFile(path.join(seasonDir, 'S2024E01151200 - T [abcdefghijk].mp4'), 'x');
        await fs.ensureDir(path.join(showDir, 'Season 2023'));

        const removed = await cleanupOrphanShowFolder(showDir);

        expect(removed).toEqual([path.join(showDir, 'Season 2023')]);
      });

      it('never removes a folder that is not a season folder, and keeps the show for it', async () => {
        await fs.remove(seasonDir);
        await fs.ensureDir(path.join(showDir, 'Extras'));

        const removed = await cleanupOrphanShowFolder(showDir);

        expect({ removed, extrasExists: await fs.pathExists(path.join(showDir, 'Extras')) })
          .toEqual({ removed: [], extrasExists: true });
      });

      it('skips a folder it cannot list instead of throwing, like lost+found', async () => {
        const lostFound = path.join(tmp, 'lost+found');
        await fs.ensureDir(lostFound);
        failFsCall('readdir', lostFound, 'EACCES');

        await expect(cleanupOrphanShowFolder(lostFound)).resolves.toEqual([]);
      });
    });
  });
});
