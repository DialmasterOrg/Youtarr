'use strict';

const { collectBackfillNames } = require('../lib/subfolderBackfill');

const BASE = '/usr/src/app/data';

describe('collectBackfillNames', () => {
  test('unions channel, playlist, and filePath-derived names, excluding sentinels/null', () => {
    const names = collectBackfillNames({
      channelSubFolders: ['Library1', null, '##USE_GLOBAL_DEFAULT##'],
      playlistSubFolders: ['Library1', 'Music', '##ROOT##'],
      videoPaths: [
        `${BASE}/__Library2/Chan/Vid - abcdefghijk/abcdefghijk.mp4`,
        `${BASE}/Chan/Vid - abcdefghijk/abcdefghijk.mp4`, // root, no subfolder
      ],
      baseDir: BASE,
    });
    expect(names.sort()).toEqual(['Library1', 'Library2', 'Music']);
  });

  test('anchored parse: a __ segment below the channel dir is not read as a subfolder', () => {
    const names = collectBackfillNames({
      channelSubFolders: [],
      playlistSubFolders: [],
      // First segment after baseDir is the channel "MrBeast" (root, no subfolder).
      // A deeper folder happening to start with __ must NOT be mistaken for one.
      videoPaths: [`${BASE}/MrBeast/__odd - abcdefghijk/abcdefghijk.mp4`],
      baseDir: BASE,
    });
    expect(names).toEqual([]);
  });

  test('case/accent-equivalent names are de-duplicated to one (first-seen wins)', () => {
    const names = collectBackfillNames({
      channelSubFolders: ['Cafe', 'Café', 'cafe'],
      playlistSubFolders: [],
      videoPaths: [],
      baseDir: BASE,
    });
    expect(names).toEqual(['Cafe']);
  });
});
