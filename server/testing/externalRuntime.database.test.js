'use strict';

const path = require('path');
const { Sequelize } = require('sequelize');
const Umzug = require('umzug');

process.env.DB_NAME = `youtarr_runtime_test_${process.pid}`;
const { sequelize } = require('../db');
const models = require('../models');
const { normalizeExternalApiKey } = require('../middleware/externalApiAuth');
const { createExternalRequestService } = require('../modules/externalApi/externalRequestService');
const { createExternalQuotaService } = require('../modules/externalApi/externalQuotaService');
const { createExternalWorkLimiter } = require('../modules/externalApi/externalWorkLimiter');
const { EXTERNAL_REQUEST_JOB_LABEL } = require('../modules/externalApi/externalRequestExecutor');
const { isSpecificUrlDownloadJob } = require('../modules/download/jobTypes');
const catalog = require('../modules/externalApi/externalCatalogService');
const configModule = require('../modules/configModule');

const youtubeId = 'abcdefghijk';
const youtubeChannelId = 'UC1234567890123456789012';
const timestamp = new Date('2026-10-07T12:00:00Z');
let admin;
let channel;
let keyRecord;
let key;

const services = [];

function service(options = {}) {
  const api = createExternalRequestService({
    models, sequelize, now: () => timestamp,
    downloader: async (jobData, { jobId }) => {
      expect(isSpecificUrlDownloadJob(jobData.jobLabel)).toBe(true);
      await models.Job.findOrCreate({
        where: { id: jobId },
        defaults: { status: 'Pending', timeCreated: timestamp, timeInitiated: timestamp, jobType: jobData.jobLabel },
      });
      return jobId;
    },
    channelProvisioner: { getChannelInfo: async () => ({ channel_id: youtubeChannelId }) },
    videoDeleter: {
      deleteVideos: async (ids) => {
        await models.Video.update({ removed: true }, { where: { id: ids } });
        return { success: true, deleted: ids, failed: [] };
      },
    },
    storageGuard: { isPausedError: (error) => error?.code === 'DOWNLOADS_PAUSED' },
    jobLookup: () => null,
    logger: { warn: () => {}, error: () => {} },
    ...options,
  });
  services.push(api);
  return api;
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

afterEach(async () => {
  // Approvals wake the executor in the background; let that work settle
  // before the next test clears the tables.
  await Promise.all(services.splice(0).map((api) => api.runExecutorOnce()));
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
  expect(first.request.status).toBe('approved');
  await api.runExecutorOnce();
  const replay = await api.createChannelRequest(key, input);
  expect(replay.request).toMatchObject({ id: first.request.id, status: 'completed' });
});

test('completed deletion requests replay after the video is removed', async () => {
  await policy({ auto_approve_delete_requests: true });
  await downloadedVideo();
  const api = service();
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'delete-replay' };
  const first = await api.createDeleteVideoRequest(key, input);
  await api.runExecutorOnce();
  expect((await models.Video.findOne({ where: { youtubeId } })).removed).toBe(true);
  const replay = await api.createDeleteVideoRequest(key, input);
  expect(replay.request).toMatchObject({ id: first.request.id, status: 'completed' });
});

test('channel provisioning holds no lock that blocks key usage updates', async () => {
  await policy({ auto_approve_channel_requests: true });
  let release;
  let started;
  const provisioning = new Promise(resolve => { started = resolve; });
  const provisioner = { getChannelInfo: async () => {
    started();
    await new Promise(resolve => { release = resolve; });
    return { channel_id: youtubeChannelId };
  } };
  const api = service({ channelProvisioner: provisioner });
  await api.createChannelRequest(key, { channelUrl: 'https://www.youtube.com/@synthetic' });
  const run = api.runExecutorOnce();
  await provisioning;
  try {
    // The usage-timestamp UPDATE every external request makes on its key row
    // must not wait behind yt-dlp.
    await sequelize.transaction(async (transaction) => {
      await sequelize.query('SET SESSION innodb_lock_wait_timeout = 2', { transaction });
      await models.ApiKey.update({ last_used_at: timestamp }, { where: { id: key.id }, transaction });
    });
  } finally {
    release();
    await run;
  }
  expect((await models.ExternalRequest.findOne()).status).toBe('completed');
});

test('a full work queue holds an approved request without spending another write', async () => {
  await policy({ auto_approve_channel_requests: true });
  const limiter = createExternalWorkLimiter({ concurrency: 1, maxQueue: 0 });
  let release;
  const blocker = limiter.run(() => new Promise(resolve => { release = resolve; }));
  const api = service({ workLimiter: limiter });
  const created = await api.createChannelRequest(key, { channelUrl: 'https://www.youtube.com/@synthetic' });
  try {
    await api.runExecutorOnce();
    expect((await api.getRequest(key, created.request.id)).status).toBe('approved');
  } finally { release(); await blocker; }
  await api.runExecutorOnce();
  expect((await api.getRequest(key, created.request.id)).status).toBe('completed');
  expect((await models.ExternalApiUsageBucket.findAll()).map(bucket => bucket.accepted_writes)).toEqual([1, 1]);
});

test('paused downloads hold an approved video request until they resume', async () => {
  await policy({ auto_approve_video_requests: true });
  let paused = true;
  const api = service({
    downloader: async (_jobData, { jobId }) => {
      if (paused) throw Object.assign(new Error('Downloads are paused'), { code: 'DOWNLOADS_PAUSED' });
      await models.Job.create({ id: jobId, status: 'Pending', jobType: 'External', timeCreated: timestamp, timeInitiated: timestamp });
      return jobId;
    },
  });
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  await api.runExecutorOnce();
  expect(await api.getRequest(key, created.request.id)).toMatchObject({
    status: 'approved', message: 'Waiting for downloads to resume',
  });
  paused = false;
  await api.runExecutorOnce();
  expect((await api.getRequest(key, created.request.id)).status).toBe('processing');
});

