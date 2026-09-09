jest.mock('../../db', () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: 'transaction' })),
  },
}));
const { Op } = require('sequelize');
jest.mock('../../models', () => ({
  ApiKey: { findByPk: jest.fn() },
  ApiKeyChannelGrant: {
    findAll: jest.fn(),
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  },
  Channel: { count: jest.fn() },
}));

const { ApiKey, ApiKeyChannelGrant, Channel } = require('../../models');
const grants = require('../apiKeyChannelGrantModule');

describe('API key channel grants', () => {
  beforeEach(() => jest.clearAllMocks());

  test('normalizes and transactionally replaces the exact enabled set', async () => {
    ApiKey.findByPk.mockResolvedValue({ id: 7, role: 'view', is_active: true, revoked_at: null });
    Channel.count.mockResolvedValue(2);
    const result = await grants.replaceChannelGrants(7, [9, 3, 9]);
    expect(result).toEqual({ keyId: 7, channelIds: [3, 9] });
    expect(ApiKeyChannelGrant.destroy).toHaveBeenCalledWith({
      where: { api_key_id: 7 }, transaction: { id: 'transaction' },
    });
    expect(ApiKeyChannelGrant.bulkCreate).toHaveBeenCalledWith(
      [{ api_key_id: 7, channel_id: 3 }, { api_key_id: 7, channel_id: 9 }],
      { transaction: { id: 'transaction' } }
    );
  });

  test('lists only grants whose channels are still enabled and non-terminated', async () => {
    ApiKey.findByPk.mockResolvedValue({
      id: 7, role: 'view', is_active: true, revoked_at: null,
    });
    ApiKeyChannelGrant.findAll.mockResolvedValue([{ channel_id: 3 }]);

    await expect(grants.getChannelGrants(7)).resolves.toEqual({
      keyId: 7,
      channelIds: [3],
    });
    expect(ApiKeyChannelGrant.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { api_key_id: 7 },
      include: [expect.objectContaining({
        model: Channel,
        as: 'channel',
        required: true,
        where: { enabled: true, terminated_at: { [Op.is]: null } },
      })],
    }));
  });

  test('counts only grants whose channels are still enabled and non-terminated', async () => {
    ApiKeyChannelGrant.findAll.mockResolvedValue([
      { api_key_id: 7, channel_id: 3 },
      { api_key_id: 7, channel_id: 5 },
      { api_key_id: 9, channel_id: 8 },
    ]);

    await expect(grants.getEffectiveChannelGrantCounts([7, 9, 12])).resolves.toEqual(
      new Map([[7, 2], [9, 1]])
    );
    expect(ApiKeyChannelGrant.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { api_key_id: [7, 9, 12] },
      include: [expect.objectContaining({
        model: Channel,
        as: 'channel',
        required: true,
        where: { enabled: true, terminated_at: { [Op.is]: null } },
      })],
    }));
  });

  test('rejects legacy keys before changing grants', async () => {
    ApiKey.findByPk.mockResolvedValue({ id: 7, role: 'legacy_download', is_active: true, revoked_at: null });
    await expect(grants.replaceChannelGrants(7, [3])).rejects.toThrow('Only active external API keys');
    expect(ApiKeyChannelGrant.destroy).not.toHaveBeenCalled();
  });

  test('rejects disabled or unknown channel IDs before changing grants', async () => {
    ApiKey.findByPk.mockResolvedValue({ id: 7, role: 'view', is_active: true, revoked_at: null });
    Channel.count.mockResolvedValue(1);
    await expect(grants.replaceChannelGrants(7, [3, 9])).rejects.toThrow('Every channel ID');
    expect(ApiKeyChannelGrant.destroy).not.toHaveBeenCalled();
  });
});
