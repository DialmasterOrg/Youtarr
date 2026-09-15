'use strict';

const path = require('path');
const { QueryTypes, Sequelize } = require('sequelize');
const Umzug = require('umzug');
const { validateDatabaseSchema } = require('../../server/modules/databaseHealthModule');
const ApiKey = require('../../server/models/apikey');
const ApiKeyChannelGrant = require('../../server/models/apikeychannelgrant');
const ExternalRequest = require('../../server/models/externalrequest');
const ExternalApiUsageBucket = require('../../server/models/externalapiusagebucket');
const policyMigration = require('../20260908100000-add-external-api-key-policy');
const requestsMigration = require('../20260908102000-create-external-requests');
const usageMigration = require('../20260908106000-create-external-api-usage-buckets');

const RUN_INTEGRATION = process.env.EXTERNAL_API_DATABASE_TEST === 'true';
const describeDatabase = RUN_INTEGRATION ? describe : describe.skip;
const BASELINE = '20260830201917-lowercased-table-column-names.js';
const UNRELATED_CHARSET_MIGRATION = '20250907000000-upgrade-to-utf8mb4-if-needed.js';
const EXTERNAL_MIGRATIONS = [
  '20260908100000-add-external-api-key-policy.js',
  '20260908101000-create-api-key-channel-grants.js',
  '20260908102000-create-external-requests.js',
  '20260908106000-create-external-api-usage-buckets.js',
];
const DATABASE_NAME = `youtarr_external_api_${process.pid}`;
const dbOptions = {
  dialect: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3321),
  logging: false,
  dialectOptions: { charset: 'utf8mb4', supportBigNumbers: true, bigNumberStrings: true },
};
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '123qweasd';
const adminUser = process.env.DB_ADMIN_USER || dbUser;
const adminPassword = process.env.DB_ADMIN_PASSWORD || dbPassword;

let admin;
let sequelize;
let queryInterface;
let migrator;
let databaseCreated = false;

const query = (sql, replacements) => sequelize.query(sql, {
  type: QueryTypes.SELECT,
  replacements,
});

const tableNames = async () => query(
  'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()'
).then((rows) => rows.map((row) => row.TABLE_NAME));

const indexNames = async (tableName) => queryInterface.showIndex(tableName)
  .then((indexes) => indexes.map((index) => index.name));

const foreignKeys = async () => query(
  'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME '
    + 'FROM information_schema.KEY_COLUMN_USAGE '
    + 'WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL '
    + 'AND TABLE_NAME IN (\'external_requests\', \'api_key_channel_grants\', \'external_api_usage_buckets\')'
);

