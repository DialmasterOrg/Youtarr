import { getNewChannelSettings, hasDetectedTabs, toNewChannelSettingsPayload } from '../newChannelSettings';

describe('newChannelSettings', () => {
  const channel = {
    url: 'https://www.youtube.com/@example',
    uploader: 'Example',
    available_tabs: 'videos,shorts',
    auto_download_enabled_tabs: 'video',
    video_quality: '720',
    audio_format: 'mp3_only',
    sub_folder: 'Kids',
  };

  test('getNewChannelSettings reads the dialog settings from a channel', () => {
    expect(getNewChannelSettings(channel)).toEqual({
      auto_download_enabled_tabs: 'video',
      video_quality: '720',
      audio_format: 'mp3_only',
      sub_folder: 'Kids',
    });
  });

  test('getNewChannelSettings falls back to global and off values for missing fields', () => {
    expect(getNewChannelSettings({ url: channel.url, uploader: 'Example' })).toEqual({
      auto_download_enabled_tabs: '',
      video_quality: null,
      audio_format: null,
      sub_folder: null,
    });
  });

  test('hasDetectedTabs is false when tab detection found nothing', () => {
    expect(hasDetectedTabs({ ...channel, available_tabs: null })).toBe(false);
  });

  test('payload includes auto-download tabs when tabs were detected', () => {
    expect(toNewChannelSettingsPayload(channel)).toHaveProperty('auto_download_enabled_tabs', 'video');
  });

  test('payload leaves auto-download tabs to the server when no tabs were detected', () => {
    expect(toNewChannelSettingsPayload({ ...channel, available_tabs: '' })).not.toHaveProperty(
      'auto_download_enabled_tabs'
    );
  });
});
