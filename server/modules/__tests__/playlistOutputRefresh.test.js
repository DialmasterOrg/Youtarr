/* eslint-env jest */

describe('playlistOutputRefresh', () => {
  let playlistOutputRefresh;
  let Playlist, PlaylistVideo;
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
      Playlist: { findAll: jest.fn().mockResolvedValue([]) },
      PlaylistVideo: { findAll: jest.fn().mockResolvedValue([]) },
    }));
    jest.doMock('../m3uGenerator', () => ({ generatePlaylistM3U: jest.fn().mockResolvedValue(true) }));
    jest.doMock('../mediaServers/mediaServerSync', () => ({ syncPlaylist: jest.fn().mockResolvedValue(undefined) }));

    ({ Playlist, PlaylistVideo } = require('../../models'));
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
