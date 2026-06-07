jest.mock('../../configModule', () => ({
  config: { preferredResolution: '1080' },
}));

const resolver = require('../downloadSettingsResolver');
const { ROOT_SENTINEL } = require('../../filesystem/constants');

describe('resolveCommandSettings', () => {
  const playlist = { video_quality: '720', audio_format: 'mp3_only' };

  test('override beats channel, playlist, and global', () => {
    const channel = { video_quality: '480', audio_format: null, skip_video_folder: true };
    const out = resolver.resolveCommandSettings({
      override: { resolution: '2160', audioFormat: 'video_mp3', skipVideoFolder: false },
      channel, playlist, config: { preferredResolution: '1080' },
    });
    expect(out).toEqual({ resolution: '2160', audioFormat: 'video_mp3', skipVideoFolder: false });
  });

  test('channel beats playlist and global', () => {
    const channel = { video_quality: '480', audio_format: 'mp3_only', skip_video_folder: true };
    const out = resolver.resolveCommandSettings({ override: {}, channel, playlist, config: { preferredResolution: '1080' } });
    expect(out).toEqual({ resolution: '480', audioFormat: 'mp3_only', skipVideoFolder: true });
  });

  test('playlist beats global when channel is null', () => {
    const out = resolver.resolveCommandSettings({ override: {}, channel: null, playlist, config: { preferredResolution: '1080' } });
    expect(out).toEqual({ resolution: '720', audioFormat: 'mp3_only', skipVideoFolder: false });
  });

  test('uses config-provided resolution when nothing else set', () => {
    const out = resolver.resolveCommandSettings({ override: {}, channel: null, playlist: {}, config: { preferredResolution: '480' } });
    expect(out).toEqual({ resolution: '480', audioFormat: null, skipVideoFolder: false });
  });

  test('falls back to DEFAULT_RESOLUTION when config has no resolution', () => {
    const out = resolver.resolveCommandSettings({ override: {}, channel: null, playlist: {}, config: {} });
    expect(out).toEqual({ resolution: '1080', audioFormat: null, skipVideoFolder: false });
  });
});

describe('buildRoutingDirectives', () => {
  test('emits hard override only from the dialog override', () => {
    const out = resolver.buildRoutingDirectives({ override: { subfolder: 'Dialog', rating: 'R' }, playlist: {} });
    expect(out).toEqual({ subfolderOverride: 'Dialog', ratingOverride: 'R' });
  });

  test('emits soft fallback only from playlist defaults', () => {
    const out = resolver.buildRoutingDirectives({ override: {}, playlist: { default_sub_folder: 'PL', default_rating: 'PG' } });
    expect(out).toEqual({ subfolderFallback: 'PL', ratingFallback: 'PG' });
  });

  test('emits nothing when neither override nor playlist set routing', () => {
    const out = resolver.buildRoutingDirectives({ override: {}, playlist: {} });
    expect(out).toEqual({});
  });

  test('hard and soft can coexist', () => {
    const out = resolver.buildRoutingDirectives({
      override: { subfolder: 'Dialog' },
      playlist: { default_sub_folder: 'PL', default_rating: 'PG' },
    });
    expect(out).toEqual({ subfolderOverride: 'Dialog', subfolderFallback: 'PL', ratingFallback: 'PG' });
  });
});

describe('resolveFinalSubfolder', () => {
  test('hard override wins (ROOT_SENTINEL -> root)', () => {
    expect(resolver.resolveFinalSubfolder({ hardOverride: ROOT_SENTINEL, channelRecord: { sub_folder: 'Kids' }, softFallback: 'PL', globalDefault: 'GD' })).toBeNull();
  });

  test('hard override wins (named)', () => {
    expect(resolver.resolveFinalSubfolder({ hardOverride: 'Dialog', channelRecord: { sub_folder: 'Kids' }, softFallback: 'PL', globalDefault: 'GD' })).toBe('Dialog');
  });

  test('tracked channel wins over soft fallback', () => {
    expect(resolver.resolveFinalSubfolder({ hardOverride: null, channelRecord: { sub_folder: 'Kids' }, softFallback: 'PL', globalDefault: 'GD' })).toBe('Kids');
  });

  test('tracked channel with NULL sub_folder means root and still wins over soft fallback', () => {
    expect(resolver.resolveFinalSubfolder({ hardOverride: null, channelRecord: { sub_folder: null }, softFallback: 'PL', globalDefault: 'GD' })).toBeNull();
  });

  test('untracked channel uses soft fallback', () => {
    expect(resolver.resolveFinalSubfolder({ hardOverride: null, channelRecord: null, softFallback: 'PL', globalDefault: 'GD' })).toBe('PL');
  });

  test('untracked channel with no soft fallback uses global default', () => {
    expect(resolver.resolveFinalSubfolder({ hardOverride: null, channelRecord: null, softFallback: null, globalDefault: 'GD' })).toBe('GD');
  });
});
