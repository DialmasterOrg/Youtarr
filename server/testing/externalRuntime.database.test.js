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
    title: 'Synthetic video', publishedAt: '20261007' });
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
  const channels = await catalog.listChannels(key);
  expect(channels.data[0]).toMatchObject({ id: channel.id, channelId: youtubeChannelId });
  const api = service();
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channels.data[0].id });
  const detail = await api.getAdminRequest(created.request.id);
  expect(detail.target).toMatchObject({ channelId: channel.id, youtubeChannelId, title: 'Synthetic video' });
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
