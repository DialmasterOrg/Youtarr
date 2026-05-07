import { FILENAME_PRESETS, DEFAULT_PRESET_PREFIX } from '../presets';

describe('FILENAME_PRESETS', () => {
  it('exports four presets in a stable order', () => {
    expect(FILENAME_PRESETS).toHaveLength(4);
    expect(FILENAME_PRESETS.map((p) => p.label)).toEqual([
      'Default',
      'Date prefix',
      'Plex YouTube-Agent',
      'Title only',
    ]);
  });

  it('first preset matches DEFAULT_PRESET_PREFIX', () => {
    expect(FILENAME_PRESETS[0].prefix).toBe(DEFAULT_PRESET_PREFIX);
  });

  it('default prefix is the legacy template prefix', () => {
    expect(DEFAULT_PRESET_PREFIX).toBe('%(uploader,channel,uploader_id).80B - %(title).76B');
  });
});