const createDatabase = async () => {
  // The generated name contains only a fixed prefix and numeric PID.
  await admin.query(`DROP DATABASE IF EXISTS \`${DATABASE_NAME}\``);
  await admin.query(`CREATE DATABASE \`${DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  databaseCreated = true;
};

const expectFinalSchema = async () => {
  await expect(tableNames()).resolves.toEqual(expect.arrayContaining([
    'apikeys', 'channels', 'api_key_channel_grants', 'external_requests', 'external_api_usage_buckets',
  ]));
  const keyColumns = await queryInterface.describeTable('apikeys');
  expect(keyColumns).toEqual(expect.objectContaining({
    role: expect.any(Object), allowed_media_types: expect.any(Object),
    allow_video_requests: expect.any(Object), allow_channel_requests: expect.any(Object),
    allow_delete_video_requests: expect.any(Object), max_active_jobs: expect.any(Object),
    hourly_write_limit: expect.any(Object), daily_write_limit: expect.any(Object),
  }));

  const requestIndexes = await indexNames('external_requests');
  expect(requestIndexes).toEqual(expect.arrayContaining([
    'external_requests_active_dedupe_uq', 'external_requests_key_idempotency_uq',
    'external_requests_key_created_idx', 'external_requests_key_status_idx',
  ]));
  expect(requestIndexes).not.toEqual(expect.arrayContaining([
    'external_requests_catalog_status_idx', 'external_requests_management_idx',
  ]));
  expect(await indexNames('api_key_channel_grants')).toEqual(expect.arrayContaining([
    'api_key_channel_grants_key_channel_uq', 'api_key_channel_grants_channel_idx',
  ]));
  expect(await indexNames('external_api_usage_buckets')).toEqual(expect.arrayContaining([
    'external_api_usage_key_window_uq', 'external_api_usage_window_idx',
  ]));

  const keys = await foreignKeys();
  expect(keys).toEqual(expect.arrayContaining([
    expect.objectContaining({ TABLE_NAME: 'external_requests', COLUMN_NAME: 'api_key_id', REFERENCED_TABLE_NAME: 'apikeys' }),
    expect.objectContaining({ TABLE_NAME: 'external_requests', COLUMN_NAME: 'channel_id', REFERENCED_TABLE_NAME: 'channels' }),
    expect.objectContaining({ TABLE_NAME: 'external_requests', COLUMN_NAME: 'job_id', REFERENCED_TABLE_NAME: 'jobs' }),
    expect.objectContaining({ TABLE_NAME: 'api_key_channel_grants', COLUMN_NAME: 'api_key_id', REFERENCED_TABLE_NAME: 'apikeys' }),
    expect.objectContaining({ TABLE_NAME: 'api_key_channel_grants', COLUMN_NAME: 'channel_id', REFERENCED_TABLE_NAME: 'channels' }),
    expect.objectContaining({ TABLE_NAME: 'external_api_usage_buckets', COLUMN_NAME: 'api_key_id', REFERENCED_TABLE_NAME: 'apikeys' }),
  ]));
};

describeDatabase('external API migration lifecycle on MySQL-compatible engines', () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    admin = new Sequelize('mysql', adminUser, adminPassword, dbOptions);
    await admin.authenticate();
    await createDatabase();
    sequelize = new Sequelize(DATABASE_NAME, dbUser, dbPassword, dbOptions);
    await sequelize.authenticate();
    queryInterface = sequelize.getQueryInterface();
    migrator = new Umzug({
      migrations: { path: path.join(__dirname, '..'), params: [queryInterface, Sequelize] },
      storage: 'sequelize', storageOptions: { sequelize }, logging: false,
    });
    // The test database is already created with the target charset. Mark the
    // unrelated charset conversion as complete so this suite isolates the
    // external API migrations on both MySQL and MariaDB.
    await migrator.storage.logMigration(UNRELATED_CHARSET_MIGRATION);
  });

  afterAll(async () => {
    if (sequelize) await sequelize.close();
    if (admin) {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS \`${DATABASE_NAME}\``);
      }
      await admin.close();
    }
  });

  test('preserves legacy keys, leaves duplicate channels, and recovers from interrupted reruns', async () => {
    await migrator.up({ to: BASELINE });
    await sequelize.query(
      'INSERT INTO apikeys (name, key_hash, key_prefix, usage_count, is_active) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
      { replacements: ['active legacy', 'hash-active', 'active', 17, 1, 'inactive legacy', 'hash-inactive', 'inactiv', 23, 0] }
    );
    await sequelize.query(
      'INSERT INTO channels (channel_id, title, auto_download_enabled_tabs) '
        + 'VALUES (?, ?, ?), (?, ?, ?)',
      {
        replacements: [
          'duplicate-channel', 'first', 'video',
          'duplicate-channel', 'second', 'video',
        ],
      }
    );

    // Simulate an interrupted policy migration that added only some nullable columns.
    await queryInterface.addColumn('apikeys', 'revoked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('apikeys', 'allow_video_requests', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    // Apply only this feature's migrations so the regression stays isolated
    // from unrelated post-baseline migrations on each database engine.
    await migrator.up({ migrations: EXTERNAL_MIGRATIONS });
    await expectFinalSchema();
    const keys = await query('SELECT key_hash, key_prefix, usage_count, is_active, role, allowed_media_types FROM apikeys ORDER BY id');
    expect(keys.slice(-2)).toEqual([
      expect.objectContaining({ key_hash: 'hash-active', key_prefix: 'active', usage_count: 17, is_active: 1, role: 'legacy_download', allowed_media_types: expect.anything() }),
      expect.objectContaining({ key_hash: 'hash-inactive', key_prefix: 'inactiv', usage_count: 23, is_active: 0, role: 'legacy_download', allowed_media_types: expect.anything() }),
    ]);
    const duplicateCount = await query('SELECT COUNT(*) AS count FROM channels WHERE channel_id = ?', ['duplicate-channel']);
    expect(Number(duplicateCount[0].count)).toBe(2);

    // Recreate indexes after an interrupted post-table step, then rerun the full migrator.
    await queryInterface.removeIndex('external_requests', 'external_requests_key_status_idx');
    await queryInterface.removeIndex('external_api_usage_buckets', 'external_api_usage_window_idx');
    await requestsMigration.up(queryInterface, Sequelize);
    await usageMigration.up(queryInterface, Sequelize);
    await expectFinalSchema();

    await sequelize.query("UPDATE apikeys SET role = 'request' WHERE key_hash = 'hash-active'");
    await migrator.down({ migrations: EXTERNAL_MIGRATIONS.slice().reverse() });
    const rolledBack = await query(
      'SELECT key_hash, usage_count, is_active FROM apikeys WHERE key_hash IN (?, ?) ORDER BY key_hash',
      ['hash-active', 'hash-inactive']
    );
    expect(rolledBack).toEqual([
      expect.objectContaining({ key_hash: 'hash-active', usage_count: 17, is_active: 0 }),
      expect.objectContaining({ key_hash: 'hash-inactive', usage_count: 23, is_active: 0 }),
    ]);
    expect(await tableNames()).not.toEqual(expect.arrayContaining([
      'api_key_channel_grants', 'external_requests', 'external_api_usage_buckets',
    ]));

    await migrator.up({ migrations: EXTERNAL_MIGRATIONS });
    await policyMigration.up(queryInterface, Sequelize);
    await expectFinalSchema();
    const validation = await validateDatabaseSchema(sequelize, {
      ApiKey, ApiKeyChannelGrant, ExternalRequest, ExternalApiUsageBucket,
    });
    expect(validation).toEqual({ valid: true, errors: [] });
  });
});
