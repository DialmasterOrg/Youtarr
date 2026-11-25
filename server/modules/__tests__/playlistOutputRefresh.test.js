/* eslint-env jest */

describe('playlistOutputRefresh', () => {
  let playlistOutputRefresh;
  let Playlist, PlaylistVideo, Video;
  let m3uGenerator;
  let mediaServerSync;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../../models', () => ({
      Playlist: {
        findAll: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue({ id: 7 }),
      },
      PlaylistVideo: { findAll: jest.fn().mockResolvedValue([]) },
      Video: { findAll: jest.fn().mockResolvedValue([]) },
    }));
    jest.doMock('../m3uGenerator', () => ({ generatePlaylistM3U: jest.fn().mockResolvedValue(true) }));
    jest.doMock('../mediaServers/mediaServerSync', () => ({ syncPlaylist: jest.fn().mockResolvedValue(undefined) }));

    ({ Playlist, PlaylistVideo, Video } = require('../../models'));
    m3uGenerator = require('../m3uGenerator');
    mediaServerSync = require('../mediaServers/mediaServerSync');
    logger = require('../../logger');
    playlistOutputRefresh = require('../playlistOutputRefresh');
  });

  describe('refreshForVideos', () => {
    test('regenerates the M3U and re-syncs each enabled playlist listing the videos', async () => {
      PlaylistVideo.findAll.mockResolvedValue([{ playlist_id: 'PL1' }, { playlist_id: 'PL2' }, { playlist_id: 'PL1' }]);
      Playlist.findAll.mockResolvedValue([{ id: 1, playlist_id: 'PL1' }, { id: 2, playlist_id: 'PL2' }]);

      await playlistOutputRefresh.refreshForVideos(['v1', 'v2']);

      expect(m3uGenerator.generatePlaylistM3U.mock.calls).toEqual([[1], [2]]);
      expect(mediaServerSync.syncPlaylist.mock.calls).toEqual([[1], [2]]);
    });

    test('looks up only playlists that still include the videos', async () => {
      await playlistOutputRefresh.refreshForVideos(['v1']);

      expect(PlaylistVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { youtube_id: ['v1'], ignored: false },
      }));
    });

    test('skips removed playlists', async () => {
      PlaylistVideo.findAll.mockResolvedValue([{ playlist_id: 'PL1' }, { playlist_id: 'PL2' }]);

      await playlistOutputRefresh.refreshForVideos(['v1']);

      expect(Playlist.findAll).toHaveBeenCalledWith({ where: { playlist_id: ['PL1', 'PL2'], enabled: true } });
    });

    test('does nothing for an empty list', async () => {
      await playlistOutputRefresh.refreshForVideos([]);

      expect(PlaylistVideo.findAll).not.toHaveBeenCalled();
    });

    test('does nothing when no playlist lists the videos', async () => {
      await playlistOutputRefresh.refreshForVideos(['v1']);

      expect(Playlist.findAll).not.toHaveBeenCalled();
    });

    test('keeps refreshing the other playlists when one sync fails', async () => {
      PlaylistVideo.findAll.mockResolvedValue([{ playlist_id: 'PL1' }, { playlist_id: 'PL2' }]);
      Playlist.findAll.mockResolvedValue([{ id: 1, playlist_id: 'PL1' }, { id: 2, playlist_id: 'PL2' }]);
      mediaServerSync.syncPlaylist.mockRejectedValueOnce(new Error('boom'));

      await playlistOutputRefresh.refreshForVideos(['v1']);

      expect(mediaServerSync.syncPlaylist).toHaveBeenCalledWith(2);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ playlist_id: 'PL1' }),
        expect.any(String)
      );
    });
  });

  describe('scheduleIfListed', () => {
    const DELAY_MS = 30 * 1000;

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('rebuilds the M3U and re-syncs once the delay passes for a video with a file', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);

      const scheduled = await playlistOutputRefresh.scheduleIfListed(7, ['v1']);
      expect(scheduled).toBe(true);
      expect(mediaServerSync.syncPlaylist).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(DELAY_MS);

      expect(m3uGenerator.generatePlaylistM3U.mock.calls).toEqual([[7]]);
      expect(mediaServerSync.syncPlaylist.mock.calls).toEqual([[7]]);
    });

    test('schedules nothing for videos that were never downloaded', async () => {
      const scheduled = await playlistOutputRefresh.scheduleIfListed(7, ['v1']);
      await jest.advanceTimersByTimeAsync(DELAY_MS);

      expect(scheduled).toBe(false);
      expect(Video.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { youtubeId: ['v1'] } }));
      expect(mediaServerSync.syncPlaylist).not.toHaveBeenCalled();
    });

    test('schedules nothing for a video whose file was deleted', async () => {
      Video.findAll.mockResolvedValue([{ removed: true, removed_reason: 'user_deleted' }]);

      const scheduled = await playlistOutputRefresh.scheduleIfListed(7, ['v1']);

      expect(scheduled).toBe(false);
    });

    test('schedules for a video whose file is missing, since it stays listed', async () => {
      Video.findAll.mockResolvedValue([{ removed: true, removed_reason: 'not_found' }]);

      const scheduled = await playlistOutputRefresh.scheduleIfListed(7, ['v1']);

      expect(scheduled).toBe(true);
    });

    test('restarts the delay on each change so a run of changes syncs once', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);

      await playlistOutputRefresh.scheduleIfListed(7, ['v1']);
      await jest.advanceTimersByTimeAsync(DELAY_MS - 1000);
      await playlistOutputRefresh.scheduleIfListed(7, ['v2']);
      await jest.advanceTimersByTimeAsync(DELAY_MS - 1000);
      expect(mediaServerSync.syncPlaylist).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1000);

      expect(mediaServerSync.syncPlaylist.mock.calls).toEqual([[7]]);
    });

    test('keeps a separate delay per playlist', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);

      await playlistOutputRefresh.scheduleIfListed(7, ['v1']);
      await playlistOutputRefresh.scheduleIfListed(8, ['v1']);
      await jest.advanceTimersByTimeAsync(DELAY_MS);

      expect(mediaServerSync.syncPlaylist.mock.calls).toEqual([[7], [8]]);
    });

    test('logs a failed lookup and schedules nothing instead of rejecting', async () => {
      Video.findAll.mockRejectedValue(new Error('db down'));

      const scheduled = await playlistOutputRefresh.scheduleIfListed(7, ['v1']);

      expect(scheduled).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ playlist_db_id: 7 }),
        expect.any(String)
      );
    });

    test('leaves the outputs alone when the playlist was removed while the refresh waited', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);
      await playlistOutputRefresh.scheduleIfListed(7, ['v1']);
      Playlist.findOne.mockResolvedValue(null);

      await jest.advanceTimersByTimeAsync(DELAY_MS);

      expect(Playlist.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7, enabled: true } }));
      expect(m3uGenerator.generatePlaylistM3U).not.toHaveBeenCalled();
      expect(mediaServerSync.syncPlaylist).not.toHaveBeenCalled();
    });

    test('still syncs when the M3U rebuild fails', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);
      m3uGenerator.generatePlaylistM3U.mockRejectedValue(new Error('disk full'));

      await playlistOutputRefresh.scheduleIfListed(7, ['v1']);
      await jest.advanceTimersByTimeAsync(DELAY_MS);

      expect(mediaServerSync.syncPlaylist).toHaveBeenCalledWith(7);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('runPending', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('runs a waiting refresh at once and cancels its delay', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);
      await playlistOutputRefresh.scheduleIfListed(7, ['v1']);

      expect(playlistOutputRefresh.runPending(7)).toBe(true);
      await jest.advanceTimersByTimeAsync(0);
      expect(mediaServerSync.syncPlaylist.mock.calls).toEqual([[7]]);

      await jest.advanceTimersByTimeAsync(60 * 1000);
      expect(mediaServerSync.syncPlaylist).toHaveBeenCalledTimes(1);
    });

    test('does nothing when no refresh is waiting', async () => {
      expect(playlistOutputRefresh.runPending(7)).toBe(false);
      await jest.advanceTimersByTimeAsync(0);

      expect(m3uGenerator.generatePlaylistM3U).not.toHaveBeenCalled();
      expect(mediaServerSync.syncPlaylist).not.toHaveBeenCalled();
    });

    test('logs a failed sync instead of rejecting', async () => {
      Video.findAll.mockResolvedValue([{ removed: false, removed_reason: null }]);
      mediaServerSync.syncPlaylist.mockRejectedValue(new Error('plex down'));
      await playlistOutputRefresh.scheduleIfListed(7, ['v1']);

      playlistOutputRefresh.runPending(7);
      await jest.advanceTimersByTimeAsync(0);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ playlist_db_id: 7 }),
        expect.any(String)
      );
    });
  });

  describe('refreshForVideosInBackground', () => {
    test('logs a failed lookup instead of rejecting', async () => {
      PlaylistVideo.findAll.mockRejectedValue(new Error('db down'));

      playlistOutputRefresh.refreshForVideosInBackground(['v1'], 'video-deletion');
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'video-deletion' }),
        expect.any(String)
      );
    });
  });
});
