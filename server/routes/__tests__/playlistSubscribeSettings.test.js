/* eslint-env jest */
const { createSubscribeSettingsValidator } = require('../playlistSubscribeSettings');

const channelSettingsModule = {
  validateSubFolder: jest.fn(),
  validateVideoQuality: jest.fn(),
  validateAudioFormat: jest.fn(),
  validateDurationSettings: jest.fn(),
  validateTitleRegex: jest.fn(),
};
// Real ratingMapper: pure module with no DB/IO deps.
const ratingMapper = require('../../modules/ratingMapper');

const validate = createSubscribeSettingsValidator({ channelSettingsModule, ratingMapper });

beforeEach(() => {
  jest.clearAllMocks();
  Object.values(channelSettingsModule).forEach((fn) => fn.mockReturnValue({ valid: true }));
});

describe('createSubscribeSettingsValidator', () => {
  test('absent settings validate to an empty object', () => {
    expect(validate(undefined)).toEqual({ ok: true, value: {} });
  });

  test('rejects settings that are not an object', () => {
    expect(validate(['720'])).toEqual({ ok: false, error: 'settings must be an object' });
  });

  test('drops keys that are not playlist settings', () => {
    const result = validate({ video_quality: '720', enabled: false, playlist_id: 'PLother' });

    expect(result).toEqual({ ok: true, value: { video_quality: '720' } });
  });

  test('keeps every supported setting', () => {
    const settings = {
      auto_download: true,
      sync_to_plex: true,
      sync_to_jellyfin: false,
      sync_to_emby: false,
      public_on_servers: true,
      default_sub_folder: 'Music',
      video_quality: '1080',
      min_duration: 60,
      max_duration: 600,
      title_filter_regex: 'trailer',
      audio_format: 'mp3_only',
      sort_order: 'reversed',
    };

    expect(validate(settings)).toEqual({ ok: true, value: settings });
  });

  test('rejects a non-boolean toggle', () => {
    expect(validate({ auto_download: 'yes' })).toEqual({ ok: false, error: 'auto_download must be a boolean' });
  });

  test('rejects an invalid default_sub_folder', () => {
    channelSettingsModule.validateSubFolder.mockReturnValue({ valid: false, error: 'bad' });

    expect(validate({ default_sub_folder: '../../etc' })).toEqual({ ok: false, error: 'Invalid default_sub_folder' });
  });

  test('accepts an empty default_sub_folder without validating it as a name', () => {
    expect(validate({ default_sub_folder: null })).toEqual({ ok: true, value: { default_sub_folder: null } });
    expect(channelSettingsModule.validateSubFolder).not.toHaveBeenCalled();
  });

  test('reports the channel validator error for an invalid video quality', () => {
    channelSettingsModule.validateVideoQuality.mockReturnValue({ valid: false, error: 'Invalid video quality' });

    expect(validate({ video_quality: '999' })).toEqual({ ok: false, error: 'Invalid video quality' });
  });

  test('reports the channel validator error for an invalid audio format', () => {
    channelSettingsModule.validateAudioFormat.mockReturnValue({ valid: false, error: 'Invalid audio format' });

    expect(validate({ audio_format: 'flac' })).toEqual({ ok: false, error: 'Invalid audio format' });
  });

  test('validates the duration range as a pair', () => {
    validate({ min_duration: 600, max_duration: 60 });

    expect(channelSettingsModule.validateDurationSettings).toHaveBeenCalledWith(600, 60);
  });

  test('rejects an invalid title filter', () => {
    channelSettingsModule.validateTitleRegex.mockReturnValue({ valid: false, error: 'Invalid regex' });

    expect(validate({ title_filter_regex: '(' })).toEqual({ ok: false, error: 'Invalid regex' });
  });

  test.each(['title_filter_regex', 'default_sub_folder', 'video_quality', 'audio_format'])(
    'rejects a non-string %s without calling the validator',
    (key) => {
      expect(validate({ [key]: 123 })).toEqual({ ok: false, error: `${key} must be a string or null` });
    }
  );

  test('normalizes an NR rating to null', () => {
    expect(validate({ default_rating: 'NR' })).toEqual({ ok: true, value: { default_rating: null } });
  });

  test('rejects an unknown rating', () => {
    expect(validate({ default_rating: 'XYZ' }).ok).toBe(false);
  });

  test('rejects an unknown sort order', () => {
    expect(validate({ sort_order: 'shuffle' })).toEqual({
      ok: false,
      error: 'Invalid sort_order; expected default or reversed',
    });
  });
});
