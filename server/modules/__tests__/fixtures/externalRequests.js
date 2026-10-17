const { createExternalRequestService } = require('../../externalRequestService');

const timestamp = new Date('2026-07-26T12:00:00.000Z');
const youtubeId = 'abcdefghijk';

function record(overrides = {}) {
  return {
    id: '9b89e5bc-8c90-4e72-b245-270fed2eacc2',
    api_key_id: 4,
    channel_id: 8,
    youtube_id: youtubeId,
    request_type: 'video',
    status: 'pending',
    created_at: timestamp,
    updated_at: timestamp,
    decided_at: null,
    completed_at: null,
    message: null,
    update: jest.fn(async function update(values) {
      Object.assign(this, values);
    }),
    ...overrides,
  };
}

function fixture(overrides = {}) {
  const created = record();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const models = {
    ExternalRequest: {
      create: jest.fn(async (values) => Object.assign(created, values)),
      update: jest.fn().mockResolvedValue([1]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(created),
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
    },
    ApiKeyChannelGrant: {
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      findOrCreate: jest.fn().mockResolvedValue([{ id: 1 }, true]),
    },
    Channel: {
      findByPk: jest.fn().mockResolvedValue({
        id: 8, channel_id: 'UC1234567890123456789012', enabled: true, default_rating: 'TV-Y',
      }),
      findOne: jest.fn().mockResolvedValue({
        id: 8, channel_id: 'UC1234567890123456789012', enabled: true,
        terminated_at: null, default_rating: 'TV-Y',
      }),
    },
    ChannelVideo: {
      findOne: jest.fn().mockResolvedValue({
        youtube_id: youtubeId, media_type: 'video', youtube_removed: false, ignored: false,
      }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Video: { findOne: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]) },
    Job: { findByPk: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]) },
    ApiKey: {
      findByPk: jest.fn().mockResolvedValue({
        id: 4,
        name: 'External Client',
        role: 'request',
        is_active: true,
        revoked_at: null,
        allow_video_requests: true,
        allow_channel_requests: true,
        allow_delete_video_requests: false,
        auto_approve_video_requests: false,
        auto_approve_channel_requests: false,
        auto_approve_delete_requests: false,
        max_rating_level: 2,
        allow_unrated: false,
        allowed_media_types: ['video'],
        max_active_jobs: 5,
        hourly_write_limit: 30,
        daily_write_limit: 200,
      }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ...overrides.models,
  };
  const sequelize = {
    transaction: jest.fn(async (callback) => callback(transaction)),
  };
  const executor = jest.fn().mockResolvedValue(undefined);
  const channelProvisioner = overrides.channelProvisioner || {
    getChannelInfo: jest.fn().mockResolvedValue({ channel_id: 'UC1234567890123456789012' }),
  };
  const videoDeleter = overrides.videoDeleter || {
    deleteVideosByYoutubeIds: jest.fn().mockResolvedValue({ success: true, failed: [] }),
    deleteVideoById: jest.fn().mockResolvedValue({ success: true }),
  };
  const quotaService = overrides.quotaService || {
    reserveWrite: jest.fn(async () => ({
      id: 4,
      name: 'External Client',
      role: 'request',
      isActive: true,
      autoApproveVideoRequests: overrides.key?.autoApproveVideoRequests ?? false,
      autoApproveChannelRequests: overrides.key?.autoApproveChannelRequests ?? false,
      autoApproveDeleteRequests: overrides.key?.autoApproveDeleteRequests ?? false,
      allowVideoRequests: overrides.key?.allowVideoRequests ?? true,
      allowChannelRequests: overrides.key?.allowChannelRequests ?? true,
      allowDeleteVideoRequests: overrides.key?.allowDeleteVideoRequests ?? false,
      maxRatingLevel: 2,
      allowUnrated: false,
      allowedMediaTypes: ['video'],
    })),
    reloadAuthorizedKey: jest.fn(async () => ({
      id: 4,
      name: 'External Client',
      role: 'request',
      autoApproveVideoRequests: overrides.key?.autoApproveVideoRequests ?? false,
      autoApproveChannelRequests: overrides.key?.autoApproveChannelRequests ?? false,
      autoApproveDeleteRequests: overrides.key?.autoApproveDeleteRequests ?? false,
      allowVideoRequests: overrides.key?.allowVideoRequests ?? true,
      allowChannelRequests: overrides.key?.allowChannelRequests ?? true,
      allowDeleteVideoRequests: overrides.key?.allowDeleteVideoRequests ?? false,
      maxRatingLevel: 2,
      allowUnrated: false,
      allowedMediaTypes: ['video'],
    })),
    assertExecutionCapacity: jest.fn(async () => ({
      id: 4,
      name: 'External Client',
      role: 'request',
      autoApproveVideoRequests: overrides.key?.autoApproveVideoRequests ?? false,
      autoApproveChannelRequests: overrides.key?.autoApproveChannelRequests ?? false,
      autoApproveDeleteRequests: overrides.key?.autoApproveDeleteRequests ?? false,
      allowVideoRequests: overrides.key?.allowVideoRequests ?? true,
      allowChannelRequests: overrides.key?.allowChannelRequests ?? true,
      allowDeleteVideoRequests: overrides.key?.allowDeleteVideoRequests ?? false,
      maxRatingLevel: 2,
      allowUnrated: false,
      allowedMediaTypes: ['video'],
    })),
  };
  const service = createExternalRequestService({
    models,
    executor: overrides.executor || executor,
    channelProvisioner,
    videoDeleter,
    now: overrides.now || (() => timestamp),
    sequelize: overrides.sequelize || sequelize,
    quotaService,
    workLimiter: overrides.workLimiter,
  });
  const key = {
    id: 4,
    name: 'External Client',
    role: 'request',
    autoApproveVideoRequests: false,
    autoApproveChannelRequests: false,
    autoApproveDeleteRequests: false,
    maxRatingLevel: 2,
    allowUnrated: false,
    allowedMediaTypes: ['video'],
    ...overrides.key,
  };
  return {
    service, models, executor, key, created, sequelize, transaction,
    channelProvisioner, videoDeleter, quotaService,
  };
}

module.exports = { fixture, record, timestamp, youtubeId };
