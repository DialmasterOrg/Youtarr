'use strict';
const { addIndexIfMissing, removeIndexIfExists } = require('./helpers');
const INDEXES = [
  ['channelvideos', ['channel_id', 'media_type', 'youtube_removed', 'ignored'], 'channelvideos_external_channel_idx'],
  ['channelvideos', ['youtube_id', 'channel_id'], 'channelvideos_external_youtube_idx'],
  ['channelvideos', ['youtube_removed', 'ignored', 'media_type', 'publishedAt'], 'channelvideos_external_candidates_idx'],
  ['channelvideos', ['youtube_removed', 'ignored', { name: 'media_type', length: 20 }, { name: 'publishedAt', length: 40 }, { name: 'youtube_id', length: 32 }, { name: 'channel_id', length: 64 }], 'channelvideos_external_catalog_seek_idx'],
  ['channels', ['channel_id'], 'channels_external_channel_id_idx'],
  ['channels', ['enabled', 'terminated_at', 'id'], 'channels_external_visibility_idx'],
  ['channels', ['enabled', 'terminated_at', { name: 'sub_folder', length: 191 }], 'channels_external_subfolder_idx'],
];
module.exports = { async up(q) { for (const [table, fields, name] of INDEXES) await addIndexIfMissing(q, table, fields, { name }); }, async down(q) { for (const [table, , name] of [...INDEXES].reverse()) await removeIndexIfExists(q, table, name); }, INDEXES };
