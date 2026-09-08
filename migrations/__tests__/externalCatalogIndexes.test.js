const migration = require('../20260908104000-add-external-catalog-indexes');

function queryInterface(existingNames = []) {
  const indexes = new Set(existingNames);
  return {
    showIndex: jest.fn().mockImplementation(async () =>
      [...indexes].map((name) => ({ name, fields: [] }))
    ),
    addIndex: jest.fn().mockImplementation(async (_table, _fields, options) => {
      indexes.add(options.name);
    }),
    removeIndex: jest.fn().mockImplementation(async (_table, name) => {
      indexes.delete(name);
    }),
  };
}

describe('external catalog query indexes', () => {
  test('adds every named index and is idempotent', async () => {
    const qi = queryInterface();
    await migration.up(qi);
    expect(qi.addIndex).toHaveBeenCalledTimes(migration.INDEXES.length);
    expect(qi.addIndex).toHaveBeenCalledWith(
      'channels',
      ['enabled', 'terminated_at', { name: 'sub_folder', length: 191 }],
      { name: 'channels_external_subfolder_idx' }
    );
    expect(qi.addIndex).toHaveBeenCalledWith(
      'channelvideos',
      [
        'youtube_removed',
        'ignored',
        { name: 'media_type', length: 20 },
        { name: 'published_at', length: 40 },
        { name: 'youtube_id', length: 32 },
        { name: 'channel_id', length: 64 },
      ],
      { name: 'channelvideos_external_catalog_seek_idx' }
    );

    qi.addIndex.mockClear();
    await migration.up(qi);
    expect(qi.addIndex).not.toHaveBeenCalled();
  });

  test('removes only the migration-owned indexes', async () => {
    const names = migration.INDEXES.map(([, , name]) => name);
    const qi = queryInterface([...names, 'unrelated_idx']);
    await migration.down(qi);
    expect(qi.removeIndex).toHaveBeenCalledTimes(names.length);
    expect(qi.removeIndex).not.toHaveBeenCalledWith(
      expect.anything(),
      'unrelated_idx'
    );
  });
});
