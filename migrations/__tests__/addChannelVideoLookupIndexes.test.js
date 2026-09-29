'use strict';

const migration = require('../20260925165655-add-channel-video-lookup-indexes');

function indexInterface(existing = {}) {
  const indexes = {
    channelvideos: [],
    videos: [],
    channels: [],
    ...existing,
  };
  return {
    indexes,
    showIndex: async (table) => indexes[table].map(({ name, fields, unique }) => ({
      name,
      unique: Boolean(unique),
      fields: fields.map((attribute) => ({ attribute })),
    })),
    addIndex: async (table, fields, options) => {
      indexes[table].push({ name: options.name, fields, unique: Boolean(options.unique) });
    },
    removeIndex: async (table, name) => {
      indexes[table] = indexes[table].filter((index) => index.name !== name);
    },
  };
}

describe('channel video lookup indexes migration', () => {
  test('adds the composite channelvideos index', async () => {
    const qi = indexInterface();
    await migration.up(qi);
    expect(qi.indexes.channelvideos).toContainEqual(
      { name: 'channelvideos_channel_id_youtube_id_idx', fields: ['channel_id', 'youtube_id'], unique: false }
    );
  });

  test('adds the lowercase videos and channels indexes', async () => {
    const qi = indexInterface();
    await migration.up(qi);
    expect([qi.indexes.videos, qi.indexes.channels]).toEqual([
      [{ name: 'videos_channel_id_idx', fields: ['channel_id'], unique: false }],
      [{ name: 'channels_channel_id_idx', fields: ['channel_id'], unique: false }],
    ]);
  });

  test('creates only non-unique indexes', async () => {
    const qi = indexInterface();
    await migration.up(qi);
    const all = Object.values(qi.indexes).flat();
    expect(all.some((index) => index.unique)).toBe(false);
  });

  test('skips columns that already have an index under another name', async () => {
    const qi = indexInterface({ channels: [{ name: 'custom_channel_id', fields: ['channel_id'] }] });
    await migration.up(qi);
    expect(qi.indexes.channels.map((index) => index.name)).toEqual(['custom_channel_id']);
  });

  test('running up twice does not duplicate indexes', async () => {
    const qi = indexInterface();
    await migration.up(qi);
    await migration.up(qi);
    expect(Object.values(qi.indexes).flat()).toHaveLength(4);
  });

  test('down removes the added indexes', async () => {
    const qi = indexInterface();
    await migration.up(qi);
    await migration.down(qi);
    expect(Object.values(qi.indexes).flat()).toEqual([]);
  });
});
