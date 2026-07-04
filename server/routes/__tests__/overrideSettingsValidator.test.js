/* eslint-env jest */
const { createOverrideSettingsValidator } = require('../overrideSettingsValidator');

const channelSettingsModule = {
  validateSubFolder: jest.fn(),
};
// Real ratingMapper: pure module with no DB/IO deps, so tests exercise the
// actual rating validation/normalization (same approach as playlists.test.js).
const ratingMapper = require('../../modules/ratingMapper');

const validate = createOverrideSettingsValidator({ channelSettingsModule, ratingMapper });

beforeEach(() => {
  jest.clearAllMocks();
  channelSettingsModule.validateSubFolder.mockReturnValue({ valid: true });
});

describe('createOverrideSettingsValidator', () => {
  test('absent input is valid with an undefined value', () => {
    expect(validate(undefined)).toEqual({ ok: true, value: undefined });
  });

  test('non-object input is rejected', () => {
    expect(validate(null).ok).toBe(false);
    expect(validate('720').ok).toBe(false);
    expect(validate(['720']).ok).toBe(false);
  });

  test('unknown keys are dropped from the validated value', () => {
    const result = validate({ resolution: '720', bogus: true });
    expect(result).toEqual({ ok: true, value: { resolution: '720' } });
  });

  test('accepts a full valid settings object', () => {
    const result = validate({
      resolution: 1080,
      allowRedownload: true,
      skipVideoFolder: false,
      subfolder: 'Kids',
      audioFormat: 'mp3_only',
      rating: ' nr ',
    });
    expect(result).toEqual({
      ok: true,
      value: {
        resolution: '1080',
        allowRedownload: true,
        skipVideoFolder: false,
        subfolder: 'Kids',
        audioFormat: 'mp3_only',
        rating: null,
      },
    });
    expect(channelSettingsModule.validateSubFolder).toHaveBeenCalledWith('Kids');
  });

  test('rejects an unsupported resolution', () => {
    expect(validate({ resolution: '999' }).ok).toBe(false);
  });

  test('rejects non-boolean allowRedownload and skipVideoFolder', () => {
    expect(validate({ allowRedownload: 'yes' }).ok).toBe(false);
    expect(validate({ skipVideoFolder: 1 }).ok).toBe(false);
  });

  test('allows a null subfolder but rejects one that fails subfolder validation', () => {
    expect(validate({ subfolder: null })).toEqual({ ok: true, value: { subfolder: null } });

    channelSettingsModule.validateSubFolder.mockReturnValue({ valid: false, error: 'bad' });
    expect(validate({ subfolder: '../etc' }).ok).toBe(false);
  });

  test('rejects an unsupported audio format but allows null', () => {
    expect(validate({ audioFormat: 'wav' }).ok).toBe(false);
    expect(validate({ audioFormat: null })).toEqual({ ok: true, value: { audioFormat: null } });
  });

  test('rejects an invalid rating', () => {
    expect(validate({ rating: 'not-a-rating' }).ok).toBe(false);
  });
});