test('quota windows roll over at UTC midnight without carrying previous writes', async () => {
  const before = createExternalQuotaService({ models, sequelize, now: () => new Date('2026-10-07T23:59:59Z') });
  const after = createExternalQuotaService({ models, sequelize, now: () => new Date('2026-10-08T00:00:00Z') });
  await before.reserveWrite(key.id, 'video:request');
  expect((await after.status(key)).remaining).toMatchObject({ hourlyWrites: 30, dailyWrites: 200 });
});

test('two executors cannot both run the same approved request', async () => {
  await policy({ auto_approve_channel_requests: true });
  const provisioner = { getChannelInfo: jest.fn(async () => ({ channel_id: youtubeChannelId })) };
  await service().createChannelRequest(key, { channelUrl: 'https://www.youtube.com/@synthetic' });
  await Promise.all([service({ channelProvisioner: provisioner }).runExecutorOnce(),
    service({ channelProvisioner: provisioner }).runExecutorOnce()]);
  expect(provisioner.getChannelInfo).toHaveBeenCalledTimes(1);
});

test('a finished download job closes its request through the job-ended hook', async () => {
  await policy({ auto_approve_video_requests: true });
  const api = service({
    jobLookup: () => ({ jobType: EXTERNAL_REQUEST_JOB_LABEL, status: 'Complete' }),
  });
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  await api.runExecutorOnce();
  await downloadedVideo();
  await api.handleJobEnded({ jobId: created.request.id });
  expect((await api.listRequests(key, { status: 'completed' })).data.map(row => row.id))
    .toEqual([created.request.id]);
});

test('two administrators approving at once record one approval and one job', async () => {
  const api = service();
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  const results = await Promise.all([api.reviewRequest(created.request.id, 'approve'),
    api.reviewRequest(created.request.id, 'approve')]);
  expect(results.map(result => result.status)).toEqual(['approved', 'approved']);
  await api.runExecutorOnce();
  expect(await models.Job.count()).toBe(1);
});

test('grant revocation after approval prevents enqueue', async () => {
  const api = service();
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  await api.reviewRequest(created.request.id, 'approve');
  await models.ApiKeyChannelGrant.destroy({ where: { api_key_id: key.id } });
  await api.runExecutorOnce();
  expect((await api.getAdminRequest(created.request.id)).status).toBe('failed');
  expect(await models.Job.count()).toBe(0);
});

test('a lost job-id write is recovered by adopting the queued job', async () => {
  await policy({ auto_approve_video_requests: true });
  let downloads = 0;
  const api = service({
    downloader: async (_jobData, { jobId }) => {
      downloads += 1;
      await models.Job.create({ id: jobId, status: 'Pending', jobType: 'External', timeCreated: timestamp, timeInitiated: timestamp });
      return jobId;
    },
  });
  const created = await api.createVideoRequest(key, { youtubeId, channelId: channel.id });
  models.ExternalRequest.addHook('beforeBulkUpdate', 'simulateConnectionLoss', options => {
    if (options.attributes.job_id) throw new Error('Synthetic connection loss after enqueue');
  });
  try {
    await api.runExecutorOnce();
  } finally {
    models.ExternalRequest.removeHook('beforeBulkUpdate', 'simulateConnectionLoss');
  }
  expect((await models.ExternalRequest.findByPk(created.request.id)).job_id).toBeNull();
  await models.ExternalRequest.update({ updated_at: new Date(timestamp.getTime() - 600000) },
    { where: { id: created.request.id } });
  await api.runExecutorOnce();
  expect((await models.ExternalRequest.findByPk(created.request.id)).job_id).toBe(created.request.id);
  expect(downloads).toBe(1);
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

test('channel approvals keep an explicit decision not to grant access', async () => {
  await models.ApiKeyChannelGrant.destroy({ where: { api_key_id: key.id } });
  const api = service();
  const created = await api.createChannelRequest(key, { channelUrl: 'youtube.com/@synthetic' });
  await api.reviewRequest(created.request.id, 'approve', { grantToRequestingKey: false });
  await expect(api.reviewRequest(created.request.id, 'approve',
    { grantToRequestingKey: true })).rejects.toMatchObject({ status: 409 });
  await api.runExecutorOnce();
  const result = await api.getAdminRequest(created.request.id);
  expect(result).toMatchObject({ status: 'completed', grantToRequestingKey: false, approvalSource: 'admin' });
  expect(await models.ApiKeyChannelGrant.count()).toBe(0);
});

test('a terminated channel is never re-enabled by a channel request', async () => {
  await policy({ auto_approve_channel_requests: true });
  await channel.update({ enabled: false, terminated_at: timestamp });
  const api = service();
  const created = await api.createChannelRequest(key, { channelUrl: 'https://www.youtube.com/@synthetic' });
  await api.runExecutorOnce();
  expect((await api.getRequest(key, created.request.id))).toMatchObject({
    status: 'failed', message: 'Channel is unavailable',
  });
  await channel.reload();
  expect(channel.enabled).toBe(false);
});

test('a completed video idempotency replay returns the original request after downloading', async () => {
  await policy({ auto_approve_video_requests: true });
  const api = service({
    jobLookup: () => ({ jobType: EXTERNAL_REQUEST_JOB_LABEL, status: 'Complete' }),
  });
  const input = { youtubeId, channelId: channel.id, idempotencyKey: 'completed-video' };
  const first = await api.createVideoRequest(key, input);
  await api.runExecutorOnce();
  await downloadedVideo();
  await api.handleJobEnded({ jobId: first.request.id });
  const replay = await api.createVideoRequest(key, input);
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
