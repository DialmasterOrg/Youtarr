import { toDownloadOverrideSettings } from '../downloadOverrideSettings';

describe('toDownloadOverrideSettings', () => {
  test('sends no override when the dialog returned no settings', () => {
    expect(toDownloadOverrideSettings(null)).toBeUndefined();
  });

  test('carries over every download option', () => {
    const settings = {
      resolution: '720',
      allowRedownload: true,
      subfolder: 'Kids',
      audioFormat: 'mp3_only',
      rating: 'PG',
      skipVideoFolder: true,
      protect: true,
    };

    expect(toDownloadOverrideSettings(settings)).toEqual(settings);
  });

  test('leaves out the video count, which is not a per-download override', () => {
    expect(toDownloadOverrideSettings({ resolution: '1080', videoCount: 5 })).not.toHaveProperty('videoCount');
  });
});
