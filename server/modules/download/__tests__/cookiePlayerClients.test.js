/* eslint-env jest */

const {
  COOKIE_PLAYER_CLIENTS,
  mergeCookiePlayerClients,
} = require('../cookiePlayerClients');

const MANAGED_TOKEN = `youtube:player_client=${COOKIE_PLAYER_CLIENTS}`;

describe('cookiePlayerClients', () => {
  it('lists default first so accounts that work today keep their format pick', () => {
    expect(COOKIE_PLAYER_CLIENTS.split(',')[0]).toBe('default');
    expect(COOKIE_PLAYER_CLIENTS.split(',')).toEqual(
      expect.arrayContaining(['mweb', 'web_safari'])
    );
  });

  describe('mergeCookiePlayerClients', () => {
    it('returns only the managed token when there are no custom args', () => {
      expect(mergeCookiePlayerClients([])).toEqual(['--extractor-args', MANAGED_TOKEN]);
    });

    it('places the managed token before unrelated custom args', () => {
      expect(mergeCookiePlayerClients(['--retries', '5'])).toEqual([
        '--extractor-args', MANAGED_TOKEN, '--retries', '5',
      ]);
    });

    it('folds player_client into an existing youtube: token instead of adding a second one', () => {
      const result = mergeCookiePlayerClients(['--extractor-args', 'youtube:lang=en']);

      expect(result).toEqual([
        '--extractor-args', `youtube:lang=en;player_client=${COOKIE_PLAYER_CLIENTS}`,
      ]);
    });

    it('folds player_client into the --extractor-args=youtube: single-token form', () => {
      const result = mergeCookiePlayerClients(['--extractor-args=youtube:lang=en', '--retries', '5']);

      expect(result).toEqual([
        `--extractor-args=youtube:lang=en;player_client=${COOKIE_PLAYER_CLIENTS}`, '--retries', '5',
      ]);
    });

    it('lets a user-supplied player_client win and adds nothing', () => {
      const custom = ['--extractor-args', 'youtube:player_client=web_safari'];

      expect(mergeCookiePlayerClients(custom)).toEqual(custom);
    });

    it('recognises yt-dlp key normalisation (case-insensitive key, dash for underscore)', () => {
      const custom = ['--extractor-args', 'YouTube:player-client=web_safari'];

      expect(mergeCookiePlayerClients(custom)).toEqual(custom);
    });

    it('does not treat a youtubetab: token as the youtube: token', () => {
      const result = mergeCookiePlayerClients(['--extractor-args', 'youtubetab:skip=webpage']);

      expect(result).toEqual([
        '--extractor-args', MANAGED_TOKEN,
        '--extractor-args', 'youtubetab:skip=webpage',
      ]);
    });

    it('folds player_client into the last youtube: token when several are given, since yt-dlp keeps only the last', () => {
      const result = mergeCookiePlayerClients([
        '--extractor-args', 'youtube:lang=en',
        '--extractor-args', 'youtube:skip=hls',
      ]);

      expect(result).toEqual([
        '--extractor-args', 'youtube:lang=en',
        '--extractor-args', `youtube:skip=hls;player_client=${COOKIE_PLAYER_CLIENTS}`,
      ]);
    });

    it('ignores a player_client in an earlier youtube: token that yt-dlp would discard anyway', () => {
      const result = mergeCookiePlayerClients([
        '--extractor-args', 'youtube:player_client=web',
        '--extractor-args=youtube:lang=en',
      ]);

      expect(result).toEqual([
        '--extractor-args', 'youtube:player_client=web',
        `--extractor-args=youtube:lang=en;player_client=${COOKIE_PLAYER_CLIENTS}`,
      ]);
    });

    it('lets a player_client in the last youtube: token win over earlier tokens', () => {
      const custom = [
        '--extractor-args=youtube:lang=en',
        '--extractor-args', 'youtube:player_client=web_safari',
      ];

      expect(mergeCookiePlayerClients(custom)).toEqual(custom);
    });

    it('does not mutate the input array', () => {
      const custom = ['--extractor-args', 'youtube:lang=en'];
      const snapshot = [...custom];

      mergeCookiePlayerClients(custom);

      expect(custom).toEqual(snapshot);
    });
  });
});
