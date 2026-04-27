import { getEnabledChannelId } from '../enabledChannels';
import { EnabledChannel } from '../../types/VideoData';

describe('getEnabledChannelId', () => {
  const enabledChannels: EnabledChannel[] = [
    { channel_id: 'UC_A', uploader: 'Alice' },
    { channel_id: 'UC_B', uploader: 'Bob' },
  ];

  test('returns the channel id when videoChannelId matches an enabled channel', () => {
    expect(getEnabledChannelId('Alice', 'UC_A', enabledChannels)).toBe('UC_A');
  });

  test('prefers videoChannelId match over uploader-name match', () => {
    const channels: EnabledChannel[] = [
      { channel_id: 'UC_A', uploader: 'Alice' },
      { channel_id: 'UC_B', uploader: 'Alice' },
    ];
    expect(getEnabledChannelId('Alice', 'UC_B', channels)).toBe('UC_B');
  });

  test('falls back to uploader-name match when videoChannelId is null', () => {
    expect(getEnabledChannelId('Bob', null, enabledChannels)).toBe('UC_B');
  });

  test('falls back to uploader-name match when videoChannelId is undefined', () => {
    expect(getEnabledChannelId('Bob', undefined, enabledChannels)).toBe('UC_B');
  });

  test('falls back to uploader-name match when videoChannelId does not match any enabled channel', () => {
    expect(getEnabledChannelId('Alice', 'UC_UNKNOWN', enabledChannels)).toBe('UC_A');
  });

  test('returns null when neither videoChannelId nor channelName match', () => {
    expect(getEnabledChannelId('Nobody', 'UC_UNKNOWN', enabledChannels)).toBeNull();
  });

  test('returns null for an empty enabled-channels list', () => {
    expect(getEnabledChannelId('Alice', 'UC_A', [])).toBeNull();
  });

  test('returns null when videoChannelId is empty string and channelName is unknown', () => {
    expect(getEnabledChannelId('Nobody', '', enabledChannels)).toBeNull();
  });
});
