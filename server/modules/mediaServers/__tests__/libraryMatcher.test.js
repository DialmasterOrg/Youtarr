const {
  matchLibraries, mappingFromSample, youtubeIdOf, RELATION_EXACT, RELATION_COVERS, RELATION_INSIDE,
} = require('../libraryMatcher');

const ROOT = '/usr/src/app/data';
const FOLDERS = ['', 'TV Shows', 'Kids'];

const library = (id, ...locations) => ({ id, locations });
const relationsFor = (result, folder) => result.relations.filter((relation) => relation.folder === folder);

describe('libraryMatcher', () => {
  describe('youtubeIdOf', () => {
    test('reads the id in brackets before the extension', () => {
      expect(youtubeIdOf('Q:\\Media\\Show\\Season 2024\\S2024E01 - Title [abcDEF12345].mp4')).toBe('abcDEF12345');
    });

    test('returns null for a file without an id', () => {
      expect(youtubeIdOf('/media/movies/Some Movie (2020).mkv')).toBeNull();
    });
  });

  describe('matchLibraries', () => {
    test('finds a subfolder by its __name and the main folder as its parent', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('41', 'Q:\\Youtube_test\\__TV Shows'), library('37', 'Q:\\Youtube_test')],
        containerRoot: ROOT,
      });

      expect(relationsFor(result, 'TV Shows')).toEqual(expect.arrayContaining([
        expect.objectContaining({ libraryId: '41', relation: RELATION_EXACT, folderSegmentMissing: false }),
        expect.objectContaining({ libraryId: '37', relation: RELATION_COVERS }),
      ]));
      expect(relationsFor(result, '')).toEqual([expect.objectContaining({ libraryId: '37', relation: RELATION_EXACT })]);
    });

    test('compares folder names ignoring case', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('41', '/mnt/media/__tv shows')],
        containerRoot: ROOT,
      });

      expect(relationsFor(result, 'TV Shows')).toEqual([expect.objectContaining({ libraryId: '41', relation: RELATION_EXACT })]);
    });

    test('finds the main folder through a sampled download when no library names a subfolder', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('1', '/media/youtube')],
        samples: [{
          serverPath: '/media/youtube/Some Channel/Some Channel - Title - abcDEF12345/Some Channel - Title [abcDEF12345].mp4',
          containerPath: `${ROOT}/Some Channel/Some Channel - Title - abcDEF12345/Some Channel - Title [abcDEF12345].mp4`,
        }],
        containerRoot: ROOT,
      });

      expect(result.mainKnown).toBe(true);
      expect(relationsFor(result, '')).toEqual([expect.objectContaining({ libraryId: '1', relation: RELATION_EXACT })]);
      expect(relationsFor(result, 'Kids')).toEqual([expect.objectContaining({ libraryId: '1', relation: RELATION_COVERS })]);
    });

    test('flags a library mounted at the folder itself under another name', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('tv', '/tvshows')],
        samples: [{
          serverPath: '/tvshows/Chan/Season 2024/S2024E01011200 - Title [abcDEF12345].mp4',
          containerPath: `${ROOT}/__TV Shows/Chan/Season 2024/S2024E01011200 - Title [abcDEF12345].mp4`,
        }],
        containerRoot: ROOT,
      });

      expect(relationsFor(result, 'TV Shows')).toEqual([
        expect.objectContaining({ libraryId: 'tv', relation: RELATION_EXACT, folderSegmentMissing: true }),
      ]);
      expect(result.mainKnown).toBe(false);
    });

    test('reports a library pointed inside a folder', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('41', 'Q:\\Youtube_test\\__TV Shows'), library('9', 'Q:\\Youtube_test\\__TV Shows\\One Show')],
        containerRoot: ROOT,
      });

      expect(relationsFor(result, 'TV Shows')).toEqual(expect.arrayContaining([
        expect.objectContaining({ libraryId: '9', relation: RELATION_INSIDE }),
      ]));
    });

    test('does not count a library below a subfolder as part of the main folder', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('41', 'Q:\\Youtube_test\\__TV Shows'), library('9', 'Q:\\Youtube_test\\__TV Shows\\One Show')],
        containerRoot: ROOT,
      });

      expect(relationsFor(result, '').map((relation) => relation.libraryId)).not.toContain('9');
    });

    test('limits the scope to libraries related to a folder once the main folder is known', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('41', 'Q:\\Youtube_test\\__TV Shows'), library('2', 'D:\\TV'), library('3', 'Q:\\')],
        containerRoot: ROOT,
      });

      expect(result.scope).toEqual(new Set(['41', '3']));
    });

    test('has no scope when the main folder cannot be found', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('2', 'D:\\TV')],
        containerRoot: ROOT,
      });

      expect(result.scope).toBeNull();
    });

    test('ignores a stale copy the server still lists in another subfolder', () => {
      const result = matchLibraries({
        folders: FOLDERS,
        libraries: [library('41', '/media/__Kids')],
        samples: [{
          serverPath: '/media/__Kids/Chan/Season 2024/S2024E01011200 - Title [abcDEF12345].mp4',
          containerPath: `${ROOT}/__TV Shows/Chan/Season 2024/S2024E01011200 - Title [abcDEF12345].mp4`,
        }],
        containerRoot: ROOT,
      });

      expect(relationsFor(result, 'TV Shows').filter((relation) => relation.relation === RELATION_EXACT)).toEqual([]);
    });

    test('folderPaths keeps a POSIX leading slash', () => {
      const result = matchLibraries({ folders: FOLDERS, libraries: [library('41', '/data/yt/__TV Shows')], containerRoot: ROOT });

      expect(result.folderPaths('')).toEqual([{ path: '/data/yt', source: 'name' }]);
      expect(result.folderPaths('Kids')).toEqual([{ path: '/data/yt/__Kids', source: 'derived' }]);
    });

    test('folderPaths keeps Windows separators and UNC roots', () => {
      const windows = matchLibraries({ folders: FOLDERS, libraries: [library('41', 'Q:\\Youtube_test\\__TV Shows')], containerRoot: ROOT });
      const unc = matchLibraries({ folders: FOLDERS, libraries: [library('41', '\\\\nas\\media\\yt\\__Kids')], containerRoot: ROOT });

      expect(windows.folderPaths('')).toEqual([{ path: 'Q:\\Youtube_test', source: 'name' }]);
      expect(unc.folderPaths('')).toEqual([{ path: '\\\\nas\\media\\yt', source: 'name' }]);
    });
  });

  describe('mappingFromSample', () => {
    const subfolderKeys = new Map([['tv shows', 'TV Shows']]);
    const rootSegments = ROOT.split('/').filter(Boolean);

    test('stops the shared tail at the downloads folder even when the folder names match', () => {
      const mapping = mappingFromSample({
        serverPath: '/srv/data/Chan/Chan - T - abcDEF12345/Chan - T [abcDEF12345].mp4',
        containerPath: `${ROOT}/Chan/Chan - T - abcDEF12345/Chan - T [abcDEF12345].mp4`,
      }, rootSegments, subfolderKeys);

      expect(mapping).toEqual({ folder: '', segments: ['srv', 'data'], style: { separator: '/', root: '/' } });
    });

    test('needs at least the file name and its folder in common', () => {
      const mapping = mappingFromSample({
        serverPath: '/elsewhere/Chan - T [abcDEF12345].mp4',
        containerPath: `${ROOT}/Chan/Chan - T [abcDEF12345].mp4`,
      }, rootSegments, subfolderKeys);

      expect(mapping).toBeNull();
    });
  });
});
