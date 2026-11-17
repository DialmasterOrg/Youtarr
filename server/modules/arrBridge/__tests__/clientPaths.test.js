/* eslint-env jest */
const {
  normalizeStagingPath, separatorOf, joinClientPath, withTrailingSeparator, hostPathCandidates, applyMapping,
} = require('../clientPaths');

describe('clientPaths', () => {
  describe('normalizeStagingPath', () => {
    test.each([
      ['/data/youtube/.arr-staging', '/data/youtube/.arr-staging'],
      ['  /data/youtube/.arr-staging/  ', '/data/youtube/.arr-staging'],
      ['/downloads/.arr-staging// /', '/downloads/.arr-staging'],
      ['E:\\Youtube16TB\\.arr-staging', 'E:\\Youtube16TB\\.arr-staging'],
      ['E:\\Youtube16TB\\.arr-staging\\', 'E:\\Youtube16TB\\.arr-staging'],
      ['e:/Youtube16TB/.arr-staging/', 'e:\\Youtube16TB\\.arr-staging'],
      ['E:\\My Videos\\.arr-staging', 'E:\\My Videos\\.arr-staging'],
      ['\\\\nas\\videos\\.arr-staging', '\\\\nas\\videos\\.arr-staging'],
      ['\\\\nas\\arr-staging\\', '\\\\nas\\arr-staging'],
      ['\\\\nas/videos/.arr-staging', '\\\\nas\\videos\\.arr-staging'],
    ])('accepts %s', (value, expected) => {
      expect(normalizeStagingPath(value)).toBe(expected);
    });

    test.each([
      ['a relative path', 'downloads/.arr-staging'],
      ['a folder above', '/data/../etc'],
      ['a folder above on a drive', 'E:\\Videos\\..\\Windows'],
      ['a drive with no folder', 'E:\\'],
      ['a drive letter alone', 'E:'],
      ['a drive-relative path', 'E:Videos'],
      ['a server with no share', '\\\\nas'],
      ['only slashes', '///'],
      ['an empty value', '   '],
      ['a line break', '/data/.arr-staging\n/etc'],
      ['a path over 500 characters', `/${'x'.repeat(500)}`],
      ['something that is not text', 7],
    ])('refuses %s', (_name, value) => {
      expect(normalizeStagingPath(value)).toBeNull();
    });
  });

  test('a path is written with its own separator', () => {
    expect(separatorOf('/data/.arr-staging')).toBe('/');
    expect(separatorOf('E:\\Videos\\.arr-staging')).toBe('\\');
    expect(separatorOf('\\\\nas\\videos')).toBe('\\');
  });

  test('joinClientPath adds names below a path with that separator', () => {
    expect(joinClientPath('/data/.arr-staging', ['tv', 'Show.S01E01', 'Show.S01E01.mkv']))
      .toBe('/data/.arr-staging/tv/Show.S01E01/Show.S01E01.mkv');
    expect(joinClientPath('E:\\Videos\\.arr-staging', ['tv', 'Show.S01E01', 'Show.S01E01.mkv']))
      .toBe('E:\\Videos\\.arr-staging\\tv\\Show.S01E01\\Show.S01E01.mkv');
    expect(joinClientPath('\\\\nas\\videos\\.arr-staging', ['movies']))
      .toBe('\\\\nas\\videos\\.arr-staging\\movies');
  });

  test('withTrailingSeparator ends a path with exactly one of its separators', () => {
    expect(withTrailingSeparator('/data/.arr-staging')).toBe('/data/.arr-staging/');
    expect(withTrailingSeparator('/data/.arr-staging//')).toBe('/data/.arr-staging/');
    expect(withTrailingSeparator('E:\\Videos\\.arr-staging')).toBe('E:\\Videos\\.arr-staging\\');
    expect(withTrailingSeparator('E:\\Videos\\.arr-staging\\')).toBe('E:\\Videos\\.arr-staging\\');
  });

  describe('hostPathCandidates', () => {
    test.each([
      ['Git Bash style', '/e/Youtube16TB'],
      ['WSL style', '/mnt/e/Youtube16TB'],
      ['a Docker Desktop mount', '/host_mnt/e/Youtube16TB'],
      ['a Docker Desktop WSL mount', '/run/desktop/mnt/host/e/Youtube16TB'],
      ['a drive path with forward slashes', 'E:/Youtube16TB/'],
      ['a drive path', 'E:\\Youtube16TB'],
    ])('for an app on Windows, a downloads folder in %s is its drive path', (_name, downloadsFolder) => {
      expect(hostPathCandidates(downloadsFolder, { windows: true })).toEqual(['E:\\Youtube16TB\\.arr-staging']);
    });

    test('a downloads folder that is a whole drive', () => {
      expect(hostPathCandidates('/mnt/e', { windows: true })).toEqual(['E:\\.arr-staging']);
    });

    test('a share is kept as it is', () => {
      expect(hostPathCandidates('\\\\nas\\videos', { windows: true })).toEqual(['\\\\nas\\videos\\.arr-staging']);
    });

    test('for any other app, the host folder as it is', () => {
      expect(hostPathCandidates('/mnt/user/media/youtube/', { windows: false }))
        .toEqual(['/mnt/user/media/youtube/.arr-staging']);
    });

    test.each([
      ['a Linux folder, for an app on Windows', '/mnt/user/media/youtube', true],
      ['a Linux folder with a one-letter start that goes on, for an app on Windows', '/data/youtube', true],
      ['a drive path, for an app that is not on Windows', 'E:\\Youtube16TB', false],
      ['a relative folder', 'downloads', false],
      ['no folder', null, false],
      ['an empty folder', '  ', true],
    ])('has no guess for %s', (_name, downloadsFolder, windows) => {
      expect(hostPathCandidates(downloadsFolder, { windows })).toEqual([]);
    });
  });

  describe('applyMapping', () => {
    const REPORTED = '/usr/src/app/data/.arr-staging';

    test.each([
      ['the folder itself', '/usr/src/app/data/.arr-staging/', 'E:\\Youtube16TB\\.arr-staging\\', 'E:\\Youtube16TB\\.arr-staging'],
      ['the folder without a trailing slash', '/usr/src/app/data/.arr-staging', 'E:\\Youtube16TB\\.arr-staging', 'E:\\Youtube16TB\\.arr-staging'],
      ['a folder above it', '/usr/src/app/data/', 'E:\\Youtube16TB\\', 'E:\\Youtube16TB\\.arr-staging'],
      ['a folder two levels above', '/usr/src/app/', 'Z:\\youtarr', 'Z:\\youtarr\\data\\.arr-staging'],
      ['the root', '/', 'Z:\\', 'Z:\\usr\\src\\app\\data\\.arr-staging'],
      ['a folder above it, to a Linux path', '/usr/src/app/data/', '/mnt/media/youtube/', '/mnt/media/youtube/.arr-staging'],
    ])('a Remote Path that is %s', (_name, remotePath, localPath, expected) => {
      expect(applyMapping(REPORTED, { remotePath, localPath })).toBe(expected);
    });

    test.each([
      ['another folder', '/downloads/', 'E:\\Downloads\\'],
      ['a folder whose name only starts the same', '/usr/src/app/data/.arr', 'E:\\x'],
      ['a folder below it', '/usr/src/app/data/.arr-staging/tv/', 'E:\\x'],
      ['another letter case', '/USR/src/app/data/', 'E:\\x'],
    ])('does not apply for %s', (_name, remotePath, localPath) => {
      expect(applyMapping(REPORTED, { remotePath, localPath })).toBeNull();
    });

    test('a Windows path reported matches its Remote Path without case', () => {
      expect(applyMapping('E:\\Youtube16TB\\.arr-staging', { remotePath: 'e:\\youtube16tb\\', localPath: '/data/youtube/' }))
        .toBe('/data/youtube/.arr-staging');
    });

    test.each([
      ['a missing Local Path', { remotePath: '/usr/src/app/data/' }],
      ['an empty Local Path', { remotePath: '/usr/src/app/data/', localPath: ' ' }],
      ['a Local Path that is not text', { remotePath: '/usr/src/app/data/', localPath: 7 }],
      ['a Local Path with a line break', { remotePath: '/usr/src/app/data/', localPath: 'E:\\x\n' }],
      ['an overlong Local Path', { remotePath: '/usr/src/app/data/', localPath: `E:\\${'x'.repeat(1000)}` }],
      ['no mapping', undefined],
    ])('ignores %s', (_name, mapping) => {
      expect(applyMapping(REPORTED, mapping)).toBeNull();
    });
  });
});
