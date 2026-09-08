'use strict';

const migration = require('../20260908107000-unique-channel-identity');

function queryInterface() {
  const transaction = {
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
  };
  const qi = {
    showAllTables: jest.fn().mockResolvedValue([
      'channels', 'external_requests', 'api_key_channel_grants',
    ]),
    describeTable: jest.fn().mockResolvedValue({ id: {}, channel_id: {}, title: {}, enabled: {} }),
    showIndex: jest.fn().mockResolvedValue([
      { name: 'channels_external_channel_id_idx', fields: [{ name: 'channel_id' }] },
    ]),
    removeIndex: jest.fn().mockResolvedValue(),
    addIndex: jest.fn().mockResolvedValue(),
    sequelize: {
      transaction: jest.fn().mockResolvedValue(transaction),
      query: jest.fn().mockResolvedValue([[]]),
    },
  };
  return { qi, transaction };
}

describe('unique channel identity migration', () => {
  test('consolidates references before enforcing canonical uniqueness', async () => {
    const { qi, transaction } = queryInterface();

    await migration.up(qi);

    const sql = qi.sequelize.query.mock.calls.map(([statement]) => statement);
    expect(sql.some((statement) => statement.includes('UPDATE external_requests'))).toBe(true);
    expect(sql.some((statement) => statement.includes('DELETE duplicate_grant'))).toBe(true);
    expect(sql.some((statement) => statement.includes('UPDATE api_key_channel_grants'))).toBe(true);
    expect(sql.some((statement) => statement.includes('DELETE duplicate'))).toBe(true);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
    expect(qi.removeIndex).toHaveBeenCalledWith(
      'channels',
      'channels_external_channel_id_idx'
    );
    expect(qi.addIndex).toHaveBeenCalledWith(
      'channels',
      ['channel_id'],
      { unique: true, name: 'channels_channel_id_uq' }
    );
  });

  test('rolls back consolidation when a reference update fails', async () => {
    const { qi, transaction } = queryInterface();
    qi.sequelize.query.mockRejectedValueOnce(new Error('failed'));

    await expect(migration.up(qi)).rejects.toThrow('failed');
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(qi.addIndex).not.toHaveBeenCalled();
  });
});
