'use strict';

const policy = require('../20260726120000-add-external-api-key-policy');
const permissions = require('../20260726152000-add-external-api-key-permissions');
const channelIdentity = require('../20260726154000-unique-channel-identity');

const qiFor = (columns = {}) => {
  const operations = [];
  return {
    operations,
    describeTable: jest.fn().mockResolvedValue(columns),
    addColumn: jest.fn(async (_table, column) => operations.push(['add', column])),
    changeColumn: jest.fn(async (_table, column) => operations.push(['change', column])),
    removeColumn: jest.fn(async (_table, column) => operations.push(['remove', column])),
    sequelize: { query: jest.fn(async (sql) => operations.push(['query', sql])) },
  };
};

describe('external API persistence migrations', () => {
  test('policy migration backfills legacy keys and is safe to reapply', async () => {
    const types = {
      STRING: jest.fn(() => 'STRING'),
      BOOLEAN: 'BOOLEAN',
      INTEGER: 'INTEGER',
      JSON: 'JSON',
      DATE: 'DATE',
    };
    const qi = qiFor();
    await policy.up(qi, types);
    expect(qi.operations.filter(([op]) => op === 'add')).toHaveLength(8);
    expect(qi.operations.some(([, sql]) => /legacy_download/.test(sql))).toBe(true);
    const repeat = qiFor(Object.fromEntries(['role', 'auto_approve_video_requests', 'auto_approve_channel_requests', 'auto_approve_delete_requests', 'max_rating_level', 'allow_unrated', 'allowed_media_types', 'revoked_at'].map((key) => [key, {}])));
    await policy.up(repeat, types);
    expect(repeat.operations.filter(([op]) => op === 'add')).toEqual([]);
  });

  test('granular permissions derive from full_access and revoke ambiguous policies on rollback', async () => {
    const qi = qiFor();
    await permissions.up(qi, { BOOLEAN: 'BOOLEAN' });
    const sql = qi.operations.filter(([op]) => op === 'query').map(([, value]) => value).join('\n');
    expect(sql).toContain("'full_access'");
    const rollback = qiFor({ is_active: {}, revoked_at: {}, allow_video_requests: {}, allow_channel_requests: {}, allow_delete_video_requests: {} });
    await permissions.down(rollback);
    expect(rollback.operations[0][1]).toContain('SET is_active = false');
  });

  test('permission migration repairs nullable columns left by a partial run', async () => {
    const qi = qiFor({ allow_video_requests: {} });
    await permissions.up(qi, { BOOLEAN: 'BOOLEAN' });
    expect(qi.operations.filter(([op]) => op === 'change')).toHaveLength(3);
    expect(qi.operations.filter(([op]) => op === 'query').every(([, sql]) => /IS NULL/.test(sql))).toBe(true);
  });

  test('channel identity migration aborts when duplicate persisted state differs', async () => {
    const operations = [];
    const transaction = { commit: jest.fn(), rollback: jest.fn() };
    const qi = {
      showAllTables: jest.fn().mockResolvedValue(['channels']),
      describeTable: jest.fn().mockResolvedValue({ id: {}, channel_id: {}, title: {}, enabled: {} }),
      sequelize: {
        transaction: jest.fn().mockResolvedValue(transaction),
        query: jest.fn(async (sql) => {
          operations.push(sql);
          if (/SELECT duplicate\.id/.test(sql)) return [[{ channel_id: 'UC1', survivor_id: 1, duplicate_id: 2 }]];
          return [[]];
        }),
      },
    };
    await expect(channelIdentity.up(qi)).rejects.toThrow(/differing persisted state.*UC1/);
    expect(transaction.rollback).toHaveBeenCalled();
    expect(operations.some((sql) => /SELECT duplicate\.id/.test(sql))).toBe(true);
    expect(operations.some((sql) => /DROP TEMPORARY TABLE IF EXISTS/.test(sql))).toBe(true);
  });
});
