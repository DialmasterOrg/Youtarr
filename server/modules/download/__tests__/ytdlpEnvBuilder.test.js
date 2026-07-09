'use strict';

jest.mock('../../../logger', () => ({ warn: jest.fn() }));

const { buildYtdlpEnv, OWNER_CHANNEL_MAP_MAX_BYTES } = require('../ytdlpEnvBuilder');
const logger = require('../../../logger');

const BASE_ARGS = { jobId: 'job-1', tempBasePath: '/tmp/ytdlp' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('baseline env construction', () => {
  test('sets YOUTARR_JOB_ID and TMPDIR from args', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env.YOUTARR_JOB_ID).toBe('job-1');
    expect(env.TMPDIR).toBe('/tmp/ytdlp');
  });

  test('preserves keys from a custom baseEnv', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: { MY_KEY: 'my-value' } });
    expect(env.MY_KEY).toBe('my-value');
  });

  test('does not set YOUTARR_SUBFOLDER_OVERRIDE when no directives given', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env).not.toHaveProperty('YOUTARR_SUBFOLDER_OVERRIDE');
  });

  test('does not set YOUTARR_SUBFOLDER_FALLBACK when no directives given', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env).not.toHaveProperty('YOUTARR_SUBFOLDER_FALLBACK');
  });

  test('does not set YOUTARR_OVERRIDE_RATING when no directives given', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env).not.toHaveProperty('YOUTARR_OVERRIDE_RATING');
  });

  test('does not set YOUTARR_RATING_FALLBACK when no directives given', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env).not.toHaveProperty('YOUTARR_RATING_FALLBACK');
  });

  test('does not set YOUTARR_OWNER_CHANNEL_ID when no directives given', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_ID');
  });

  test('does not set YOUTARR_OWNER_CHANNEL_MAP when no directives given', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {} });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_MAP');
  });
});

describe('subfolderOverride', () => {
  test('sets YOUTARR_SUBFOLDER_OVERRIDE when provided', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { subfolderOverride: 'MyChannel' } });
    expect(env.YOUTARR_SUBFOLDER_OVERRIDE).toBe('MyChannel');
  });

  test('omits YOUTARR_SUBFOLDER_OVERRIDE when null', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { subfolderOverride: null } });
    expect(env).not.toHaveProperty('YOUTARR_SUBFOLDER_OVERRIDE');
  });

  test('omits YOUTARR_SUBFOLDER_OVERRIDE when undefined', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { subfolderOverride: undefined } });
    expect(env).not.toHaveProperty('YOUTARR_SUBFOLDER_OVERRIDE');
  });
});

describe('subfolderFallback', () => {
  test('sets YOUTARR_SUBFOLDER_FALLBACK when provided', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { subfolderFallback: 'Fallback' } });
    expect(env.YOUTARR_SUBFOLDER_FALLBACK).toBe('Fallback');
  });

  test('omits YOUTARR_SUBFOLDER_FALLBACK when null', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { subfolderFallback: null } });
    expect(env).not.toHaveProperty('YOUTARR_SUBFOLDER_FALLBACK');
  });

  test('omits YOUTARR_SUBFOLDER_FALLBACK when undefined', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { subfolderFallback: undefined } });
    expect(env).not.toHaveProperty('YOUTARR_SUBFOLDER_FALLBACK');
  });
});

describe('skipVideoFolder', () => {
  test('sets YOUTARR_SKIP_VIDEO_FOLDER to "true" when true', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { skipVideoFolder: true } });
    expect(env.YOUTARR_SKIP_VIDEO_FOLDER).toBe('true');
  });

  test('omits YOUTARR_SKIP_VIDEO_FOLDER when false', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { skipVideoFolder: false } });
    expect(env).not.toHaveProperty('YOUTARR_SKIP_VIDEO_FOLDER');
  });
});

describe('ratingOverride', () => {
  test('sets YOUTARR_OVERRIDE_RATING to "NR" when null (clear-rating sentinel)', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingOverride: null } });
    expect(env.YOUTARR_OVERRIDE_RATING).toBe('NR');
  });

  test('sets YOUTARR_OVERRIDE_RATING to string value when string provided', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingOverride: 'PG-13' } });
    expect(env.YOUTARR_OVERRIDE_RATING).toBe('PG-13');
  });

  test('sets YOUTARR_OVERRIDE_RATING to "0" when number 0 provided', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingOverride: 0 } });
    expect(env.YOUTARR_OVERRIDE_RATING).toBe('0');
  });

  test('omits YOUTARR_OVERRIDE_RATING when undefined', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingOverride: undefined } });
    expect(env).not.toHaveProperty('YOUTARR_OVERRIDE_RATING');
  });
});

