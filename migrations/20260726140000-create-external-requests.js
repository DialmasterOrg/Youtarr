'use strict';
const { createTableIfNotExists, dropTableIfExists, addIndexIfMissing } = require('./helpers');
module.exports = {
  async up(q, S) {
    await createTableIfNotExists(q, 'external_requests', {
      id: { type: S.UUID, primaryKey: true, allowNull: false }, api_key_id: { type: S.INTEGER, allowNull: false, references: { model: 'ApiKeys', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      channel_id: { type: S.INTEGER, allowNull: false, references: { model: 'channels', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' }, youtube_id: { type: S.STRING(32), allowNull: false }, request_type: { type: S.STRING(20), allowNull: false, defaultValue: 'video' }, status: { type: S.STRING(20), allowNull: false, defaultValue: 'pending' },
      active_dedupe_key: { type: S.STRING(191), allowNull: true }, idempotency_hash: { type: S.STRING(64), allowNull: true }, job_id: { type: S.UUID, allowNull: true, references: { model: 'Jobs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' }, message: { type: S.STRING(500), allowNull: true }, created_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW }, updated_at: { type: S.DATE, allowNull: false, defaultValue: S.NOW }, decided_at: { type: S.DATE, allowNull: true }, completed_at: { type: S.DATE, allowNull: true },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    await addIndexIfMissing(q, 'external_requests', ['active_dedupe_key'], { unique: true, name: 'external_requests_active_dedupe_uq' });
    await addIndexIfMissing(q, 'external_requests', ['api_key_id', 'idempotency_hash'], { unique: true, name: 'external_requests_key_idempotency_uq' });
    await addIndexIfMissing(q, 'external_requests', ['api_key_id', 'created_at'], { name: 'external_requests_key_created_idx' });
    await addIndexIfMissing(q, 'external_requests', ['api_key_id', 'status'], { name: 'external_requests_key_status_idx' });
    await addIndexIfMissing(q, 'external_requests', ['api_key_id', 'request_type', 'youtube_id', 'created_at', 'id'], { name: 'external_requests_catalog_status_idx' });
  },
  async down(q) { await dropTableIfExists(q, 'external_requests'); },
};
