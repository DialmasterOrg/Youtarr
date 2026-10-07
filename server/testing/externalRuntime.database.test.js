'use strict';

const path = require('path');
const { Sequelize } = require('sequelize');
const Umzug = require('umzug');

process.env.DB_NAME = `youtarr_runtime_test_${process.pid}`;
const { sequelize } = require('../db');
const models = require('../models');
const { normalizeExternalApiKey } = require('../middleware/externalApiAuth');
const { createExternalRequestService } = require('../modules/externalRequestService');
const { createExternalQuotaService } = require('../modules/externalQuotaService');
const { createExternalWorkLimiter } = require('../modules/externalWorkLimiter');
const { isSpecificUrlDownloadJob } = require('../modules/download/jobTypes');
const catalog = require('../modules/externalCatalogService');
const configModule = require('../modules/configModule');

const youtubeId = 'abcdefghijk';
const youtubeChannelId = 'UC1234567890123456789012';
const timestamp = new Date('2026-10-07T12:00:00Z');
let admin;
let channel;
let keyRecord;
let key;

function service(options = {}) {
  return createExternalRequestService({
    models, sequelize, now: () => timestamp,
    executor: async ({ body }) => {
      expect(isSpecificUrlDownloadJob(body.jobLabel)).toBe(true);
      await models.Job.findOrCreate({
        where: { id: body.externalRequestId },
        defaults: { status: 'Pending', timeCreated: timestamp, timeInitiated: timestamp, jobType: 'Manual Download' },
      });
      return body.externalRequestId;
    },
    channelProvisioner: { getChannelInfo: async () => ({ channel_id: youtubeChannelId }) },
    videoDeleter: {
      deleteVideoById: async (_id, { video, transaction }) => {
        await video.update({ removed: true }, { transaction });
        return { success: true };
      },
    },
    ...options,
  });
}

async function policy(values) {
  await keyRecord.update(values);
  key = normalizeExternalApiKey(keyRecord);
}

async function downloadedVideo() {
  return models.Video.create({ youtubeId, youTubeChannelName: 'Synthetic channel',
    youTubeVideoName: 'Synthetic video', channel_id: youtubeChannelId, normalized_rating: 'TV-Y' });
}

