#!/usr/bin/env node
'use strict';

// Runs only against a local disposable database with entirely synthetic rows.
const path = require('path');
const fs = require('fs');
const { Sequelize, QueryTypes } = require('sequelize');
const Umzug = require('umzug');
const root = path.resolve(__dirname, '..');
const databaseName = `youtarr_external_index_${process.pid}`;
const host = process.env.DB_HOST || '127.0.0.1';
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  throw new Error('Index-plan checks require a local disposable database');
}
process.env.DB_NAME = databaseName;
process.env.DB_HOST = host;
const { sequelize } = require('../server/db');
const catalog = require('../server/modules/externalCatalogService');
const config = require('../server/modules/configModule');
const logger = require('../server/logger');
const { createExternalRequestService } = require('../server/modules/externalRequestService');
const migration = require('../migrations/20261007041058-add-external-api-runtime-indexes');

async function run() {
  const admin = new Sequelize('mysql', process.env.DB_ADMIN_USER || process.env.DB_USER || 'root',
    process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '123qweasd', {
      dialect: 'mysql', host, port: Number(process.env.DB_PORT || 3321), logging: false,
    });
  let created = false;
  try {
    await admin.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    const queryInterface = sequelize.getQueryInterface();
    const migrator = new Umzug({
      migrations: { path: path.join(root, 'migrations'), params: [queryInterface, Sequelize] },
      storage: 'sequelize', storageOptions: { sequelize }, logging: false,
    });
    await migrator.storage.logMigration('20250907000000-upgrade-to-utf8mb4-if-needed.js');
    await migrator.up();
    await migration.down(queryInterface);
 const digit='(SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)';
 await sequelize.query(`CREATE TABLE fixture_numbers AS SELECT a.n + b.n*10+c.n*100+d.n*1000+e.n*10000+f.n*100000 n FROM ${digit} a CROSS JOIN ${digit} b CROSS JOIN ${digit} c CROSS JOIN ${digit} d CROSS JOIN ${digit} e CROSS JOIN ${digit} f WHERE a.n+b.n*10+c.n*100+d.n*1000+e.n*10000+f.n*100000 < 300000`);
 await sequelize.query("INSERT INTO channels (channel_id,title,enabled,default_rating,auto_download_enabled_tabs) SELECT CONCAT('UC',LPAD(n,22,'0')),CONCAT('Synthetic ',n),1,'TV-Y','video' FROM fixture_numbers WHERE n<1000");
 await sequelize.query("INSERT INTO channelvideos (youtube_id,channel_id,title,media_type,youtube_removed,ignored,published_at) SELECT LPAD(n,11,'0'),CONCAT('UC',LPAD(FLOOR(n/300),22,'0')),CONCAT('Synthetic video ',n),IF(MOD(n,10)=0,'short','video'),MOD(n,20)=0,MOD(n,30)=0,'2026-10-07T00:00:00.000Z' FROM fixture_numbers");
 await sequelize.query("INSERT INTO apikeys (id,name,key_hash,key_prefix,created_at,role,allowed_media_types) VALUES (1,'Synthetic','fake','fake',NOW(),'admin','[\"video\"]')");
 await sequelize.query('INSERT INTO api_key_channel_grants (api_key_id,channel_id,created_at) SELECT 1,id,NOW() FROM channels WHERE id<=10');
 await sequelize.query("INSERT INTO external_requests (id,api_key_id,channel_id,youtube_id,request_type,status,created_at,updated_at) SELECT CONCAT('00000000-0000-4000-8000-',LPAD(n,12,'0')),1,MOD(n,1000)+1,LPAD(MOD(n,3000),11,'0'),IF(MOD(n,10)=0,'channel','video'),IF(MOD(n,20)=1,'pending','completed'),DATE_ADD('2026-01-01',INTERVAL n SECOND),NOW() FROM fixture_numbers WHERE n<30000");
 await sequelize.query('ANALYZE TABLE channels,channelvideos,external_requests');

    const key = { id: 1, role: 'admin', maxRatingLevel: 4, allowUnrated: true, allowedMediaTypes: ['video'] };
    const requests = createExternalRequestService({ executor: () => {}, videoDeleter: {} });
    const reads = async () => [
      await catalog.listChannels(key),
      await catalog.listVideos(key, { pageSize: '50' }),
      await catalog.listChannelVideos(key, 1, { pageSize: '50' }),
      await requests.listAdminRequests({ requestType: 'video', status: 'pending' }),
    ];
    const statements = [];
    sequelize.options.logging = sql => statements.push(sql.replace(/^Executing \([^)]+\): /, ''));
    const beforeStart = Date.now();
    const beforeResults = await reads();
    const beforeMs = Date.now() - beforeStart;
    sequelize.options.logging = false;
    const queries = statements.filter(sql => /^SELECT/i.test(sql));
    const explain = async () => {
      const plans = [];
      for (const sql of queries) plans.push(await sequelize.query(`EXPLAIN ${sql}`, { type: QueryTypes.SELECT }));
      return plans;
    };
    const before = await explain();
    const buildStart = Date.now();
    await migration.up(queryInterface);
    const indexBuildMs = Date.now() - buildStart;
    await sequelize.query('ANALYZE TABLE external_requests');
    const after = await explain();
    const afterStart = Date.now();
    const afterResults = await reads();
    const afterMs = Date.now() - afterStart;
    if (JSON.stringify(beforeResults) !== JSON.stringify(afterResults)) {
      throw new Error('Runtime index migration changed query results');
    }
    const [version] = await sequelize.query('SELECT VERSION() version', { type: QueryTypes.SELECT });
    const report = { version: version.version,
      seed: { channelvideos: 300000, channels: 1000, requests: 30000, grants: 10 },
      beforeMs, afterMs, indexBuildMs, queries, before, after };
    const destination = process.env.EXTERNAL_API_INDEX_REPORT || '/tmp/youtarr-external-index-plans.json';
    fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
    logger.info({ destination, version: report.version, beforeMs, afterMs, indexBuildMs }, 'External API index plans verified');
  } finally {
    sequelize.options.logging = false;
    await sequelize.close();
    if (created) await admin.query(`DROP DATABASE \`${databaseName}\``);
    await admin.close();
    config.stopWatchingConfig();
  }
}

run().catch(error => { logger.error({ err: error }, 'External API index-plan checks failed'); process.exitCode = 1; });