describe('ratingFallback', () => {
  test('sets YOUTARR_RATING_FALLBACK to string when string provided', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingFallback: 'PG' } });
    expect(env.YOUTARR_RATING_FALLBACK).toBe('PG');
  });

  test('sets YOUTARR_RATING_FALLBACK to stringified number when number provided', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingFallback: 7 } });
    expect(env.YOUTARR_RATING_FALLBACK).toBe('7');
  });

  test('omits YOUTARR_RATING_FALLBACK when null', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingFallback: null } });
    expect(env).not.toHaveProperty('YOUTARR_RATING_FALLBACK');
  });

  test('omits YOUTARR_RATING_FALLBACK when undefined', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ratingFallback: undefined } });
    expect(env).not.toHaveProperty('YOUTARR_RATING_FALLBACK');
  });
});

describe('ownerChannelId', () => {
  test('sets YOUTARR_OWNER_CHANNEL_ID and trims whitespace', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelId: '  UCabc123  ' } });
    expect(env.YOUTARR_OWNER_CHANNEL_ID).toBe('UCabc123');
  });

  test('omits YOUTARR_OWNER_CHANNEL_ID when empty string', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelId: '' } });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_ID');
  });

  test('omits YOUTARR_OWNER_CHANNEL_ID when whitespace-only string', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelId: '   ' } });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_ID');
  });

  test('omits YOUTARR_OWNER_CHANNEL_ID when null', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelId: null } });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_ID');
  });
});

describe('ownerChannelMap', () => {
  test('serializes valid map to JSON', () => {
    const map = { vid1: 'UCabc', vid2: 'UCdef' };
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelMap: map } });
    expect(env.YOUTARR_OWNER_CHANNEL_MAP).toBe(JSON.stringify(map));
  });

  test('omits YOUTARR_OWNER_CHANNEL_MAP for empty object', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelMap: {} } });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_MAP');
  });

  test('omits YOUTARR_OWNER_CHANNEL_MAP and calls logger.warn when JSON exceeds size cap', () => {
    // Build a map whose JSON serialization exceeds OWNER_CHANNEL_MAP_MAX_BYTES
    const bigMap = {};
    const entryValue = 'x'.repeat(100);
    let approxSize = 0;
    let i = 0;
    while (approxSize <= OWNER_CHANNEL_MAP_MAX_BYTES) {
      const key = `key_${String(i).padStart(6, '0')}`;
      bigMap[key] = entryValue;
      approxSize += key.length + entryValue.length + 6; // rough JSON overhead
      i++;
    }

    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelMap: bigMap } });
    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_MAP');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ bytes: expect.any(Number) }),
      'owner channel map exceeds env size cap; per-video owner resolution skipped'
    );
  });

  test('omits YOUTARR_OWNER_CHANNEL_MAP and calls logger.warn on circular reference, does not throw', () => {
    const circular = { a: 'val' };
    circular.self = circular;

    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: { ownerChannelMap: circular } });

    expect(env).not.toHaveProperty('YOUTARR_OWNER_CHANNEL_MAP');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything() }),
      'could not serialize owner channel map'
    );
  });
});

describe('postProcessDirectives edge cases', () => {
  test('tolerates undefined postProcessDirectives and still builds baseline env', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: undefined });
    expect(env.YOUTARR_JOB_ID).toBe('job-1');
    expect(env.TMPDIR).toBe('/tmp/ytdlp');
  });

  test('tolerates null postProcessDirectives and still builds baseline env', () => {
    const env = buildYtdlpEnv({ ...BASE_ARGS, baseEnv: {}, postProcessDirectives: null });
    expect(env.YOUTARR_JOB_ID).toBe('job-1');
    expect(env.TMPDIR).toBe('/tmp/ytdlp');
  });
});

describe('default baseEnv', () => {
  test('uses process.env by default and passes through PATH', () => {
    const originalPath = process.env.PATH;
    // PATH should always be set in the test environment
    expect(originalPath).toBeDefined();
    const env = buildYtdlpEnv({ ...BASE_ARGS });
    expect(env.PATH).toBe(originalPath);
  });

  test('uses process.env by default: spot-check a set marker key', () => {
    process.env.YTDLP_ENV_BUILDER_TEST_MARKER = 'hello';
    try {
      const env = buildYtdlpEnv({ ...BASE_ARGS });
      expect(env.YTDLP_ENV_BUILDER_TEST_MARKER).toBe('hello');
    } finally {
      delete process.env.YTDLP_ENV_BUILDER_TEST_MARKER;
    }
  });
});
