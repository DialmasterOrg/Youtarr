'use strict';
const { addIndexIfMissing, removeIndexIfExists, tableExists } = require('./helpers');
module.exports = {
  async up(q) {
    if (!(await tableExists(q, 'channels'))) return;
    const tx = await q.sequelize.transaction();
    try {
      await q.sequelize.query('CREATE TEMPORARY TABLE youtarr_channel_survivors AS SELECT channel_id, MIN(id) AS survivor_id FROM channels WHERE channel_id IS NOT NULL AND channel_id <> \'\' GROUP BY channel_id', { transaction: tx });
      const channelColumns = await q.describeTable('channels');
      const comparableColumns = Object.keys(channelColumns).filter((column) => !['id', 'channel_id'].includes(column));
      if (comparableColumns.length > 0) {
        const differences = comparableColumns
          .map((column) => `NOT (duplicate.\`${column}\` <=> survivor_channel.\`${column}\`)`)
          .join(' OR ');
        const [conflicts] = await q.sequelize.query(`SELECT duplicate.id AS duplicate_id, survivor.survivor_id, duplicate.channel_id FROM channels duplicate INNER JOIN youtarr_channel_survivors survivor ON duplicate.channel_id = survivor.channel_id INNER JOIN channels survivor_channel ON survivor_channel.id = survivor.survivor_id WHERE duplicate.id <> survivor.survivor_id AND (${differences})`, { transaction: tx });
        if (conflicts.length > 0) {
          const ids = conflicts.map((row) => `${row.channel_id}: ${row.survivor_id},${row.duplicate_id}`).join('; ');
          throw new Error(`Cannot consolidate channels with differing persisted state (${ids})`);
        }
      }
      if (await tableExists(q, 'external_requests')) await q.sequelize.query('UPDATE external_requests request INNER JOIN channels duplicate ON request.channel_id = duplicate.id INNER JOIN youtarr_channel_survivors survivor ON duplicate.channel_id = survivor.channel_id SET request.channel_id = survivor.survivor_id WHERE request.channel_id <> survivor.survivor_id', { transaction: tx });
      if (await tableExists(q, 'api_key_channel_grants')) {
        await q.sequelize.query('DELETE duplicate_grant FROM api_key_channel_grants duplicate_grant INNER JOIN channels duplicate ON duplicate_grant.channel_id = duplicate.id INNER JOIN youtarr_channel_survivors survivor ON duplicate.channel_id = survivor.channel_id INNER JOIN api_key_channel_grants survivor_grant ON survivor_grant.api_key_id = duplicate_grant.api_key_id AND survivor_grant.channel_id = survivor.survivor_id WHERE duplicate_grant.channel_id <> survivor.survivor_id', { transaction: tx });
        await q.sequelize.query('UPDATE api_key_channel_grants grant_row INNER JOIN channels duplicate ON grant_row.channel_id = duplicate.id INNER JOIN youtarr_channel_survivors survivor ON duplicate.channel_id = survivor.channel_id SET grant_row.channel_id = survivor.survivor_id WHERE grant_row.channel_id <> survivor.survivor_id', { transaction: tx });
      }
      await q.sequelize.query('DELETE duplicate FROM channels duplicate INNER JOIN youtarr_channel_survivors survivor ON duplicate.channel_id = survivor.channel_id WHERE duplicate.id <> survivor.survivor_id', { transaction: tx });
      await q.sequelize.query('DROP TEMPORARY TABLE youtarr_channel_survivors', { transaction: tx }); await tx.commit();
    } catch (e) {
      // Temporary tables are connection-scoped and survive a transaction
      // rollback. Drop this one on the transaction's connection so a corrected
      // migration can be retried safely in the same process.
      await q.sequelize.query(
        'DROP TEMPORARY TABLE IF EXISTS youtarr_channel_survivors',
        { transaction: tx }
      );
      await tx.rollback();
      throw e;
    }
    await removeIndexIfExists(q, 'channels', 'channels_external_channel_id_idx');
    await addIndexIfMissing(q, 'channels', ['channel_id'], { unique: true, name: 'channels_channel_id_uq' });
  },
  async down(q) { await removeIndexIfExists(q, 'channels', 'channels_channel_id_uq'); await addIndexIfMissing(q, 'channels', ['channel_id'], { name: 'channels_external_channel_id_idx' }); },
};
