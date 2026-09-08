'use strict';

const path = require('path');
const { QueryTypes, Sequelize } = require('sequelize');
const Umzug = require('umzug');

const RUN_INTEGRATION = process.env.MARIADB_MIGRATION_TEST === 'true';
const describeMariaDb = RUN_INTEGRATION ? describe : describe.skip;
const UPSTREAM_BASELINE = '20260830201917-lowercased-table-column-names.js';
const EXTERNAL_MIGRATIONS = [
  '20260908100000-add-external-api-key-policy.js',
  '20260908101000-create-api-key-channel-grants.js',
  '20260908102000-create-external-requests.js',
  '20260908103000-expand-external-request-types.js',
  '20260908104000-add-external-catalog-indexes.js',
  '20260908105000-add-external-api-key-permissions.js',
  '20260908106000-add-external-api-quotas.js',
  '20260908107000-unique-channel-identity.js',
];
const FINAL_MIGRATION = EXTERNAL_MIGRATIONS[EXTERNAL_MIGRATIONS.length - 1];
const DATABASE_NAME = 'youtarr_migration_test_' + process.pid;
const dbOptions = {
  dialect: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3321),
  logging: false,
  dialectOptions: {
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true,
  },
};
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD || '123qweasd';
const adminUser = process.env.MARIADB_ROOT_USER || dbUser;
const adminPassword = process.env.MARIADB_ROOT_PASSWORD || dbPassword;
const selectRows = { type: QueryTypes.SELECT };

let admin;
let sequelize;
let queryInterface;
let migrator;

const tableNames = async () => {
  const rows = await sequelize.query(
    'SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()',
    selectRows
  );
  return rows.map((row) => row.TABLE_NAME);
};

const indexNames = async (tableName) => (
  await queryInterface.showIndex(tableName)
).map((index) => index.name);

const columnRows = async (tableName, columnName) => sequelize.query(
  'SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE ' +
    'FROM information_schema.columns ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
  { ...selectRows, replacements: [tableName, columnName] }
);

const foreignKeys = async () => sequelize.query(
  'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME ' +
    'FROM information_schema.KEY_COLUMN_USAGE ' +
    'WHERE CONSTRAINT_SCHEMA = DATABASE() ' +
    'AND REFERENCED_TABLE_NAME IS NOT NULL ' +
    'AND TABLE_NAME IN ("external_requests", "api_key_channel_grants", ' +
    '"external_api_usage_buckets")',
  selectRows
);

const expectExternalSchema = async () => {
  const tables = await tableNames();
  expect(tables).toEqual(expect.arrayContaining([
    'api_key_channel_grants',
    'external_api_usage_buckets',
    'external_requests',
  ]));

  const apiKeyColumns = await queryInterface.describeTable('apikeys');
  expect(apiKeyColumns).toEqual(expect.objectContaining({
    role: expect.any(Object),
    revoked_at: expect.any(Object),
    allowed_media_types: expect.any(Object),
    allow_video_requests: expect.any(Object),
    allow_channel_requests: expect.any(Object),
    allow_delete_video_requests: expect.any(Object),
    max_active_jobs: expect.any(Object),
    hourly_write_limit: expect.any(Object),
    daily_write_limit: expect.any(Object),
  }));

  const requestColumns = await queryInterface.describeTable('external_requests');
  expect(requestColumns).toEqual(expect.objectContaining({
    id: expect.any(Object),
    channel_id: expect.any(Object),
    channel_url: expect.any(Object),
    youtube_id: expect.any(Object),
    grant_to_requesting_key: expect.any(Object),
    job_id: expect.any(Object),
  }));

  const channelVideoColumns = await queryInterface.describeTable('channelvideos');
  expect(channelVideoColumns).toHaveProperty('published_at');
  expect(await indexNames('channels')).toContain('channels_channel_id_uq');
  expect(await indexNames('external_requests')).toEqual(expect.arrayContaining([
    'external_requests_active_dedupe_uq',
    'external_requests_management_idx',
  ]));

  const jobIdColumns = await Promise.all([
    columnRows('jobs', 'id'),
    columnRows('external_requests', 'job_id'),
  ]);
  expect(jobIdColumns[0][0].DATA_TYPE).toBe(jobIdColumns[1][0].DATA_TYPE);
  expect(jobIdColumns[0][0].COLUMN_TYPE).toBe(jobIdColumns[1][0].COLUMN_TYPE);

  const keys = await foreignKeys();
  expect(keys).toEqual(expect.arrayContaining([
    expect.objectContaining({
      TABLE_NAME: 'external_requests',
      COLUMN_NAME: 'api_key_id',
      REFERENCED_TABLE_NAME: 'apikeys',
      REFERENCED_COLUMN_NAME: 'id',
    }),
    expect.objectContaining({
      TABLE_NAME: 'external_requests',
      COLUMN_NAME: 'channel_id',
      REFERENCED_TABLE_NAME: 'channels',
      REFERENCED_COLUMN_NAME: 'id',
    }),
    expect.objectContaining({
      TABLE_NAME: 'external_requests',
      COLUMN_NAME: 'job_id',
      REFERENCED_TABLE_NAME: 'jobs',
      REFERENCED_COLUMN_NAME: 'id',
    }),
    expect.objectContaining({
      TABLE_NAME: 'external_api_usage_buckets',
      COLUMN_NAME: 'api_key_id',
      REFERENCED_TABLE_NAME: 'apikeys',
      REFERENCED_COLUMN_NAME: 'id',
    }),
  ]));
};

