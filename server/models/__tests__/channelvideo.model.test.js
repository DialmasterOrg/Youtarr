const models = require('../index');

describe('ChannelVideo model registration', () => {
  test('is exported for services that use the shared model registry', () => {
    expect(models.ChannelVideo).toBeDefined();
    expect(models.ChannelVideo.tableName).toBe('channelvideos');
  });

  test('matches nullable cached metadata columns in the database schema', () => {
    expect(models.ChannelVideo.rawAttributes.title.allowNull).toBe(true);
    expect(models.ChannelVideo.rawAttributes.thumbnail.allowNull).toBe(true);
  });
});
