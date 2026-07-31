'use strict';
const { createTableIfNotExists, dropTableIfExists, addIndexIfMissing } = require('./helpers');
module.exports = {
  async up(q, S) {
    await createTableIfNotExists(q, 'api_key_channel_grants', {
      id: { type: S.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      api_key_id: { type: S.INTEGER, allowNull: false, references: { model: 'ApiKeys', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      channel_id: { type: S.INTEGER, allowNull: false, references: { model: 'channels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await addIndexIfMissing(q, 'api_key_channel_grants', ['api_key_id', 'channel_id'], { unique: true, name: 'api_key_channel_grants_key_channel_uq' });
    await addIndexIfMissing(q, 'api_key_channel_grants', ['channel_id'], { name: 'api_key_channel_grants_channel_idx' });
  },
  async down(q) { await dropTableIfExists(q, 'api_key_channel_grants'); },
};
