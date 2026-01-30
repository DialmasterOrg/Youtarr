const YtdlpCommandBuilder = require('../modules/download/ytdlpCommandBuilder');

jest.mock('../modules/configModule', () => ({
  getConfig: () => ({
    maxContentRating: 'PG-13',
  }),
  getCookiesPath: () => '/tmp/cookies.txt',
  ffmpegPath: '/usr/bin/ffmpeg',
}));

describe('Rating filter integration', () => {
  it('filters downloads using the configured max content rating', () => {
    const filterConfig = {
      hasFilters: true,
      minDuration: null,
      maxDuration: null,
      titleFilterRegex: '',
    };

    const filters = YtdlpCommandBuilder.buildMatchFilters(filterConfig);

    expect(filters).toContain('availability!=subscriber_only');
    expect(filters).toContain('!is_live');
    expect(filters).toContain('live_status!=is_upcoming');
    expect(filters).toContain('age_limit <= 16');
  });
});
