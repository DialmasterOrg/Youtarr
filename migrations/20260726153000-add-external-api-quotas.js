'use strict';
const { addColumnIfMissing, removeColumnIfExists, createTableIfNotExists, dropTableIfExists, addIndexIfMissing } = require('./helpers');
module.exports = {
  async up(q, S) {
    for (const [c, d] of [['max_active_jobs', 5], ['hourly_write_limit', 30], ['daily_write_limit', 200]]) await addColumnIfMissing(q, 'ApiKeys', c, { type: S.INTEGER, allowNull: false, defaultValue: d });
    await createTableIfNotExists(q, 'external_api_usage_buckets', { id: { type: S.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false }, api_key_id: { type: S.INTEGER, allowNull: false, references: { model: 'ApiKeys', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' }, window_type: { type: S.STRING(8), allowNull: false }, window_start: { type: S.DATE, allowNull: false }, accepted_writes: { type: S.INTEGER, allowNull: false, defaultValue: 0 }, created_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW }, updated_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW } });
    await addIndexIfMissing(q, 'external_api_usage_buckets', ['api_key_id', 'window_type', 'window_start'], { unique: true, name: 'external_api_usage_key_window_uq' });
    await addIndexIfMissing(q, 'external_api_usage_buckets', ['window_start'], { name: 'external_api_usage_window_idx' });
  },
  async down(q) { await dropTableIfExists(q, 'external_api_usage_buckets'); for (const c of ['daily_write_limit', 'hourly_write_limit', 'max_active_jobs']) await removeColumnIfExists(q, 'ApiKeys', c); },
};
