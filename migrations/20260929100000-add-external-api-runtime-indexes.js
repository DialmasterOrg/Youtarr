'use strict';

const { indexExists, removeIndexIfExists } = require('./helpers');

// These columns follow the catalog reads' equality filters and cursor order.
// Keep the channel_id index out of this migration: the current non-unique
// lookup migration already provides it and existing installations may contain
// duplicate channel rows.
const INDEXES = [
  {
    table: 'channelvideos',
    fields: ['channel_id', 'media_type', 'youtube_removed', 'ignored'],
    name: 'channelvideos_external_channel_idx',
  },
  {
    table: 'channelvideos',
    fields: ['youtube_removed', 'ignored', 'media_type', 'published_at'],
    name: 'channelvideos_external_candidates_idx',
  },
  {
    table: 'channels',
    fields: ['enabled', 'terminated_at', 'id'],
    name: 'channels_external_visibility_idx',
  },
  {
    table: 'channels',
    fields: ['enabled', 'terminated_at', { name: 'sub_folder', length: 191 }],
    name: 'channels_external_subfolder_idx',
  },
  {
    table: 'external_requests',
    fields: ['api_key_id', 'request_type', 'youtube_id', 'created_at', 'id'],
    name: 'external_requests_catalog_status_idx',
  },
  {
    table: 'external_requests',
    fields: ['request_type', 'status', 'created_at', 'id'],
    name: 'external_requests_management_idx',
  },
];

module.exports = {
  async up(queryInterface) {
    for (const { table, fields, name } of INDEXES) {
      // Match fields, rather than only the migration's preferred name, so a
      // pre-existing equivalent index does not create redundant storage.
      if (await indexExists(queryInterface, table, { fields })) continue;
      await queryInterface.addIndex(table, fields, { name });
    }
  },

  async down(queryInterface) {
    for (const { table, name } of [...INDEXES].reverse()) {
      await removeIndexIfExists(queryInterface, table, name);
    }
  },

  INDEXES,
};
