jest.mock('../../models/apikey', () => ({
  count: jest.fn(), create: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(),
}));
jest.mock('../../modules/apiKeyChannelGrantModule', () => ({
  getEffectiveChannelGrantCounts: jest.fn(),
}));
jest.mock('../../logger', () => ({ info: jest.fn(), debug: jest.fn() }));

const ApiKey = require('../../models/apikey');
const { getEffectiveChannelGrantCounts } = require('../../modules/apiKeyChannelGrantModule');
const apiKeyModule = require('../apiKeyModule');

describe('external API key policies', () => {
  beforeEach(() => jest.clearAllMocks());

  test('creates legacy-compatible keys when policy is omitted', async () => {
    ApiKey.count.mockResolvedValue(0);
    ApiKey.create.mockResolvedValue({ id: 1, name: 'Legacy' });
    const created = await apiKeyModule.createApiKey('Legacy');
    expect(created).toMatchObject({ id: 1, name: 'Legacy' });
    expect(ApiKey.create.mock.calls[0][0].role).toBeUndefined();
  });

  test('strictly validates policy fields and defaults', async () => {
    expect(() => apiKeyModule.validatePolicy({ role: 'view', unsupported: true })).toThrow('Unsupported');
    expect(() => apiKeyModule.validatePolicy({ role: 'view', maxRatingLevel: 5 })).toThrow('maxRatingLevel');
    expect(() => apiKeyModule.validatePolicy({ role: 'view', allowedMediaTypes: ['audio'] })).toThrow('allowedMediaTypes');
    expect(apiKeyModule.validatePolicy({ role: 'view' })).toEqual(expect.objectContaining({
      role: 'view', max_rating_level: 4, allowed_media_types: ['video'],
    }));
    expect(apiKeyModule.validatePolicy({
      role: 'view', allowedMediaTypes: ['video', 'short', 'livestream'],
    }).allowed_media_types).toEqual(['video', 'short', 'livestream']);
    expect(() => apiKeyModule.validatePolicy({
      role: 'view',
      allowVideoRequests: false,
      allowChannelRequests: false,
      allowDeleteVideoRequests: false,
      autoApproveVideoRequests: true,
      autoApproveChannelRequests: true,
      autoApproveDeleteRequests: true,
    })).toThrow('requires');
    expect(() => apiKeyModule.validatePolicy({
      role: 'request',
      allowVideoRequests: true,
      allowChannelRequests: false,
      allowDeleteVideoRequests: false,
      autoApproveVideoRequests: true,
      autoApproveChannelRequests: true,
    })).toThrow('autoApproveChannelRequests');
    expect(apiKeyModule.validatePolicy({
      role: 'request',
      allowVideoRequests: true,
      allowChannelRequests: false,
      allowDeleteVideoRequests: false,
      autoApproveVideoRequests: true,
      autoApproveChannelRequests: false,
    })).toEqual(expect.objectContaining({
      role: 'request',
      allow_video_requests: true,
      allow_channel_requests: false,
      allow_delete_video_requests: false,
      auto_approve_video_requests: true,
      auto_approve_channel_requests: false,
    }));
  });

  test('updates an existing key policy', async () => {
    const key = {
      id: 1, name: 'External', key_hash: 'must-not-leak', key_prefix: '12345678',
      role: 'view', is_active: true, revoked_at: null, update: jest.fn().mockResolvedValue(),
    };
    ApiKey.findByPk.mockResolvedValue(key);
    const result = await apiKeyModule.updateApiKey(1, { role: 'request' });
    expect(result).toEqual(expect.objectContaining({ id: 1, name: 'External', key_prefix: '12345678' }));
    expect(result).not.toHaveProperty('key_hash');
    expect(key.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'request' }));
  });

  test('does not convert between legacy and constrained key types', async () => {
    ApiKey.findByPk.mockResolvedValue({
      id: 1,
      role: 'legacy_download',
      is_active: true,
      revoked_at: null,
    });
    await expect(apiKeyModule.updateApiKey(1, { role: 'view' }))
      .rejects.toThrow('cannot be converted');

    ApiKey.findByPk.mockResolvedValue({
      id: 2,
      role: 'view',
      is_active: true,
      revoked_at: null,
    });
    await expect(apiKeyModule.updateApiKey(2, { role: 'legacy_download' }))
      .rejects.toThrow('cannot be converted');
  });

  test('regenerates an active key in place and returns the new secret once', async () => {
    const key = {
      id: 1,
      name: 'External',
      is_active: true,
      revoked_at: null,
      update: jest.fn().mockResolvedValue(),
    };
    ApiKey.findByPk.mockResolvedValue(key);

    const result = await apiKeyModule.regenerateApiKey(1);

    expect(result).toEqual(expect.objectContaining({
      id: 1,
      name: 'External',
      key: expect.stringMatching(/^[a-f0-9]{64}$/),
      prefix: expect.stringMatching(/^[a-f0-9]{8}$/),
    }));
    expect(result.key.startsWith(result.prefix)).toBe(true);
    expect(key.update).toHaveBeenCalledWith({
      key_hash: require('crypto').createHash('sha256').update(result.key).digest('hex'),
      key_prefix: result.prefix,
      last_used_at: null,
    });
  });

  test('does not regenerate missing or revoked keys', async () => {
    ApiKey.findByPk.mockResolvedValueOnce(null);
    await expect(apiKeyModule.regenerateApiKey(1)).resolves.toBeNull();
    ApiKey.findByPk.mockResolvedValueOnce({
      id: 2, is_active: false, revoked_at: new Date(),
    });
    await expect(apiKeyModule.regenerateApiKey(2)).resolves.toBeNull();
  });

  test('uses the management response contract for lists without key hashes', async () => {
    ApiKey.findAll.mockResolvedValue([{ id: 1, name: 'Safe', key_hash: 'must-not-leak', key_prefix: '12345678' }]);
    getEffectiveChannelGrantCounts.mockResolvedValue(new Map([[1, 2]]));
    await expect(apiKeyModule.listApiKeys()).resolves.toEqual([
      { id: 1, name: 'Safe', key_prefix: '12345678', channel_grant_count: 2 },
    ]);
    expect(getEffectiveChannelGrantCounts).toHaveBeenCalledWith([1]);
  });

  test('retains soft-revoked keys in the management list for audit visibility', async () => {
    const key = { id: 1, name: 'Revoked', key_prefix: '12345678', revoked_at: null, update: jest.fn().mockResolvedValue() };
    ApiKey.findByPk.mockResolvedValue(key);
    await apiKeyModule.deleteApiKey(1);
    ApiKey.findAll.mockResolvedValue([{
      id: 1, name: 'Revoked', key_prefix: '12345678',
      is_active: false, revoked_at: new Date('2026-07-26T00:00:00.000Z'),
    }]);
    getEffectiveChannelGrantCounts.mockResolvedValue(new Map());
    await expect(apiKeyModule.listApiKeys()).resolves.toEqual([
      expect.objectContaining({
        id: 1, name: 'Revoked', is_active: false, channel_grant_count: 0,
      }),
    ]);
    expect(ApiKey.findAll).toHaveBeenCalledWith(expect.not.objectContaining({ where: expect.anything() }));
    expect(key.update).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(Date) }));
  });

  test('soft revokes instead of deleting', async () => {
    const key = { id: 1, name: 'Compromised', key_prefix: '12345678', revoked_at: null, update: jest.fn().mockResolvedValue() };
    ApiKey.findByPk.mockResolvedValue(key);
    await expect(apiKeyModule.deleteApiKey(1)).resolves.toBe(true);
    expect(key.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false, revoked_at: expect.any(Date) }));
    expect(ApiKey.destroy).toBeUndefined();
  });
});