beforeAll(async () => {
  admin = new Sequelize('mysql', process.env.DB_ADMIN_USER || process.env.DB_USER || 'root',
    process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD, {
      dialect: 'mysql', host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3321), logging: false,
    });
  await admin.query(`CREATE DATABASE \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const migrator = new Umzug({
    migrations: { path: path.join(__dirname, '../../migrations'), params: [sequelize.getQueryInterface(), Sequelize] },
    storage: 'sequelize', storageOptions: { sequelize }, logging: false,
  });
  await migrator.storage.logMigration('20250907000000-upgrade-to-utf8mb4-if-needed.js');
  await migrator.up();
}, 120000);

beforeEach(async () => {
  for (const model of [models.ExternalRequest, models.ExternalApiUsageBucket,
    models.ApiKeyChannelGrant, models.ApiKey, models.ChannelVideo, models.Video, models.Channel, models.Job]) {
    await model.destroy({ where: {} });
  }
  channel = await models.Channel.create({ channel_id: youtubeChannelId,
    title: 'Synthetic channel', enabled: true, default_rating: 'TV-Y' });
  await models.ChannelVideo.create({ youtube_id: youtubeId, channel_id: youtubeChannelId,
    title: 'Synthetic video', publishedAt: '2026-10-07T00:00:00.000Z' });
  keyRecord = await models.ApiKey.create({ name: 'Synthetic test key', key_hash: 'test-only-hash',
    key_prefix: 'testonly', created_at: timestamp, role: 'admin', allow_video_requests: true,
    allow_channel_requests: true, allow_delete_video_requests: true, allow_unrated: true });
  await models.ApiKeyChannelGrant.create({ api_key_id: keyRecord.id, channel_id: channel.id });
  key = normalizeExternalApiKey(keyRecord);
});

afterAll(async () => {
  configModule.stopWatchingConfig();
  await sequelize.close();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
    await admin.close();
  }
});

test('catalog IDs feed real request models and management DTOs', async () => {
  const mapper = require('../modules/channel/channelMappers');
  expect(mapper.mapChannelListEntry(channel).database_id).toBe(channel.id);
  const channels = await catalog.listChannels(key);
  expect(channels.data[0]).toMatchObject({ id: channel.id, channelId: youtubeChannelId });
  const api = service();
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channels.data[0].id });
  const detail = await api.getAdminRequest(created.request.id);
  expect(detail.target).toMatchObject({ channelId: channel.id, youtubeChannelId, title: 'Synthetic video' });
});

test('title cursors round trip long Unicode titles from real catalog rows', async () => {
  await models.ChannelVideo.update({ title: '長'.repeat(240) }, { where: { youtube_id: youtubeId } });
  await models.ChannelVideo.create({ youtube_id: 'lmnopqrstuv', channel_id: youtubeChannelId,
    title: '長'.repeat(240), publishedAt: timestamp.toISOString() });
  const first = await catalog.listVideos(key, { sortBy: 'title', pageSize: '1' });
  const second = await catalog.listVideos(key, { sortBy: 'title', pageSize: '1', cursor: first.pagination.nextCursor });
  expect(second.data).toHaveLength(1);
  expect(second.data[0].youtubeId).not.toBe(first.data[0].youtubeId);
});


test('concurrent duplicates reserve one accepted write', async () => {
  const api = service();
  const results = await Promise.all(Array.from({ length: 5 }, () => api.createVideoRequest(key,
    { youtubeId, channelId: channel.id, idempotencyKey: 'same-operation' })));
  expect(new Set(results.map(result => result.request.id)).size).toBe(1);
  expect((await models.ExternalApiUsageBucket.findAll()).map(bucket => bucket.accepted_writes)).toEqual([1, 1]);
});

test('completed channel requests replay the original idempotency key', async () => {
  await policy({ auto_approve_channel_requests: true });
  const api = service();
  const input = { channelUrl: 'https://www.youtube.com/@synthetic', idempotencyKey: 'channel-replay' };
  const first = await api.createChannelRequest(key, input);
  expect(first.request.status).toBe('completed');
  const replay = await api.createChannelRequest(key, input);
  expect(replay.request.id).toBe(first.request.id);
});

test('completed deletion requests replay after the video is removed', async () => {
  await policy({ auto_approve_delete_requests: true });
  await downloadedVideo();
  const api = service();
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'delete-replay' };
  const first = await api.createDeleteVideoRequest(key, input);
  expect(first.request.status).toBe('completed');
  const replay = await api.createDeleteVideoRequest(key, input);
  expect(replay.request.id).toBe(first.request.id);
});

test('a saturated queue can retry the same accepted request without spending another write', async () => {
  await policy({ auto_approve_video_requests: true });
  const limiter = createExternalWorkLimiter({ concurrency: 1, maxQueue: 0 });
  let release;
  const blocker = limiter.run(() => new Promise(resolve => { release = resolve; }));
  const api = service({ workLimiter: limiter });
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'retry-queue' };
  try {
    await expect(api.createVideoRequest(key, input)).rejects.toMatchObject({ status: 503 });
  } finally { release(); await blocker; }
  const retried = await api.createVideoRequest(key, input);
  expect(retried.request.status).toBe('processing');
  expect(await models.Job.count()).toBe(1);
  expect((await models.ExternalApiUsageBucket.findAll()).map(bucket => bucket.accepted_writes)).toEqual([1, 1]);
});

test('quota windows roll over at UTC midnight without carrying previous writes', async () => {
  const before = createExternalQuotaService({ models, sequelize, now: () => new Date('2026-10-07T23:59:59Z') });
  const after = createExternalQuotaService({ models, sequelize, now: () => new Date('2026-10-08T00:00:00Z') });
  await before.reserveWrite(key.id, 'video:request');
  expect((await after.status(key)).remaining).toMatchObject({ hourlyWrites: 30, dailyWrites: 200 });
});

test('two stale recovery readers cannot both reclaim a channel request', async () => {
  await policy({ auto_approve_channel_requests: true });
  const api = service();
  await policy({ auto_approve_channel_requests: false });
  const input = { channelUrl: 'https://www.youtube.com/@synthetic', idempotencyKey: 'stale-recovery' };
  const created = await api.createChannelRequest(key, input);
  await models.ExternalRequest.update({ status: 'processing', decided_at: timestamp,
    updated_at: new Date(timestamp.getTime() - 600000) }, { where: { id: created.request.id } });
  await policy({ auto_approve_channel_requests: true });
  let readers = 0;
  let release;
  const bothRead = new Promise(resolve => { release = resolve; });
  models.ExternalRequest.addHook('afterFind', 'coordinateRecovery', async record => {
    if (record?.id !== created.request.id || record.updated_at >= timestamp) return;
    readers += 1;
    if (readers === 2) release();
    await bothRead;
  });
  const provisioner = { getChannelInfo: jest.fn(async () => ({ channel_id: youtubeChannelId })) };
  try {
    await Promise.all([service({ channelProvisioner: provisioner }).createChannelRequest(key, input),
      service({ channelProvisioner: provisioner }).createChannelRequest(key, input)]);
    expect(provisioner.getChannelInfo).toHaveBeenCalledTimes(1);
  } finally {
    models.ExternalRequest.removeHook('afterFind', 'coordinateRecovery');
  }
});

test('reconciliation keeps a downloaded video completed when its job is Complete', async () => {
  await policy({ auto_approve_video_requests: true });
  const api = service();
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  await downloadedVideo();
  await models.Job.update({ status: 'Complete' }, { where: { id: created.request.id } });
  expect((await api.getRequest(key, created.request.id)).status).toBe('completed');
});

test('two administrators cannot enqueue the same approval twice', async () => {
  const api = service();
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  const results = await Promise.allSettled([api.reviewRequest(created.request.id, 'approve'),
    api.reviewRequest(created.request.id, 'approve')]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find(result => result.status === 'rejected').reason.status).toBe(409);
  expect(await models.Job.count()).toBe(1);
});

test('grant revocation while an approval waits for a work slot prevents enqueue', async () => {
  const limiter = createExternalWorkLimiter({ concurrency: 1, maxQueue: 1 });
  let release;
  const blocker = limiter.run(() => new Promise(resolve => { release = resolve; }));
  const api = service({ workLimiter: limiter });
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  const approval = api.reviewRequest(created.request.id, 'approve');
  await models.ApiKeyChannelGrant.destroy({ where: { api_key_id: key.id } });
  release();
  await blocker;
  expect((await approval).status).toBe('failed');
  expect(await models.Job.count()).toBe(0);
});

test('retry after enqueue but before request persistence reuses the durable job', async () => {
  await policy({ auto_approve_video_requests: true });
  const api = service();
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'enqueue-crash' };
  models.ExternalRequest.addHook('beforeUpdate', 'simulateConnectionLoss', row => {
    if (row.status === 'processing') throw new Error('Synthetic connection loss after enqueue');
  });
  try {
    await expect(api.createVideoRequest(key, input)).rejects.toThrow('Synthetic connection loss');
  } finally {
    models.ExternalRequest.removeHook('beforeUpdate', 'simulateConnectionLoss');
  }
  const executor = jest.fn();
  const result = await service({ executor }).createVideoRequest(key, input);
  expect(result.request.status).toBe('processing');
  expect(executor).not.toHaveBeenCalled();
  expect(await models.Job.count()).toBe(1);
});

test('idempotency keys cannot replay a deletion as a video request', async () => {
  const video = await downloadedVideo();
  const api = service();
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'cross-operation' };
  await api.createDeleteVideoRequest(key, input);
  await video.update({ removed: true });
  await expect(api.createVideoRequest(key, input)).rejects.toMatchObject({ status: 409 });
});
test('runtime indexes preserve equivalent indexes and survive rollback and partial reapply', async () => {
  const migration = require('../../migrations/20261007041058-add-external-api-runtime-indexes');
  const queryInterface = sequelize.getQueryInterface();
  await migration.down(queryInterface);
  const customName = 'custom_external_catalog_lookup';
  await queryInterface.addIndex('external_requests', migration.INDEXES[0].fields, { name: customName });
  try {
    await migration.up(queryInterface);
    await migration.up(queryInterface);
    let names = (await queryInterface.showIndex('external_requests')).map(index => index.name);
    expect(names).toContain(customName);
    expect(names).not.toContain(migration.INDEXES[0].name);
    expect(names).toContain(migration.INDEXES[1].name);
    await migration.down(queryInterface);
    names = (await queryInterface.showIndex('external_requests')).map(index => index.name);
    expect(names).toContain(customName);
    expect(names).not.toContain(migration.INDEXES[1].name);
  } finally {
    await queryInterface.removeIndex('external_requests', customName);
    await migration.up(queryInterface);
  }
});

test('manual approval retries reuse the durable job after request persistence fails', async () => {
  const created = await service().createVideoRequest(key, { youtubeId, channelId: channel.id });
  models.ExternalRequest.addHook('beforeUpdate', 'simulateApprovalLoss', row => {
    if (row.status === 'processing') throw new Error('Synthetic approval connection loss');
  });
  try {
    await expect(service().reviewRequest(created.request.id, 'approve')).rejects.toThrow('Synthetic approval');
  } finally { models.ExternalRequest.removeHook('beforeUpdate', 'simulateApprovalLoss'); }
  const executor = jest.fn();
  expect((await service({ executor }).reviewRequest(created.request.id, 'approve')).status).toBe('processing');
  expect(executor).not.toHaveBeenCalled();
  expect(await models.Job.count()).toBe(1);
});

test('channel approval retries preserve an explicit decision not to grant access', async () => {
  await models.ApiKeyChannelGrant.destroy({ where: { api_key_id: key.id } });
  const created = await service().createChannelRequest(key, { channelUrl: 'youtube.com/@synthetic' });
  const limiter = createExternalWorkLimiter({ concurrency: 1, maxQueue: 0 });
  let release;
  const blocker = limiter.run(() => new Promise(resolve => { release = resolve; }));
  try {
    await expect(service({ workLimiter: limiter }).reviewRequest(created.request.id, 'approve',
      { grantToRequestingKey: false })).rejects.toMatchObject({ status: 503 });
  } finally { release(); await blocker; }
  await expect(service().reviewRequest(created.request.id, 'approve',
    { grantToRequestingKey: true })).rejects.toMatchObject({ status: 409 });
  const result = await service().reviewRequest(created.request.id, 'approve');
  expect(result).toMatchObject({ status: 'completed', grantToRequestingKey: false });
  expect(await models.ApiKeyChannelGrant.count()).toBe(0);
});

test('a completed video idempotency replay returns the original request after downloading', async () => {
  await policy({ auto_approve_video_requests: true });
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'completed-video' };
  const first = await service().createVideoRequest(key, input);
  await downloadedVideo();
  const replay = await service().createVideoRequest(key, input);
  expect(replay).toMatchObject({ outcome: 'duplicate', request: { id: first.request.id, status: 'completed' } });
});

test('an active request cannot shadow an idempotency key used for a different operation', async () => {
  const api = service();
  await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  await api.createChannelRequest(key, { channelUrl: 'youtube.com/@synthetic', idempotencyKey: 'used-elsewhere' });
  await expect(api.createVideoRequest(key, { youtubeId, channelId: channel.id,
    idempotencyKey: 'used-elsewhere' })).rejects.toMatchObject({ status: 409 });
});

test('catalog request status selects the newest own-key history and preserves duplicate channels', async () => {
  const duplicate = await models.Channel.create({ channel_id: youtubeChannelId,
    title: 'Unrelated duplicate', enabled: true, default_rating: 'TV-Y' });
  const otherKey = await models.ApiKey.create({ name: 'Other synthetic key', key_hash: 'other-test-only-hash',
    key_prefix: 'otherkey', created_at: timestamp, role: 'admin' });
  await models.ExternalRequest.bulkCreate([
    { api_key_id: key.id, channel_id: channel.id, youtube_id: youtubeId, request_type: 'video',
      status: 'rejected', created_at: new Date(timestamp.getTime() - 1000), updated_at: timestamp },
    { api_key_id: key.id, channel_id: channel.id, youtube_id: youtubeId, request_type: 'video',
      status: 'pending', created_at: timestamp, updated_at: timestamp },
    { api_key_id: otherKey.id, channel_id: duplicate.id, youtube_id: youtubeId, request_type: 'video',
      status: 'failed', created_at: new Date(timestamp.getTime() + 1000), updated_at: timestamp },
  ]);
  expect((await catalog.listVideos(key)).data).toEqual([
    expect.objectContaining({ channelDatabaseId: channel.id, requestStatus: 'pending' }),
  ]);
  expect((await catalog.listChannels(key)).data.map(row => row.id)).toEqual([channel.id]);
  expect(await models.Channel.count()).toBe(2);
});

test.each(['missing', 'disabled', 'terminated'])('management rejects a %s channel grant and rolls back key changes', async state => {
  const express = require('express');
  const request = require('supertest');
  const createApiKeyRoutes = require('../routes/apikeys');
  const app = express();
  app.use(express.json());
  app.use(createApiKeyRoutes({ verifyToken: (req, _res, next) => {
    req.authType = 'session';
    req.log = { error: () => {} };
    next();
  } }));
  if (state === 'disabled') await channel.update({ enabled: false });
  if (state === 'terminated') await channel.update({ terminated_at: timestamp });
  const channelIds = [state === 'missing' ? channel.id + 1000 : channel.id];
  const error = { error: 'Every channel ID must identify an enabled, non-terminated channel' };
  const beforeCount = await models.ApiKey.count();
  await request(app).post('/api/keys')
    .send({ name: 'Invalid grant client', policy: { role: 'view' }, channelIds }).expect(400, error);
  expect(await models.ApiKey.count()).toBe(beforeCount);
  await request(app).put(`/api/keys/${key.id}/external-access`)
    .send({ policy: { role: 'view', maxRatingLevel: 1 }, channelIds }).expect(400, error);
  await keyRecord.reload();
  expect(keyRecord.role).toBe('admin');
  expect(keyRecord.max_rating_level).toBe(4);
  await request(app).put(`/api/keys/${key.id}/channels`).send({ channelIds }).expect(400, error);
  expect(await models.ApiKeyChannelGrant.count({ where: { api_key_id: key.id } })).toBe(1);
});