describeMariaDb('external API migrations on MariaDB', () => {
  jest.setTimeout(120000);

  beforeAll(async () => {
    admin = new Sequelize('mysql', adminUser, adminPassword, dbOptions);
    await admin.authenticate();
    await admin.query('DROP DATABASE IF EXISTS ' + DATABASE_NAME);
    await admin.query(
      'CREATE DATABASE ' + DATABASE_NAME +
        ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );

    sequelize = new Sequelize(DATABASE_NAME, dbUser, dbPassword, dbOptions);
    await sequelize.authenticate();
    await sequelize.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    queryInterface = sequelize.getQueryInterface();
    migrator = new Umzug({
      migrations: {
        path: path.join(__dirname, '..'),
        params: [queryInterface, Sequelize],
      },
      storage: 'sequelize',
      storageOptions: { sequelize },
      logging: false,
    });
  });

  afterAll(async () => {
    if (sequelize) await sequelize.close();
    if (admin) {
      await admin.query('DROP DATABASE IF EXISTS ' + DATABASE_NAME);
      await admin.close();
    }
  });

  test('supports a normalized baseline, idempotent upgrade, rollback, and reapply', async () => {
    await migrator.up({ to: UPSTREAM_BASELINE });

    const baselineTables = await tableNames();
    expect(baselineTables).toEqual(expect.arrayContaining([
      'apikeys',
      'channels',
      'channelvideos',
      'jobs',
    ]));
    expect(baselineTables).not.toEqual(expect.arrayContaining([
      'external_requests',
      'api_key_channel_grants',
      'external_api_usage_buckets',
    ]));

    await migrator.up({ to: FINAL_MIGRATION });
    await expectExternalSchema();

    await migrator.up();
    await expectExternalSchema();

    await migrator.down({ migrations: EXTERNAL_MIGRATIONS.slice().reverse() });
    const rolledBackTables = await tableNames();
    expect(rolledBackTables).toEqual(expect.arrayContaining([
      'apikeys',
      'channels',
      'channelvideos',
      'jobs',
    ]));
    expect(rolledBackTables).not.toEqual(expect.arrayContaining([
      'external_requests',
      'api_key_channel_grants',
      'external_api_usage_buckets',
    ]));
    expect(await queryInterface.describeTable('apikeys')).not.toHaveProperty('role');
    expect(await indexNames('channels')).not.toContain('channels_channel_id_uq');

    await migrator.up({ to: FINAL_MIGRATION });
    await expectExternalSchema();
  });
});
