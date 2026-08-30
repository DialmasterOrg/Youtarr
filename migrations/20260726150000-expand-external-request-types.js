'use strict';
const { addColumnIfMissing, removeColumnIfExists, addIndexIfMissing, removeIndexIfExists } = require('./helpers');
const FK = 'external_requests_channel_fk';
async function replaceFk(q, S, allowNull, onDelete) {
  const refs = await q.getForeignKeyReferencesForTable('external_requests');
  for (const ref of refs.filter((r) => (r.columnName || r.column_name) === 'channel_id')) await q.removeConstraint('external_requests', ref.constraintName || ref.constraint_name);
  await q.changeColumn('external_requests', 'channel_id', { type: S.INTEGER, allowNull });
  await q.addConstraint('external_requests', { fields: ['channel_id'], type: 'foreign key', name: FK, references: { table: 'channels', field: 'id' }, onUpdate: 'CASCADE', onDelete });
}
module.exports = {
  async up(q, S) {
    await addColumnIfMissing(q, 'external_requests', 'channel_url', { type: S.STRING(500), allowNull: true });
    await addColumnIfMissing(q, 'external_requests', 'grant_to_requesting_key', { type: S.BOOLEAN, allowNull: true });
    await replaceFk(q, S, true, 'SET NULL');
    await q.changeColumn('external_requests', 'youtube_id', { type: S.STRING(32), allowNull: true });
    await addIndexIfMissing(q, 'external_requests', ['request_type', 'status', 'created_at', 'id'], { name: 'external_requests_management_idx' });
  },
  async down(q, S) {
    await q.bulkDelete('external_requests', { request_type: { [S.Op.in]: ['channel', 'delete_video'] } });
    await removeIndexIfExists(q, 'external_requests', 'external_requests_management_idx');
    await replaceFk(q, S, false, 'CASCADE');
    await q.changeColumn('external_requests', 'youtube_id', { type: S.STRING(32), allowNull: false });
    await removeColumnIfExists(q, 'external_requests', 'channel_url');
    await removeColumnIfExists(q, 'external_requests', 'grant_to_requesting_key');
  },
};
