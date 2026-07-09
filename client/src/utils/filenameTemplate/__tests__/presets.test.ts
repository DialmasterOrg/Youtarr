import { FILENAME_PRESETS, DEFAULT_PRESET_PREFIX } from '../presets';

describe('FILENAME_PRESETS', () => {
  it('exports five presets in a stable order', () => {
    expect(FILENAME_PRESETS).toHaveLength(5);
    expect(FILENAME_PRESETS.map((p) => p.label)).toEqual([
      'Default',
      'Date prefix',
      'Plex YouTube-Agent',
      'Plex TV Series',
      'Title only',
    ]);
  });

  it('first preset matches DEFAULT_PRESET_PREFIX', () => {
    expect(FILENAME_PRESETS[0].prefix).toBe(DEFAULT_PRESET_PREFIX);
  });

  it('default prefix caps the title at 64 bytes', () => {
    expect(DEFAULT_PRESET_PREFIX).toBe('%(uploader,channel,uploader_id).80B - %(title).64B');
  });
});
