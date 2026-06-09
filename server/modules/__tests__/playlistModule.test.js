jest.mock('child_process');
jest.mock('../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../models', () => ({
  Playlist: { findOne: jest.fn(), create: jest.fn(), update: jest.fn(), findAll: jest.fn() },
  PlaylistVideo: { findAll: jest.fn(), bulkCreate: jest.fn(), update: jest.fn(), destroy: jest.fn() },
}));
jest.mock('../channelModule', () => ({
  upsertChannel: jest.fn(),
}));
jest.mock('../downloadModule', () => ({
  doPlaylistDownloads: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../youtubeApi', () => ({
  isAvailable: jest.fn(() => false),
  getApiKey: jest.fn(() => null),
  client: { getVideoMetadata: jest.fn() },
}));

const { EventEmitter } = require('events');

describe('playlistModule', () => {
  let playlistModule;
  let Playlist;
  let PlaylistVideo;
  let channelModule;
  let downloadModule;
  let childProcess;
  let youtubeApi;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Set up spawn on the mock BEFORE requiring playlistModule so the
    // destructured `const { spawn } = require('child_process')` in the module
    // captures our jest.fn().
    childProcess = require('child_process');
    childProcess.spawn = jest.fn();
    // Now require the module — its top-level destructure picks up the mock.
    playlistModule = require('../playlistModule');
    ({ Playlist, PlaylistVideo } = require('../../models'));
    channelModule = require('../channelModule');
    downloadModule = require('../downloadModule');
    youtubeApi = require('../youtubeApi');
  });

  describe('getPlaylistInfo', () => {
    test('returns parsed metadata for a valid playlist URL', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);

      const promise = playlistModule.getPlaylistInfo(
        'https://www.youtube.com/playlist?list=PLabc123'
      );

      const metadata = {
        id: 'PLabc123',
        title: 'Test Playlist',
        uploader: 'Test User',
        description: 'desc',
        thumbnail: 'https://img',
        playlist_count: 12,
        webpage_url: 'https://www.youtube.com/playlist?list=PLabc123',
      };
      mockChild.stdout.emit('data', JSON.stringify(metadata));
      mockChild.emit('close', 0);

      const result = await promise;
      expect(result).toEqual({
        playlist_id: 'PLabc123',
        title: 'Test Playlist',
        uploader: 'Test User',
        description: 'desc',
        thumbnail: 'https://img',
        video_count: 12,
        url: 'https://www.youtube.com/playlist?list=PLabc123',
      });
    });

    test('throws PLAYLIST_NOT_FOUND on unavailable playlist', async () => {
      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);

      const promise = playlistModule.getPlaylistInfo('https://www.youtube.com/playlist?list=nope');
      mockChild.stderr.emit('data', 'ERROR: The playlist does not exist');
      mockChild.emit('close', 1);

      await expect(promise).rejects.toThrow('PLAYLIST_NOT_FOUND');
    });
  });

  describe('upsertPlaylist', () => {
    test('creates a new playlist when none exists', async () => {
      Playlist.findOne.mockResolvedValue(null);
      Playlist.create.mockResolvedValue({ id: 1, playlist_id: 'PLabc' });

      const result = await playlistModule.upsertPlaylist({
        playlist_id: 'PLabc', title: 'X', url: 'https://u',
      }, { enabled: true });

      expect(Playlist.create).toHaveBeenCalledWith(expect.objectContaining({
        playlist_id: 'PLabc', title: 'X', enabled: true,
      }));
      expect(result.id).toBe(1);
    });

    test('updates existing playlist', async () => {
      const existing = { id: 2, playlist_id: 'PLabc', update: jest.fn().mockResolvedValue(true) };
      Playlist.findOne.mockResolvedValue(existing);

      await playlistModule.upsertPlaylist({
        playlist_id: 'PLabc', title: 'Updated',
      }, { enabled: true });

      expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Updated', enabled: true,
      }));
    });
  });

  describe('fetchAllPlaylistVideos', () => {
    test('parses yt-dlp flat-playlist output and upserts rows in position order', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');

      // Playlist.findOne is async — wait for it to resolve before emitting events
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const lines = [
        JSON.stringify({ id: 'v1', title: 'Video 1', channel_id: 'UC1', uploader: 'A', duration: 300 }),
        JSON.stringify({ id: 'v2', title: 'Video 2', channel_id: 'UC2', uploader: 'B', duration: 200 }),
      ].join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);

      await promise;

      expect(PlaylistVideo.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            playlist_id: 'PLabc',
            youtube_id: 'v1',
            position: 1,
            channel_id: 'UC1',
            channel_name: 'A',
            title: 'Video 1',
            duration: 300,
            thumbnail: 'https://i.ytimg.com/vi/v1/hqdefault.jpg',
          }),
          expect.objectContaining({
            playlist_id: 'PLabc',
            youtube_id: 'v2',
            position: 2,
            channel_id: 'UC2',
            channel_name: 'B',
            title: 'Video 2',
            duration: 200,
          }),
        ]),
        expect.objectContaining({ updateOnDuplicate: expect.any(Array) })
      );
    });

    test('applies min_duration filter', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: 250, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');

      // Playlist.findOne is async — wait for it to resolve before emitting events
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const lines = [
        JSON.stringify({ id: 'v1', title: 'Short Video', duration: 100 }),
        JSON.stringify({ id: 'v2', title: 'Long Video', duration: 300 }),
      ].join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);
      await promise;

      const call = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(call.map((v) => v.youtube_id)).toEqual(['v2']);
    });

    test('backfills playlist thumbnail from first video when null', async () => {
      const update = jest.fn().mockResolvedValue(true);
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        thumbnail: null,
        min_duration: null, max_duration: null, title_filter_regex: null,
        update,
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.stdout.emit('data', JSON.stringify({ id: 'firstVid', title: 'a' }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail: 'https://i.ytimg.com/vi/firstVid/hqdefault.jpg',
        })
      );
    });

    test('does not overwrite existing playlist thumbnail', async () => {
      const update = jest.fn().mockResolvedValue(true);
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        thumbnail: 'https://existing.example/thumb.jpg',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update,
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.stdout.emit('data', JSON.stringify({ id: 'firstVid', title: 'a' }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      const passed = update.mock.calls[0][0];
      expect(passed).not.toHaveProperty('thumbnail');
    });

    test('falls back to playlist_channel_id / playlist_channel when per-video channel fields are absent', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.stdout.emit(
        'data',
        JSON.stringify({ id: 'vid1', title: 'No Channel Entry', duration: 120, playlist_channel_id: 'UCowner', playlist_channel: 'OwnerName' }) + '\n'
      );
      mockChild.emit('close', 0);
      await promise;

      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'vid1')).toMatchObject({
        channel_id: 'UCowner',
        channel_name: 'OwnerName',
      });
    });

    test('prefers per-video channel_id over playlist_channel_id when present', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.stdout.emit(
        'data',
        JSON.stringify({ id: 'vid2', title: 'Has Own Channel', duration: 180, channel_id: 'UCreal', uploader: 'RealName', playlist_channel_id: 'UCowner', playlist_channel: 'OwnerName' }) + '\n'
      );
      mockChild.emit('close', 0);
      await promise;

      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'vid2')).toMatchObject({
        channel_id: 'UCreal',
        channel_name: 'RealName',
      });
    });

    test('excludes private/unavailable entries from the stored rows', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const lines = [
        JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 4 }),
        JSON.stringify({ id: 'v2', title: null, duration: null, playlist_count: 4 }),
        JSON.stringify({ id: 'v3', title: '[Private video]', duration: null, playlist_count: 4 }),
        JSON.stringify({ id: 'v4', title: '[Deleted video]', duration: null, playlist_count: 4 }),
      ].join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);
      await promise;

      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.map((r) => r.youtube_id)).toEqual(['v1']);
    });

    test('prunes tracked rows that are now private or removed from the playlist', async () => {
      const { Op } = require('sequelize');
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      PlaylistVideo.destroy.mockResolvedValue(0);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // YouTube now reports a 2-video playlist: v1 public, v2 went private.
      // v3 (previously tracked) is fully removed and absent from the fetch.
      const lines = [
        JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 2 }),
        JSON.stringify({ id: 'v2', title: null, duration: null, playlist_count: 2 }),
      ].join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);
      await promise;

      expect(PlaylistVideo.destroy).toHaveBeenCalledWith({
        where: { playlist_id: 'PLabc', youtube_id: { [Op.notIn]: ['v1'] } },
      });
    });

    test('does not prune when the fetch looks incomplete (fewer entries than reported)', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      PlaylistVideo.destroy.mockResolvedValue(0);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // Only 1 of 10 entries came back: a partial fetch must not delete anything.
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 10 }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('does not prune when the fetch returns no entries', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      PlaylistVideo.destroy.mockResolvedValue(0);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.emit('close', 0);
      await promise;

      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('sets playlist video_count to the available (non-private) count', async () => {
      const update = jest.fn().mockResolvedValue(true);
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        thumbnail: 'https://existing.example/thumb.jpg',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update,
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      PlaylistVideo.destroy.mockResolvedValue(0);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const lines = [
        JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 2 }),
        JSON.stringify({ id: 'v2', title: null, duration: null, playlist_count: 2 }),
      ].join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);
      await promise;

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ video_count: 1 }));
    });
  });

  describe('isUnavailableTitle', () => {
    test('treats null, empty, and placeholder titles as unavailable', () => {
      expect(playlistModule.isUnavailableTitle(null)).toBe(true);
      expect(playlistModule.isUnavailableTitle('')).toBe(true);
      expect(playlistModule.isUnavailableTitle('   ')).toBe(true);
      expect(playlistModule.isUnavailableTitle('[Private video]')).toBe(true);
      expect(playlistModule.isUnavailableTitle('[Deleted video]')).toBe(true);
    });

    test('treats a real title as available', () => {
      expect(playlistModule.isUnavailableTitle('I survived 100 days as a shapeshifter')).toBe(false);
    });
  });

  describe('ensureSourceChannel', () => {
    test('creates hidden channel with seeded settings from the playlist', async () => {
      channelModule.upsertChannel.mockResolvedValue({ id: 9, channel_id: 'UC9' });

      const playlist = {
        default_sub_folder: '__Learning',
        video_quality: '720',
        min_duration: 60,
        max_duration: null,
        title_filter_regex: null,
        audio_format: null,
        default_rating: 'PG-13',
      };

      await playlistModule.ensureSourceChannel(
        { channel_id: 'UC9', uploader: 'Creator X', url: 'https://www.youtube.com/channel/UC9' },
        playlist
      );

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'UC9', title: 'Creator X', uploader: 'Creator X', url: 'https://www.youtube.com/channel/UC9' }),
        false,
        null,
        expect.objectContaining({
          sub_folder: '__Learning',
          video_quality: '720',
          min_duration: 60,
          default_rating: 'PG-13',
        })
      );
    });

    test('seeds title and uploader from the channel name so the row is not left nameless', async () => {
      channelModule.upsertChannel.mockResolvedValue({ id: 9, channel_id: 'UCabc' });

      await playlistModule.ensureSourceChannel(
        { channel_id: 'UCabc', uploader: 'Little Mix' },
        {}
      );

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'UCabc', title: 'Little Mix', uploader: 'Little Mix' }),
        false,
        null,
        expect.any(Object)
      );
    });

    test('synthesizes a channel URL when only channel_id is provided', async () => {
      channelModule.upsertChannel.mockResolvedValue({ id: 9, channel_id: 'UCabc' });

      await playlistModule.ensureSourceChannel({ channel_id: 'UCabc' }, {});

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'UCabc',
          url: 'https://www.youtube.com/channel/UCabc',
          uploader: null,
        }),
        false,
        null,
        expect.any(Object)
      );
    });

    test('seeds null (explicit root) when the playlist subfolder is null', async () => {
      channelModule.upsertChannel.mockResolvedValue({ id: 9, channel_id: 'UCabc' });

      await playlistModule.ensureSourceChannel(
        { channel_id: 'UCabc' },
        { default_sub_folder: null }
      );

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.any(Object),
        false,
        null,
        expect.objectContaining({ sub_folder: null })
      );
    });

    test('passes the global-default sentinel through to the seeded channel', async () => {
      const { GLOBAL_DEFAULT_SENTINEL } = require('../filesystem/constants');
      channelModule.upsertChannel.mockResolvedValue({ id: 9, channel_id: 'UCabc' });

      await playlistModule.ensureSourceChannel(
        { channel_id: 'UCabc' },
        { default_sub_folder: GLOBAL_DEFAULT_SENTINEL }
      );

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.any(Object),
        false,
        null,
        expect.objectContaining({ sub_folder: GLOBAL_DEFAULT_SENTINEL })
      );
    });

    test('uses playlist default_sub_folder when set', async () => {
      channelModule.upsertChannel.mockResolvedValue({ id: 9, channel_id: 'UCabc' });

      await playlistModule.ensureSourceChannel(
        { channel_id: 'UCabc' },
        { default_sub_folder: 'Learning' }
      );

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.any(Object),
        false,
        null,
        expect.objectContaining({ sub_folder: 'Learning' })
      );
    });
  });

  describe('playlistAutoDownload', () => {
    test('invokes downloadModule.doPlaylistDownloads for each enabled playlist', async () => {
      Playlist.findAll.mockResolvedValue([
        { id: 1, playlist_id: 'PL1' },
        { id: 2, playlist_id: 'PL2' },
      ]);
      await playlistModule.playlistAutoDownload();
      expect(downloadModule.doPlaylistDownloads).toHaveBeenCalledTimes(2);
    });

    test('downloads each enabled auto_download playlist with refresh + recent limit', async () => {
      const pl1 = { playlist_id: 'PL1', title: 'One' };
      const pl2 = { playlist_id: 'PL2', title: 'Two' };
      Playlist.findAll.mockResolvedValue([pl1, pl2]);

      await playlistModule.playlistAutoDownload();

      expect(Playlist.findAll).toHaveBeenCalledWith({
        where: { enabled: true, auto_download: true },
      });
      expect(downloadModule.doPlaylistDownloads).toHaveBeenCalledTimes(2);
      expect(downloadModule.doPlaylistDownloads).toHaveBeenNthCalledWith(
        1,
        pl1,
        { refreshFirst: true, limitToRecent: true, overrideSettings: {} }
      );
      expect(downloadModule.doPlaylistDownloads).toHaveBeenNthCalledWith(
        2,
        pl2,
        { refreshFirst: true, limitToRecent: true, overrideSettings: {} }
      );
    });

    test('threads manual override settings through to each playlist download', async () => {
      const pl1 = { playlist_id: 'PL1', title: 'One' };
      const pl2 = { playlist_id: 'PL2', title: 'Two' };
      Playlist.findAll.mockResolvedValue([pl1, pl2]);

      await playlistModule.playlistAutoDownload({ resolution: '720', videoCount: 3 });

      expect(downloadModule.doPlaylistDownloads).toHaveBeenNthCalledWith(
        1,
        pl1,
        { refreshFirst: true, limitToRecent: true, overrideSettings: { resolution: '720', videoCount: 3 } }
      );
      expect(downloadModule.doPlaylistDownloads).toHaveBeenNthCalledWith(
        2,
        pl2,
        { refreshFirst: true, limitToRecent: true, overrideSettings: { resolution: '720', videoCount: 3 } }
      );
    });
  });

  describe('fetchAllPlaylistVideos published_at backfill', () => {
    function mockFlatPlaylist(entries) {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      childProcess.spawn.mockReturnValue(child);
      setImmediate(() => {
        entries.forEach((e) => child.stdout.emit('data', JSON.stringify(e) + '\n'));
        child.emit('close', 0);
      });
    }

    beforeEach(() => {
      Playlist.findOne.mockResolvedValue({
        playlist_id: 'PL1',
        url: 'https://youtube.com/playlist?list=PL1',
        title_filter_regex: null,
        min_duration: null,
        max_duration: null,
        thumbnail: 'x',
        update: jest.fn().mockResolvedValue(undefined),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
    });

    test('fills published_at from the YouTube API for videos missing a date', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key123');
      youtubeApi.client.getVideoMetadata.mockResolvedValue([
        { id: 'a', uploadDate: '20240115' },
      ]);
      mockFlatPlaylist([{ id: 'a', title: 'A' }]);

      await playlistModule.fetchAllPlaylistVideos('PL1');

      expect(youtubeApi.client.getVideoMetadata).toHaveBeenCalledWith('key123', ['a']);
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'a').published_at).toBe('20240115');
    });

    test('does not call the API when it is unavailable', async () => {
      const logger = require('../../logger');
      youtubeApi.isAvailable.mockReturnValue(false);
      mockFlatPlaylist([{ id: 'a', title: 'A' }]);

      await playlistModule.fetchAllPlaylistVideos('PL1');

      expect(youtubeApi.client.getVideoMetadata).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'a').published_at).toBeNull();
    });

    test('does not call the API for videos that already have a published date', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key123');
      mockFlatPlaylist([{ id: 'a', title: 'A', upload_date: '20231201' }]);

      await playlistModule.fetchAllPlaylistVideos('PL1');

      expect(youtubeApi.client.getVideoMetadata).not.toHaveBeenCalled();
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'a').published_at).toBe('20231201');
    });

    test('proceeds with null dates when the API call throws', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key123');
      youtubeApi.client.getVideoMetadata.mockRejectedValue(new Error('quota'));
      mockFlatPlaylist([{ id: 'a', title: 'A' }]);

      await expect(playlistModule.fetchAllPlaylistVideos('PL1')).resolves.toBeDefined();
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'a').published_at).toBeNull();
    });

    test('preserves a stored published_at instead of overwriting it with null when the API is unavailable', async () => {
      youtubeApi.isAvailable.mockReturnValue(false);
      PlaylistVideo.findAll.mockResolvedValue([
        { youtube_id: 'a', published_at: '20240115' },
      ]);
      mockFlatPlaylist([{ id: 'a', title: 'A' }]);

      await playlistModule.fetchAllPlaylistVideos('PL1');

      expect(youtubeApi.client.getVideoMetadata).not.toHaveBeenCalled();
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'a').published_at).toBe('20240115');
    });

    test('only queries the API for ids still missing after the DB preserve step', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key123');
      PlaylistVideo.findAll.mockResolvedValue([
        { youtube_id: 'a', published_at: '20240115' },
      ]);
      youtubeApi.client.getVideoMetadata.mockResolvedValue([
        { id: 'b', uploadDate: '20240220' },
      ]);
      mockFlatPlaylist([
        { id: 'a', title: 'A' },
        { id: 'b', title: 'B' },
      ]);

      await playlistModule.fetchAllPlaylistVideos('PL1');

      expect(youtubeApi.client.getVideoMetadata).toHaveBeenCalledWith('key123', ['b']);
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'a').published_at).toBe('20240115');
      expect(rows.find((r) => r.youtube_id === 'b').published_at).toBe('20240220');
    });
  });
});
