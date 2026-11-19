const { createTargetValidator } = require('../externalRequestTargets');

const youtubeId = 'abcdefghijk';
const key = { id: 4, maxRatingLevel: 2, allowUnrated: false, allowedMediaTypes: ['video'] };

function models(overrides = {}) {
  return {
    ApiKeyChannelGrant: { findOne: jest.fn().mockResolvedValue({ id: 1 }) },
    Channel: {
      findByPk: jest.fn().mockResolvedValue({
        id: 8, channel_id: 'UC1234567890123456789012', enabled: true, terminated_at: null,
        default_rating: 'TV-Y',
      }),
    },
    ChannelVideo: {
      findOne: jest.fn().mockResolvedValue({
        youtube_id: youtubeId, media_type: 'video', youtube_removed: false, ignored: false,
      }),
    },
    Video: { findOne: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

describe('external request target validation', () => {
  test('returns the channel and no downloaded video for an eligible target', async () => {
    const validateTarget = createTargetValidator({ models: models() });
    await expect(validateTarget(key, youtubeId, 8)).resolves.toMatchObject({
      channel: { id: 8 }, downloaded: null,
    });
  });

  test('returns the downloaded video row with its id', async () => {
    const downloaded = { id: 91, youtubeId, normalized_rating: 'TV-Y', removed: false };
    const validateTarget = createTargetValidator({
      models: models({ Video: { findOne: jest.fn().mockResolvedValue(downloaded) } }),
    });
    await expect(validateTarget(key, youtubeId, 8)).resolves.toMatchObject({ downloaded });
  });

  test('hides an ungranted channel behind the same 404', async () => {
    const validateTarget = createTargetValidator({
      models: models({ ApiKeyChannelGrant: { findOne: jest.fn().mockResolvedValue(null) } }),
    });
    await expect(validateTarget(key, youtubeId, 8)).rejects.toMatchObject({
      status: 404, message: 'Video not found',
    });
  });

  test('locks the grant and catalog rows when given a transaction', async () => {
    const stores = models();
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    await createTargetValidator({ models: stores })(key, youtubeId, 8, transaction);
    expect(stores.ApiKeyChannelGrant.findOne).toHaveBeenCalledWith(expect.objectContaining({
      transaction, lock: 'UPDATE',
    }));
  });
});
