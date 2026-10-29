const { deletionBlockers, deletionBlockReason } = require('../subfolderDeletion');

const unused = { channels: 0, disabledChannels: 0, playlists: 0, shows: 0, isDefault: false, hasFiles: false };

describe('subfolderDeletion', () => {
  test('lists every blocker in guard order', () => {
    expect(deletionBlockers({
      channels: 2, disabledChannels: 1, playlists: 3, shows: 1, isDefault: true, hasFiles: true,
    })).toEqual([
      { code: 'channels', count: 2 },
      { code: 'disabledChannels', count: 1 },
      { code: 'playlists', count: 3 },
      { code: 'shows', count: 1 },
      { code: 'default' },
      { code: 'files' },
    ]);
  });

  test('an unused empty folder has no blockers', () => {
    expect(deletionBlockers(unused)).toEqual([]);
    expect(deletionBlockReason(unused)).toBeNull();
  });

  test('keeps today\'s message, counting enabled and disabled channels together', () => {
    expect(deletionBlockReason({ ...unused, channels: 1, disabledChannels: 2 }))
      .toBe('Subfolder is in use by 3 channel(s)');
    expect(deletionBlockReason({ ...unused, disabledChannels: 1 })).toBe('Subfolder is in use by 1 channel(s)');
  });

  test('reports the first blocker only', () => {
    expect(deletionBlockReason({ ...unused, isDefault: true, hasFiles: true }))
      .toBe('Subfolder is the global default and cannot be deleted');
    expect(deletionBlockReason({ ...unused, hasFiles: true }))
      .toBe('Subfolder still contains downloaded files and cannot be deleted');
  });
});
