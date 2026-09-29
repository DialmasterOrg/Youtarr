/* eslint-env jest */
const { createLogScrubber } = require('../logScrubber');

const PLEX_TOKEN = 'plexToken123abc';

describe('createLogScrubber', () => {
  test('hides the configured secret values wherever they appear', () => {
    const scrub = createLogScrubber({ plexApiKey: PLEX_TOKEN, embyApiKey: 'embyKey987654' });

    expect(scrub(`url: "http://plex/sections?foo=${PLEX_TOKEN}" key embyKey987654`))
      .toBe('url: "http://plex/sections?foo=[REDACTED]" key [REDACTED]');
  });

  test('hides configured notification URLs, which carry webhook and bot tokens', () => {
    const scrub = createLogScrubber({
      appriseUrls: [{ url: 'discord://123456/webhookToken', name: 'Discord' }, 'tgram://botToken123/chatId'],
    });

    expect(scrub('stderr: failed to send to discord://123456/webhookToken and tgram://botToken123/chatId'))
      .toBe('stderr: failed to send to [REDACTED] and [REDACTED]');
  });

  test('ignores blank and very short configured values', () => {
    const scrub = createLogScrubber({ plexApiKey: '', youtubeApiKey: 'abc' });

    expect(scrub('abc started')).toBe('abc started');
  });

  test('hides Plex tokens in query strings', () => {
    const scrub = createLogScrubber({});

    expect(scrub('GET http://plex:32400/library?X-Plex-Token=unknownToken&type=1'))
      .toBe('GET http://plex:32400/library?X-Plex-Token=[REDACTED]&type=1');
  });

  test('hides token headers and params in logged JSON', () => {
    const scrub = createLogScrubber({});

    expect(scrub('{"params":{"X-Plex-Token":"abc123"},"headers":{"X-Emby-Token":"def456"}}'))
      .toBe('{"params":{"X-Plex-Token":"[REDACTED]"},"headers":{"X-Emby-Token":"[REDACTED]"}}');
  });

  test('hides api_key query parameters', () => {
    const scrub = createLogScrubber({});

    expect(scrub('GET /Items?api_key=secretvalue&x=1')).toBe('GET /Items?api_key=[REDACTED]&x=1');
  });

  test('hides proxy credentials but keeps the host', () => {
    const scrub = createLogScrubber({});

    expect(scrub('args ["--proxy","http://user:p4ss@proxy.local:8080"]'))
      .toBe('args ["--proxy","http://[REDACTED]@proxy.local:8080"]');
  });

  test('leaves ordinary lines unchanged', () => {
    const scrub = createLogScrubber({ plexApiKey: PLEX_TOKEN });
    const line = '[2026-09-25 12:00:00.000 +0000] INFO: Download complete {"videoId":"abc"}';

    expect(scrub(line)).toBe(line);
  });
});
