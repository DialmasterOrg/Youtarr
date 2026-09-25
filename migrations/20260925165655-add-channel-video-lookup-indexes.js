'use strict';

const { indexExists, removeIndexIfExists } = require('./helpers');

// Non-unique on purpose: some installs carry duplicate channels.channel_id
// rows and duplicate (channel_id, youtube_id) channelvideos pairs, which a
// unique index would refuse to build, aborting startup.
const INDEXES = [
  { table: 'channelvideos', fields: ['channel_id', 'youtube_id'], name: 'channelvideos_channel_id_youtube_id_idx' },
  { table: 'channelvideos', fields: ['youtube_id'], name: 'channelvideos_youtube_id_idx' },
  { table: 'videos', fields: ['channel_id'], name: 'videos_channel_id_idx' },
  { table: 'channels', fields: ['channel_id'], name: 'channels_channel_id_idx' },
];

module.exports = {
  async up(queryInterface) {
    for (const { table, fields, name } of INDEXES) {
      // Skip when an index on the same columns already exists under any name.
      if (await indexExists(queryInterface, table, { fields })) continue;
      await queryInterface.addIndex(table, fields, { name });
    }
  },

  async down(queryInterface) {
    for (const { table, name } of INDEXES) {
      await removeIndexIfExists(queryInterface, table, name);
    }
  },
};
