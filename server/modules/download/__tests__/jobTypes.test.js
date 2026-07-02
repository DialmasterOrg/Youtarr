/* eslint-env jest */
const {
  MANUAL_DOWNLOAD_LABEL,
  CHANNEL_DOWNLOAD_LABEL,
  PLAYLIST_DOWNLOAD_LABEL_PREFIX,
  CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX,
  isSpecificUrlDownloadJob,
  isDownloadJob,
  playlistJobLabel,
  channelDownloadAllJobLabel,
  isChannelDownloadAllJob,
} = require('../jobTypes');

describe('jobTypes', () => {
  describe('isSpecificUrlDownloadJob', () => {
    it('matches manually-added URL jobs', () => {
      expect(isSpecificUrlDownloadJob(MANUAL_DOWNLOAD_LABEL)).toBe(true);
    });

    it('matches the API-key manual variant', () => {
      expect(isSpecificUrlDownloadJob(`${MANUAL_DOWNLOAD_LABEL} (via API: tasker)`)).toBe(true);
    });

    it('matches playlist jobs by prefix', () => {
      expect(isSpecificUrlDownloadJob('Playlist: My Favorites')).toBe(true);
    });

    it('does not match channel downloads', () => {
      expect(isSpecificUrlDownloadJob('Channel Downloads - 2 group(s)')).toBe(false);
    });

    it('does not match non-download jobs or empty input', () => {
      expect(isSpecificUrlDownloadJob('Import Subscriptions')).toBe(false);
      expect(isSpecificUrlDownloadJob('')).toBe(false);
      expect(isSpecificUrlDownloadJob(undefined)).toBe(false);
    });
  });

  describe('isDownloadJob', () => {
    it('is true for channel, manual, and playlist jobs', () => {
      expect(isDownloadJob(CHANNEL_DOWNLOAD_LABEL)).toBe(true);
      expect(isDownloadJob(MANUAL_DOWNLOAD_LABEL)).toBe(true);
      expect(isDownloadJob('Playlist: Anything')).toBe(true);
    });

    it('is false for non-download jobs and empty input', () => {
      expect(isDownloadJob('Import Subscriptions')).toBe(false);
      expect(isDownloadJob('')).toBe(false);
      expect(isDownloadJob(undefined)).toBe(false);
    });
  });

  describe('channel download-all jobs', () => {
    it('labels jobs with the channel title', () => {
      const label = channelDownloadAllJobLabel({ title: 'My Channel', channel_id: 'UC123' });
      expect(label).toBe(`${CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX}My Channel`);
    });

    it('falls back to the channel id when the title is missing', () => {
      expect(channelDownloadAllJobLabel({ channel_id: 'UC123' })).toBe(
        `${CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX}UC123`
      );
    });

    it('detects download-all jobs by prefix', () => {
      expect(isChannelDownloadAllJob(`${CHANNEL_DOWNLOAD_ALL_LABEL_PREFIX}My Channel`)).toBe(true);
      expect(isChannelDownloadAllJob(MANUAL_DOWNLOAD_LABEL)).toBe(false);
      expect(isChannelDownloadAllJob('Playlist: Foo')).toBe(false);
      expect(isChannelDownloadAllJob(undefined)).toBe(false);
    });

    it('treats download-all jobs as specific URL-list download jobs', () => {
      const label = channelDownloadAllJobLabel({ title: 'My Channel', channel_id: 'UC123' });
      expect(isSpecificUrlDownloadJob(label)).toBe(true);
      expect(isDownloadJob(label)).toBe(true);
    });

    it('is not mistaken for a channel-downloads family label', () => {
      // /triggerchanneldownloads guards on jobType.includes(CHANNEL_DOWNLOAD_LABEL);
      // a running download-all job must not block scheduled channel downloads.
      const label = channelDownloadAllJobLabel({ title: 'My Channel', channel_id: 'UC123' });
      expect(label.includes(CHANNEL_DOWNLOAD_LABEL)).toBe(false);
    });
  });

  describe('playlistJobLabel', () => {
    it('uses the playlist title when present', () => {
      const label = playlistJobLabel({ title: 'Road Trip', playlist_id: 'PL1' });
      expect(label).toBe(`${PLAYLIST_DOWNLOAD_LABEL_PREFIX}Road Trip`);
      expect(isSpecificUrlDownloadJob(label)).toBe(true);
    });

    it('falls back to the playlist id when the title is missing', () => {
      expect(playlistJobLabel({ playlist_id: 'PL1' })).toBe(`${PLAYLIST_DOWNLOAD_LABEL_PREFIX}PL1`);
    });
  });
});
