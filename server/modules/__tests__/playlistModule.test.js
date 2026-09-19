jest.mock('child_process');
jest.mock('../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../models', () => ({
  Playlist: { findOne: jest.fn(), create: jest.fn(), update: jest.fn(), findAll: jest.fn() },
  PlaylistVideo: { findAll: jest.fn(), bulkCreate: jest.fn(), update: jest.fn(), destroy: jest.fn(), count: jest.fn(), max: jest.fn() },
  Channel: { findAll: jest.fn() },
}));
jest.mock('../../db', () => ({
  sequelize: { query: jest.fn().mockResolvedValue([]), transaction: jest.fn(async (action) => action({})) },
  Sequelize: { QueryTypes: { SELECT: 'SELECT' } },
}));
jest.mock('../configModule', () => ({
  getConfig: jest.fn(() => ({})),
  directoryPath: '/mock/youtube/output',
  ffmpegPath: '/usr/bin/ffmpeg',
  getCookiesPath: jest.fn(() => null),
  on: jest.fn(),
}));
jest.mock('../channelModule', () => ({
  upsertChannel: jest.fn(),
}));
jest.mock('../downloadModule', () => ({
  doPlaylistDownloads: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../jobModule', () => ({
  addJob: jest.fn().mockResolvedValue('mock-job-id'),
}));
jest.mock('../youtubeApi', () => ({
  isAvailable: jest.fn(() => false),
  getApiKey: jest.fn(() => null),
  client: { getVideoMetadata: jest.fn() },
}));

const { EventEmitter } = require('events');

function completedChild(output) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  queueMicrotask(() => {
    if (output instanceof Error) {
      child.stderr.emit('data', output.message);
      child.emit('close', 1);
      return;
    }
    const lines = Array.isArray(output) ? output.map((row) => JSON.stringify(row)).join('\n') : JSON.stringify(output);
    child.stdout.emit('data', lines);
    child.emit('close', 0);
  });
  return child;
}

describe('playlistModule', () => {
  let playlistModule;
  let Playlist;
  let PlaylistVideo;
  let Channel;
  let channelModule;
  let downloadModule;
  let jobModule;
  let childProcess;
  let youtubeApi;
  let db;
  let flatPlaylistSpawn;
  let metadataCount;
  let fallbackMetadataCount;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    // Set up spawn on the mock BEFORE requiring playlistModule so the
    // destructured `const { spawn } = require('child_process')` in the module
    // captures our jest.fn().
    childProcess = require('child_process');
    flatPlaylistSpawn = jest.fn();
    metadataCount = null;
    fallbackMetadataCount = null;
    childProcess.spawn = jest.fn((binary, args) => {
      if (args.includes('--playlist-items')) {
        const count = args.includes('--extractor-args') ? fallbackMetadataCount : metadataCount;
        return completedChild({ playlist_count: count });
      }
      return flatPlaylistSpawn(binary, args);
    });
    // Now require the module — its top-level destructure picks up the mock.
    playlistModule = require('../playlistModule');
    ({ Playlist, PlaylistVideo, Channel } = require('../../models'));
    PlaylistVideo.count.mockResolvedValue(0);
    channelModule = require('../channelModule');
    downloadModule = require('../downloadModule');
    jobModule = require('../jobModule');
    youtubeApi = require('../youtubeApi');
    db = require('../../db');
    db.sequelize.query.mockResolvedValue([]);
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
    test('creates a new playlist with the provided settings when none exists', async () => {
      Playlist.findOne.mockResolvedValue(null);
      Playlist.create.mockResolvedValue({ id: 1, playlist_id: 'PLabc' });

      const result = await playlistModule.upsertPlaylist({
        playlist_id: 'PLabc', title: 'X', url: 'https://u',
      }, { enabled: true, settings: { sync_to_plex: true } });

      expect(Playlist.create).toHaveBeenCalledWith(expect.objectContaining({
        playlist_id: 'PLabc', title: 'X', enabled: true, sync_to_plex: true,
      }));
      expect(result.playlist.id).toBe(1);
      expect(result.restored).toBe(false);
    });

    test('updates existing playlist metadata', async () => {
      const existing = { id: 2, playlist_id: 'PLabc', enabled: true, update: jest.fn().mockResolvedValue(true) };
      Playlist.findOne.mockResolvedValue(existing);

      const result = await playlistModule.upsertPlaylist({
        playlist_id: 'PLabc', title: 'Updated',
      }, { enabled: true });

      expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Updated', enabled: true,
      }));
      expect(result.playlist).toBe(existing);
      expect(result.restored).toBe(false);
    });

    test('re-enables a soft-deleted playlist without clobbering its saved settings and reports restored', async () => {
      const existing = { id: 2, playlist_id: 'PLabc', enabled: false, update: jest.fn().mockResolvedValue(true) };
      Playlist.findOne.mockResolvedValue(existing);

      const result = await playlistModule.upsertPlaylist({
        playlist_id: 'PLabc', title: 'Re-added',
      }, { enabled: true, settings: { sync_to_plex: false, default_sub_folder: 'Other' } });

      expect(result.restored).toBe(true);
      const updatePayload = existing.update.mock.calls[0][0];
      expect(updatePayload).toEqual(expect.objectContaining({ title: 'Re-added', enabled: true }));
      expect(updatePayload).not.toHaveProperty('sync_to_plex');
      expect(updatePayload).not.toHaveProperty('default_sub_folder');
    });

    test('does not apply settings when updating an already-enabled playlist', async () => {
      const existing = { id: 2, playlist_id: 'PLabc', enabled: true, update: jest.fn().mockResolvedValue(true) };
      Playlist.findOne.mockResolvedValue(existing);

      const result = await playlistModule.upsertPlaylist({
        playlist_id: 'PLabc', title: 'Same',
      }, { enabled: true, settings: { sync_to_emby: true } });

      expect(result.restored).toBe(false);
      expect(existing.update.mock.calls[0][0]).not.toHaveProperty('sync_to_emby');
    });
  });

  describe('following initialization', () => {
    let p;
    const entries = (count, total) => Array.from({ length: count }, (_, i) => ({
      id: `video${i}`, title: `Video ${i}`, playlist_count: total, n_entries: count,
    }));

    beforeEach(() => {
      metadataCount = 2;
      p = { playlist_id: 'PL1', url: 'https://u', video_count: 2, enabled: true, auto_download: true, reload: jest.fn() };
      p.update = jest.fn(async (values) => Object.assign(p, values));
      Playlist.update.mockImplementation(async (values) => { Object.assign(p, values); return [1]; });
      Playlist.findOne.mockResolvedValue(p);
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.max.mockResolvedValue(25);
      flatPlaylistSpawn.mockImplementation(() => completedChild(entries(2, 2)));
    });

    test.each([
      ['PLAYLIST_TOO_LARGE', 5001, false],
      ['PLAYLIST_REFRESH_INCOMPLETE', 3, true],
    ])('recovers %s without stamping a partial baseline or clearing requests', async (code, total, autoDownload) => {
      metadataCount = total;
      const warning = await playlistModule.recoverFollowingSetup(p, new Error(code));
      expect(p).toMatchObject({ auto_download: autoDownload, auto_download_setup_error: code });
      expect(p.auto_download_baseline_at).toBeUndefined();
      expect(PlaylistVideo.bulkCreate).toHaveBeenCalledWith(expect.any(Array), expect.any(Object));
      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
      expect(PlaylistVideo.update).not.toHaveBeenCalled();
      expect(warning).toContain('Playlist saved.');
    });

    test('subscription recovery pauses even a transient setup failure', async () => {
      metadataCount = 3;
      await playlistModule.recoverFollowingSetup(p, new Error('PLAYLIST_REFRESH_INCOMPLETE'), { disableAutoDownload: true });
      expect(p.auto_download).toBe(false);
      expect(p.auto_download_setup_error).toBe('PLAYLIST_REFRESH_INCOMPLETE');
    });

    test('keeps the setup explanation when the fallback listing also fails', async () => {
      flatPlaylistSpawn.mockImplementation(() => completedChild(new Error('network down')));
      const warning = await playlistModule.recoverFollowingSetup(p, new Error('PLAYLIST_TOO_LARGE'));
      expect(warning).toContain('video listing could not be refreshed');
      expect(p.auto_download_setup_error).toBe('PLAYLIST_TOO_LARGE');
      expect(playlistModule.activeFetches.size).toBe(0);
    });

    test('successful setup clears a persisted failure', async () => {
      p.auto_download_setup_error = 'PLAYLIST_REFRESH_INCOMPLETE';
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_setup_error).toBeNull();
      expect(p.auto_download_baseline_id).toBe(25);
    });

    test('a concurrent refresh is not treated as a reason to disable following', async () => {
      playlistModule.activeFetches.add('PL1');
      const warning = await playlistModule.recoverFollowingSetup(p, new Error('PLAYLIST_TOO_LARGE'));
      expect(warning).toContain('Another refresh is in progress');
      expect(Playlist.update).not.toHaveBeenCalled();
      expect(p.auto_download).toBe(true);
    });

    test('does not overwrite a baseline established before recovery acquired the guard', async () => {
      p.reload.mockImplementation(async () => { p.auto_download_baseline_at = new Date(); });
      await playlistModule.recoverFollowingSetup(p, new Error('PLAYLIST_TOO_LARGE'));
      expect(Playlist.update).not.toHaveBeenCalled();
      expect(flatPlaylistSpawn).not.toHaveBeenCalled();
    });

    test('does not overwrite a concurrent pause during the conditional settings update', async () => {
      Playlist.update.mockImplementation(async () => { p.auto_download = false; return [0]; });
      const warning = await playlistModule.recoverFollowingSetup(p, new Error('PLAYLIST_REFRESH_INCOMPLETE'));
      expect(Playlist.update).toHaveBeenCalledWith(expect.any(Object), { where: {
        playlist_id: 'PL1', enabled: true, auto_download: true, auto_download_baseline_at: null,
      } });
      expect(p.auto_download).toBe(false);
      expect(warning).toContain('current settings were kept');
    });

    test('does not recover unrelated failures', async () => {
      const err = new Error('database unavailable');
      await expect(playlistModule.recoverFollowingSetup(p, err)).rejects.toBe(err);
      expect(Playlist.update).not.toHaveBeenCalled();
    });

    test('initialization saves the snapshot boundary without clearing saved requests', async () => {
      await playlistModule.fetchAllPlaylistVideos('PL1', { followFromNow: true });
      expect(p.update).toHaveBeenCalledWith(expect.objectContaining({
        auto_download_baseline_id: 25, auto_download_baseline_at: expect.any(Date),
      }), { transaction: expect.any(Object) });
      expect(PlaylistVideo.update).not.toHaveBeenCalled();
    });

    test.each([null, '[Private video]', '[Deleted video]'])('initializes following when the complete snapshot includes an unavailable title: %s', async (title) => {
      metadataCount = 4;
      const snapshot = entries(4, 4);
      snapshot[0].title = title;
      flatPlaylistSpawn.mockImplementation(() => completedChild(snapshot));
      PlaylistVideo.count.mockResolvedValue(3);

      await playlistModule.fetchAllPlaylistVideos('PL1', { followFromNow: true });

      const storedRows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(storedRows.map((row) => row.youtube_id)).toEqual(['video1', 'video2', 'video3']);
      expect(p).toMatchObject({
        video_count: 3,
        auto_download_baseline_id: 25,
        auto_download_baseline_at: expect.any(Date),
        auto_download_setup_error: null,
      });
    });

    test('explicit reset replaces the baseline and clears saved requests in the same transaction', async () => {
      const oldCutoff = new Date('2020-01-01T00:00:00Z');
      Object.assign(p, { auto_download_baseline_at: oldCutoff, auto_download_baseline_id: 20 });
      await playlistModule.fetchAllPlaylistVideos('PL1', { followFromNow: true, resetFollowing: true });
      const transaction = p.update.mock.calls[0][1].transaction;
      expect(PlaylistVideo.update).toHaveBeenCalledWith({ auto_download_requested: false }, {
        where: { playlist_id: 'PL1' }, transaction,
      });
      expect(p.auto_download_baseline_id).toBe(25);
      expect(p.auto_download_baseline_at.getTime()).toBeGreaterThan(oldCutoff.getTime());
    });

    test('reset preserves stored discovery and download dates', async () => {
      await playlistModule.fetchAllPlaylistVideos('PL1', { followFromNow: true, resetFollowing: true });
      const { updateOnDuplicate } = PlaylistVideo.bulkCreate.mock.calls[0][1];
      expect(updateOnDuplicate).not.toEqual(expect.arrayContaining(['first_seen_at']));
      expect(updateOnDuplicate).not.toEqual(expect.arrayContaining(['downloaded_at']));
      expect(updateOnDuplicate).not.toEqual(expect.arrayContaining(['added_at']));
    });

    test('refreshForFollowing reloads the saved starting point and preserves a pause', async () => {
      p.auto_download = false;
      await playlistModule.refreshForFollowing(p, { resetFollowing: true });
      expect(p.reload).toHaveBeenCalledTimes(1);
      expect(p.auto_download).toBe(false);
      expect(p.update.mock.calls[0][0]).not.toHaveProperty('auto_download');
    });

    test('an ordinary refresh preserves a saved cutoff and batch requests', async () => {
      const baseline = new Date('2026-09-01T00:00:00Z');
      Object.assign(p, { auto_download_baseline_at: baseline, auto_download_baseline_id: 20 });
      await playlistModule.fetchAllPlaylistVideos('PL1');
      expect(p.auto_download_baseline_at).toBe(baseline);
      expect(p.auto_download_baseline_id).toBe(20);
      expect(PlaylistVideo.update).not.toHaveBeenCalled();
    });

    test('a stale first-enable request preserves an already initialized cutoff', async () => {
      const baseline = new Date('2026-09-01T00:00:00Z');
      Object.assign(p, { auto_download_baseline_at: baseline, auto_download_baseline_id: 20 });
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_baseline_at).toBe(baseline);
      expect(p.auto_download_baseline_id).toBe(20);
      expect(PlaylistVideo.update).not.toHaveBeenCalled();
    });

    test('does not use n_entries to certify a truncated InnerTube baseline', async () => {
      metadataCount = 500;
      flatPlaylistSpawn
        .mockImplementationOnce(() => completedChild(entries(100)))
        .mockImplementationOnce(() => completedChild(entries(200)));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
      expect(p.update).not.toHaveBeenCalled();
      expect(PlaylistVideo.bulkCreate).not.toHaveBeenCalled();
      expect(playlistModule.activeFetches.size).toBe(0);
    });

    test('missing metadata cannot turn a per-entry extracted count into proof of completeness', async () => {
      metadataCount = null;
      flatPlaylistSpawn.mockImplementation(() => completedChild(entries(200, 200)));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('can verify a complete default listing through separate fallback metadata', async () => {
      metadataCount = null;
      fallbackMetadataCount = 2;
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_baseline_id).toBe(25);
      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(1);
    });

    test.each(['', 'unknown', true, -1, 2.5])('rejects an invalid metadata total %s', async (total) => {
      metadataCount = total;
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
    });

    test('unknown totals do not prune tracked entries during ordinary refresh', async () => {
      metadataCount = null;
      await playlistModule.fetchAllPlaylistVideos('PL1');
      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('a complete fallback can replace a smaller extracted count', async () => {
      metadataCount = 500;
      flatPlaylistSpawn
        .mockImplementationOnce(() => completedChild(entries(100, 100)))
        .mockImplementationOnce(() => completedChild(entries(500, 500)));
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_baseline_id).toBe(25);
    });

    test('retains a larger reported total when choosing a larger fallback result', async () => {
      metadataCount = null;
      fallbackMetadataCount = 200;
      flatPlaylistSpawn
        .mockImplementationOnce(() => completedChild(entries(100, 500)))
        .mockImplementationOnce(() => completedChild(entries(200, 200)));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
    });

    test('can verify an InnerTube result using its separate metadata request', async () => {
      metadataCount = null;
      fallbackMetadataCount = 2;
      flatPlaylistSpawn.mockImplementationOnce(() => completedChild(new Error('network unavailable')));
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_baseline_id).toBe(25);
    });

    test('does not allow the ordinary refresh count tolerance when setting a baseline', async () => {
      metadataCount = 3;
      flatPlaylistSpawn.mockImplementation(() => completedChild(entries(2, 3)));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
    });

    test('a failed reset preserves the old baseline and explicit requests', async () => {
      const baseline = new Date('2026-09-01T00:00:00Z');
      Object.assign(p, { auto_download_baseline_at: baseline, auto_download_baseline_id: 20 });
      metadataCount = 50;
      await expect(playlistModule.refreshForFollowing(p, { resetFollowing: true })).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
      expect(p.auto_download_baseline_at).toBe(baseline);
      expect(PlaylistVideo.update).not.toHaveBeenCalled();
      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('a confirmed empty playlist can establish a zero boundary and prune removed rows', async () => {
      metadataCount = 0;
      PlaylistVideo.max.mockResolvedValue(null);
      flatPlaylistSpawn.mockImplementation(() => completedChild([]));
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_baseline_id).toBe(0);
      expect(PlaylistVideo.destroy).toHaveBeenCalledWith({ where: { playlist_id: 'PL1' } });
    });

    test('empty output without a reported zero is not a confirmed empty playlist', async () => {
      metadataCount = null;
      p.video_count = 0;
      flatPlaylistSpawn.mockImplementation(() => completedChild([]));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('supports a verified playlist of exactly 5000 entries', async () => {
      metadataCount = 5000;
      PlaylistVideo.max.mockResolvedValue(5000);
      flatPlaylistSpawn.mockImplementation(() => completedChild(entries(5000, 5000)));
      await playlistModule.refreshForFollowing(p);
      expect(p.auto_download_baseline_id).toBe(5000);
    });

    test('rejects a known oversized playlist with a permanent size-limit error', async () => {
      metadataCount = 5001;
      flatPlaylistSpawn.mockImplementation(() => completedChild(entries(5000, 5001)));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_TOO_LARGE');
      expect(flatPlaylistSpawn).not.toHaveBeenCalled();
      expect(p.update).not.toHaveBeenCalled();
    });

    test('hitting the cap with an unknown total does not establish a baseline', async () => {
      metadataCount = null;
      flatPlaylistSpawn.mockImplementation(() => completedChild(entries(5000)));
      await expect(playlistModule.refreshForFollowing(p)).rejects.toThrow('PLAYLIST_REFRESH_INCOMPLETE');
    });
  });

  describe('fetchAllPlaylistVideos', () => {
    test('fetches via the default path with the full-playlist cap', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1' }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      const spawnArgs = flatPlaylistSpawn.mock.calls[0][1];
      expect(spawnArgs).toEqual(expect.arrayContaining([
        '--playlist-end', '5000',
      ]));
      expect(spawnArgs).not.toContain('--extractor-args');
    });

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
      flatPlaylistSpawn.mockReturnValue(mockChild);

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
      flatPlaylistSpawn.mockReturnValue(mockChild);
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.stdout.emit('data', JSON.stringify({ id: 'firstVid', title: 'a' }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      const passed = update.mock.calls[0][0];
      expect(passed).not.toHaveProperty('thumbnail');
    });

    test('leaves channel fields null instead of substituting the playlist owner when per-video channel fields are absent', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
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
        channel_id: null,
        channel_name: null,
      });
    });

    test('carries forward stored channel attribution when a stripped fetch omits it', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      // A previous good fetch captured the artist attribution for this video.
      PlaylistVideo.findAll.mockResolvedValue([
        { youtube_id: 'vid1', published_at: null, channel_id: 'UCartist', channel_name: 'Artist' },
      ]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      mockChild.stdout.emit(
        'data',
        JSON.stringify({ id: 'vid1', title: 'Stripped Entry', duration: 120, playlist_channel_id: 'UCowner', playlist_channel: 'OwnerName' }) + '\n'
      );
      mockChild.emit('close', 0);
      await promise;

      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.find((r) => r.youtube_id === 'vid1')).toMatchObject({
        channel_id: 'UCartist',
        channel_name: 'Artist',
      });
    });

    test('stores per-video channel attribution, ignoring playlist-owner fields', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
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
      metadataCount = 2;
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
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

      // A short first fetch (1 of 10) is itself the InnerTube-fallback trigger,
      // so a second child is needed for the automatic retry.
      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // Only 1 of 10 entries came back on the default path.
      defaultChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 10 }) + '\n');
      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // The InnerTube fallback also comes back short: the fetch remains
      // partial and must not delete anything.
      innertubeChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 10 }) + '\n');
      innertubeChild.emit('close', 0);
      await promise;

      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('does not prune when the fetch returns no entries on either path', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      PlaylistVideo.destroy.mockResolvedValue(0);

      // An empty default-path result now triggers the InnerTube fallback,
      // so a second child is needed even though it also comes back empty.
      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      innertubeChild.emit('close', 0);
      await promise;

      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(2);
      expect(PlaylistVideo.destroy).not.toHaveBeenCalled();
    });

    test('sets playlist video_count from the tracked row count, not the fetched entry count', async () => {
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
      // 198 rows already tracked from an earlier full fetch; this capped fetch
      // returns only 1 entry and must not clobber the count down to 1.
      PlaylistVideo.count.mockResolvedValue(198);

      // A short first fetch (1 of 198) is itself the InnerTube-fallback
      // trigger, so a second child is needed for the automatic retry.
      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      defaultChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 198 }) + '\n');
      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // The InnerTube fallback also returns only 1 entry; video_count must
      // still reflect the tracked row count, not either fetch's entry count.
      innertubeChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Public Video', duration: 300, playlist_count: 198 }) + '\n');
      innertubeChild.emit('close', 0);
      await promise;

      expect(PlaylistVideo.count).toHaveBeenCalledWith({ where: { playlist_id: 'PLabc' } });
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ video_count: 198 }));
    });

    test('spawns yt-dlp with exactly the default-path args capped at 5000 entries', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // A non-empty result (with no reported count) keeps this test scoped to
      // the default-path args; an empty result would itself trigger the
      // InnerTube fallback and is covered separately.
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1' }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      expect(flatPlaylistSpawn).toHaveBeenCalledWith('yt-dlp', [
        '-4',
        '--paths', 'temp:/mock/youtube/output/.youtarr_tmp',
        '--flat-playlist', '--dump-json',
        '--playlist-end', '5000',
        'https://u',
      ]);
    });

    test('retries via InnerTube when the default fetch falls short of the reported count', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const defaultLines = [
        JSON.stringify({ id: 'v1', title: 'Video 1', playlist_count: 500 }),
        JSON.stringify({ id: 'v2', title: 'Video 2', playlist_count: 500 }),
      ].join('\n') + '\n';
      defaultChild.stdout.emit('data', defaultLines);
      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const innertubeLines = [
        JSON.stringify({ id: 'v1', title: 'Video 1', playlist_count: 500 }),
        JSON.stringify({ id: 'v2', title: 'Video 2', playlist_count: 500 }),
        JSON.stringify({ id: 'v3', title: 'Video 3', playlist_count: 500 }),
      ].join('\n') + '\n';
      innertubeChild.stdout.emit('data', innertubeLines);
      innertubeChild.emit('close', 0);
      await promise;

      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(2);
      const secondCallArgs = flatPlaylistSpawn.mock.calls[1][1];
      expect(secondCallArgs).toEqual(expect.arrayContaining([
        '--extractor-args', 'youtubetab:skip=webpage',
      ]));
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.map((r) => r.youtube_id)).toEqual(['v1', 'v2', 'v3']);
    });

    test('retries via InnerTube when the default fetch returns no entries', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // The default path resolves with exit code 0 but no stdout at all.
      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const innertubeLines = [
        JSON.stringify({ id: 'v1', title: 'Video 1' }),
        JSON.stringify({ id: 'v2', title: 'Video 2' }),
      ].join('\n') + '\n';
      innertubeChild.stdout.emit('data', innertubeLines);
      innertubeChild.emit('close', 0);
      await promise;

      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(2);
      const secondCallArgs = flatPlaylistSpawn.mock.calls[1][1];
      expect(secondCallArgs).toEqual(expect.arrayContaining([
        '--extractor-args', 'youtubetab:skip=webpage',
      ]));
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.map((r) => r.youtube_id)).toEqual(['v1', 'v2']);
    });

    test('keeps the default result when the InnerTube retry returns fewer entries', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const defaultLines = [
        JSON.stringify({ id: 'v1', title: 'Video 1', playlist_count: 500 }),
        JSON.stringify({ id: 'v2', title: 'Video 2', playlist_count: 500 }),
        JSON.stringify({ id: 'v3', title: 'Video 3', playlist_count: 500 }),
      ].join('\n') + '\n';
      defaultChild.stdout.emit('data', defaultLines);
      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const innertubeLines = [
        JSON.stringify({ id: 'v1', title: 'Video 1', playlist_count: 500 }),
        JSON.stringify({ id: 'v2', title: 'Video 2', playlist_count: 500 }),
      ].join('\n') + '\n';
      innertubeChild.stdout.emit('data', innertubeLines);
      innertubeChild.emit('close', 0);
      await promise;

      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.map((r) => r.youtube_id)).toEqual(['v1', 'v2', 'v3']);
    });

    test('keeps the default result when the InnerTube retry itself fails', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const defaultLines = [
        JSON.stringify({ id: 'v1', title: 'Video 1', playlist_count: 500 }),
        JSON.stringify({ id: 'v2', title: 'Video 2', playlist_count: 500 }),
        JSON.stringify({ id: 'v3', title: 'Video 3', playlist_count: 500 }),
      ].join('\n') + '\n';
      defaultChild.stdout.emit('data', defaultLines);
      defaultChild.emit('close', 0);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      innertubeChild.stderr.emit('data', 'ERROR: InnerTube exploded');
      innertubeChild.emit('close', 1);

      await expect(promise).resolves.toBeDefined();
      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(2);
      const rows = PlaylistVideo.bulkCreate.mock.calls[0][0];
      expect(rows.map((r) => r.youtube_id)).toEqual(['v1', 'v2', 'v3']);
    });

    test('does not retry when the fetch is within the slack of the reported count', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const lines = Array.from({ length: 10 }, (_, i) =>
        JSON.stringify({ id: `v${i}`, title: `Video ${i}`, playlist_count: 12 })
      ).join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);
      await promise;

      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(1);
    });

    test('falls back to InnerTube when the default fetch fails', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      defaultChild.stderr.emit('data', 'ERROR: network unreachable');
      defaultChild.emit('close', 1);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      // Fallback result is itself short of the reported count; the guard must
      // stop a would-be third spawn (never retry twice).
      innertubeChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1', playlist_count: 500 }) + '\n');
      innertubeChild.emit('close', 0);
      await promise;

      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(2);
    });

    test('rejects when both fetch paths fail', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      const defaultChild = new EventEmitter();
      defaultChild.stdout = new EventEmitter();
      defaultChild.stderr = new EventEmitter();
      const innertubeChild = new EventEmitter();
      innertubeChild.stdout = new EventEmitter();
      innertubeChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(defaultChild)
        .mockReturnValueOnce(innertubeChild);

      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      defaultChild.emit('close', 1);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      innertubeChild.emit('close', 1);

      await expect(promise).rejects.toThrow('NETWORK_ERROR');
    });

    test('warns when the fetch hits the 5000-entry cap', async () => {
      const logger = require('../../logger');
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      const lines = Array.from({ length: 5000 }, (_, i) =>
        JSON.stringify({ id: `v${i}`, title: `Video ${i}` })
      ).join('\n') + '\n';
      mockChild.stdout.emit('data', lines);
      mockChild.emit('close', 0);
      await promise;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ playlist_id: 'PLabc', fetched: 5000, cap: 5000 }),
        expect.stringContaining('cap')
      );
    });

    test('does not clobber added_at on existing rows during a refresh', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1', duration: 100 }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      const updateOnDuplicate = PlaylistVideo.bulkCreate.mock.calls[0][1].updateOnDuplicate;
      expect(updateOnDuplicate).not.toContain('added_at');
      expect(updateOnDuplicate).not.toContain('first_seen_at');
      expect(updateOnDuplicate).not.toContain('downloaded_at');
      expect(updateOnDuplicate).not.toContain('auto_download_requested');
      expect(updateOnDuplicate).not.toContain('auto_download_last_attempt_at');
    });

    test('reconciles rows against downloaded videos after the fetch completes', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      const reconcile = jest.spyOn(playlistModule, 'backfillFromDownloadedVideos').mockResolvedValue(undefined);

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1', duration: 100 }) + '\n');
      mockChild.emit('close', 0);
      await promise;

      expect(reconcile).toHaveBeenCalledWith('PLabc');
    });

    test('a failed downloaded-video reconciliation does not fail the fetch', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);
      jest.spyOn(playlistModule, 'backfillFromDownloadedVideos').mockRejectedValue(new Error('db down'));

      const mockChild = new EventEmitter();
      mockChild.stdout = new EventEmitter();
      mockChild.stderr = new EventEmitter();
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const promise = playlistModule.fetchAllPlaylistVideos('PLabc');

      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1', duration: 100 }) + '\n');
      mockChild.emit('close', 0);

      await expect(promise).resolves.toBe(1);
    });

    test('rejects a second fetch while one is in progress for the same playlist', async () => {
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
      flatPlaylistSpawn.mockReturnValue(mockChild);
      const first = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      await expect(playlistModule.fetchAllPlaylistVideos('PLabc')).rejects.toThrow('FETCH_IN_PROGRESS');

      // A non-empty result avoids triggering the InnerTube fallback; this
      // test only cares about the in-progress guard.
      mockChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1' }) + '\n');
      mockChild.emit('close', 0);
      await first;
    });

    test('allows a new fetch after a failed one clears the in-progress guard', async () => {
      Playlist.findOne.mockResolvedValue({
        id: 1, playlist_id: 'PLabc', url: 'https://u',
        min_duration: null, max_duration: null, title_filter_regex: null,
        update: jest.fn().mockResolvedValue(true),
      });
      PlaylistVideo.findAll.mockResolvedValue([]);
      PlaylistVideo.bulkCreate.mockResolvedValue([]);

      // Both the default fetch and its InnerTube fallback must fail for the
      // overall fetch to reject (dual-path fetch).
      const failingChild = new EventEmitter();
      failingChild.stdout = new EventEmitter();
      failingChild.stderr = new EventEmitter();
      const failingFallbackChild = new EventEmitter();
      failingFallbackChild.stdout = new EventEmitter();
      failingFallbackChild.stderr = new EventEmitter();
      flatPlaylistSpawn
        .mockReturnValueOnce(failingChild)
        .mockReturnValueOnce(failingFallbackChild);
      const failing = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      failingChild.emit('close', 1);
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      failingFallbackChild.emit('close', 1);
      await expect(failing).rejects.toThrow('NETWORK_ERROR');

      const retryChild = new EventEmitter();
      retryChild.stdout = new EventEmitter();
      retryChild.stderr = new EventEmitter();
      flatPlaylistSpawn.mockReturnValue(retryChild);
      const retry = playlistModule.fetchAllPlaylistVideos('PLabc');
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      // A non-empty result avoids triggering the InnerTube fallback; this
      // test only cares about the in-progress guard clearing.
      retryChild.stdout.emit('data', JSON.stringify({ id: 'v1', title: 'Video 1' }) + '\n');
      retryChild.emit('close', 0);
      await retry;

      expect(flatPlaylistSpawn).toHaveBeenCalledTimes(3);
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

  describe('backfillDownloadedVideoChannels', () => {
    test('backfills channel_id on playlist rows from the downloaded video metadata', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: null },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCreal' }]);
      Playlist.findAll.mockResolvedValue([]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCreal', youTubeChannelName: 'Real Ch' },
      ]);

      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { channel_id: 'UCreal' },
        { where: { youtube_id: 'v1', channel_id: null } }
      );
    });

    test('auto-creates a hidden channel seeded from playlist settings when the channel is untracked', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: null },
      ]);
      Channel.findAll.mockResolvedValue([]);
      Playlist.findAll.mockResolvedValue([
        { playlist_id: 'PL1', default_sub_folder: 'Library1', video_quality: '1080' },
      ]);
      channelModule.upsertChannel.mockResolvedValue({ id: 5, channel_id: 'UCnew' });

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCnew', youTubeChannelName: 'Marvelous Videos' },
      ]);

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'UCnew', uploader: 'Marvelous Videos' }),
        false,
        null,
        expect.objectContaining({ sub_folder: 'Library1', video_quality: '1080' })
      );
      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { channel_id: 'UCnew' },
        { where: { youtube_id: 'v1', channel_id: null } }
      );
    });

    test('does not create a channel that is already tracked', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: null },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCtracked' }]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCtracked', youTubeChannelName: 'Tracked Ch' },
      ]);

      expect(channelModule.upsertChannel).not.toHaveBeenCalled();
    });

    test('creates an untracked channel only once when it owns several downloaded videos', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: null },
        { playlist_id: 'PL1', youtube_id: 'v2', channel_id: null },
      ]);
      Channel.findAll.mockResolvedValue([]);
      Playlist.findAll.mockResolvedValue([
        { playlist_id: 'PL1', default_sub_folder: 'Library1', video_quality: '1080' },
      ]);
      channelModule.upsertChannel.mockResolvedValue({ id: 5, channel_id: 'UCnew' });

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCnew', youTubeChannelName: 'Marvelous Videos' },
        { youtubeId: 'v2', channel_id: 'UCnew', youTubeChannelName: 'Marvelous Videos' },
      ]);

      expect(channelModule.upsertChannel).toHaveBeenCalledTimes(1);
    });

    test('skips downloaded videos that are not part of any playlist', async () => {
      PlaylistVideo.findAll.mockResolvedValue([]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCnew', youTubeChannelName: 'X' },
      ]);

      expect(PlaylistVideo.update).not.toHaveBeenCalled();
      expect(channelModule.upsertChannel).not.toHaveBeenCalled();
    });

    test('stamps downloaded_at but skips channel work for downloaded videos that have no channel_id', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: 'UCowner', downloaded_at: null },
      ]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: null, youTubeChannelName: 'X' },
      ]);

      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { downloaded_at: expect.any(Date) },
        { where: { youtube_id: 'v1' } }
      );
      expect(channelModule.upsertChannel).not.toHaveBeenCalled();
    });

    test('does nothing for empty input', async () => {
      await playlistModule.backfillDownloadedVideoChannels([]);

      expect(PlaylistVideo.findAll).not.toHaveBeenCalled();
    });

    test('does not rewrite channel_id that is already correct', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: 'UCreal', downloaded_at: new Date() },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCreal' }]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCreal', youTubeChannelName: 'Real Ch' },
      ]);

      expect(PlaylistVideo.update).not.toHaveBeenCalled();
    });

    test('does not overwrite or create a channel when channel_id is already set, even if the downloaded id differs', async () => {
      // Playlist sync captured the owner channel; the .info.json reports the
      // auto-generated upload channel (VEVO/Topic). The stored owner id wins, so
      // no overwrite and no new channel.
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: 'UCowner', downloaded_at: new Date() },
      ]);
      Channel.findAll.mockResolvedValue([]);
      Playlist.findAll.mockResolvedValue([
        { playlist_id: 'PL1', default_sub_folder: 'Library1', video_quality: '1080' },
      ]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCupload', youTubeChannelName: 'Artist - Topic' },
      ]);

      expect(PlaylistVideo.update).not.toHaveBeenCalled();
      expect(channelModule.upsertChannel).not.toHaveBeenCalled();
    });

    test('stamps downloaded_at with the provided download time when a row is stale', async () => {
      const downloadedAt = new Date('2026-01-05T10:00:00.000Z');
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: 'UCreal', downloaded_at: new Date('2026-06-01T00:00:00.000Z') },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCreal' }]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCreal', youTubeChannelName: 'Real Ch', downloadedAt },
      ]);

      expect(PlaylistVideo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { youtube_id: ['v1'] } })
      );
      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { downloaded_at: downloadedAt },
        { where: { youtube_id: 'v1' } }
      );
    });

    test('does not rewrite a downloaded_at that already matches the download time', async () => {
      const downloadedAt = new Date('2026-01-05T10:00:00.000Z');
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: 'UCreal', downloaded_at: new Date(downloadedAt) },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCreal' }]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCreal', youTubeChannelName: 'Real Ch', downloadedAt },
      ]);

      expect(PlaylistVideo.update).not.toHaveBeenCalled();
    });

    test('leaves downloaded_at alone when the caller reports no reliable download time', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PL1', youtube_id: 'v1', channel_id: 'UCreal', downloaded_at: null },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCreal' }]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCreal', youTubeChannelName: 'Real Ch', downloadedAt: null },
      ]);

      expect(PlaylistVideo.update).not.toHaveBeenCalled();
    });

    test('does not seed a hidden channel from a soft-deleted owning playlist', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PLdeleted', youtube_id: 'v1', channel_id: null, downloaded_at: new Date() },
      ]);
      Channel.findAll.mockResolvedValue([]);
      // The enabled-only lookup finds no candidate playlists.
      Playlist.findAll.mockResolvedValue([]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCnew', youTubeChannelName: 'New Ch' },
      ]);

      expect(Playlist.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ enabled: true }) })
      );
      // channel_id is still filled on the soft-deleted playlist's row...
      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { channel_id: 'UCnew' },
        { where: { youtube_id: 'v1', channel_id: null } }
      );
      // ...but no hidden channel is created with the deleted playlist's settings.
      expect(channelModule.upsertChannel).not.toHaveBeenCalled();
    });

    test('seeds from an enabled owning playlist when the first owning row is soft-deleted', async () => {
      PlaylistVideo.findAll.mockResolvedValue([
        { playlist_id: 'PLdeleted', youtube_id: 'v1', channel_id: null, downloaded_at: new Date() },
        { playlist_id: 'PLlive', youtube_id: 'v1', channel_id: null, downloaded_at: new Date() },
      ]);
      Channel.findAll.mockResolvedValue([]);
      Playlist.findAll.mockResolvedValue([
        { playlist_id: 'PLlive', default_sub_folder: 'LiveFolder', video_quality: '720' },
      ]);

      await playlistModule.backfillDownloadedVideoChannels([
        { youtubeId: 'v1', channel_id: 'UCnew', youTubeChannelName: 'New Ch' },
      ]);

      expect(channelModule.upsertChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'UCnew' }),
        false,
        null,
        expect.objectContaining({ sub_folder: 'LiveFolder', video_quality: '720' })
      );
    });
  });

  describe('backfillFromDownloadedVideos', () => {
    test('reconciles tracked rows against already-downloaded videos', async () => {
      const downloadedAt = new Date('2026-02-10T08:00:00.000Z');
      PlaylistVideo.findAll
        // id scan for the playlist being reconciled
        .mockResolvedValueOnce([{ youtube_id: 'v1' }, { youtube_id: 'v2' }])
        // rows matched inside backfillDownloadedVideoChannels
        .mockResolvedValueOnce([
          { playlist_id: 'PL1', youtube_id: 'v1', channel_id: null, downloaded_at: null },
        ]);
      db.sequelize.query.mockResolvedValue([
        { youtubeId: 'v1', channel_id: 'UCa', youTubeChannelName: 'A', downloadedAt },
      ]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UCa' }]);

      await playlistModule.backfillFromDownloadedVideos('PL1');

      expect(PlaylistVideo.findAll).toHaveBeenNthCalledWith(1,
        expect.objectContaining({ where: { playlist_id: 'PL1' } })
      );
      expect(db.sequelize.query).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE'),
        expect.objectContaining({ replacements: { youtubeIds: ['v1', 'v2'] } })
      );
      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { downloaded_at: downloadedAt },
        { where: { youtube_id: 'v1' } }
      );
      expect(PlaylistVideo.update).toHaveBeenCalledWith(
        { channel_id: 'UCa' },
        { where: { youtube_id: 'v1', channel_id: null } }
      );
    });

    test('skips the Videos lookup when the playlist has no tracked rows', async () => {
      PlaylistVideo.findAll.mockResolvedValueOnce([]);

      await playlistModule.backfillFromDownloadedVideos('PL1');

      expect(db.sequelize.query).not.toHaveBeenCalled();
    });

    test('no-ops when none of the tracked videos have been downloaded', async () => {
      PlaylistVideo.findAll.mockResolvedValueOnce([{ youtube_id: 'v1' }]);
      db.sequelize.query.mockResolvedValue([]);

      await playlistModule.backfillFromDownloadedVideos('PL1');

      expect(PlaylistVideo.update).not.toHaveBeenCalled();
      expect(PlaylistVideo.findAll).toHaveBeenCalledTimes(1);
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

    test('creates one Complete "Playlist Downloads" job when auto-enabled playlists exist and nothing was enqueued', async () => {
      const pl1 = { playlist_id: 'PL1', title: 'One' };
      const pl2 = { playlist_id: 'PL2', title: 'Two' };
      Playlist.findAll.mockResolvedValue([pl1, pl2]);
      downloadModule.doPlaylistDownloads.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      await playlistModule.playlistAutoDownload();

      expect(jobModule.addJob).toHaveBeenCalledTimes(1);
      expect(jobModule.addJob).toHaveBeenCalledWith({
        jobType: 'Playlist Downloads',
        status: 'Complete',
        output: '',
        data: { videos: [] },
      });
    });

    test('does not create a job when any playlist enqueued videos', async () => {
      const pl1 = { playlist_id: 'PL1', title: 'One' };
      const pl2 = { playlist_id: 'PL2', title: 'Two' };
      Playlist.findAll.mockResolvedValue([pl1, pl2]);
      downloadModule.doPlaylistDownloads.mockResolvedValueOnce(0).mockResolvedValueOnce(3);

      await playlistModule.playlistAutoDownload();

      expect(jobModule.addJob).not.toHaveBeenCalled();
    });

    test('does not create a job when there are no auto-enabled playlists', async () => {
      Playlist.findAll.mockResolvedValue([]);

      await playlistModule.playlistAutoDownload();

      expect(downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
      expect(jobModule.addJob).not.toHaveBeenCalled();
    });

    test('does not create a job when a playlist download errors, but other playlists still run', async () => {
      const pl1 = { playlist_id: 'PL1', title: 'One' };
      const pl2 = { playlist_id: 'PL2', title: 'Two' };
      Playlist.findAll.mockResolvedValue([pl1, pl2]);
      downloadModule.doPlaylistDownloads
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(0);

      await playlistModule.playlistAutoDownload();

      expect(downloadModule.doPlaylistDownloads).toHaveBeenCalledTimes(2);
      expect(jobModule.addJob).not.toHaveBeenCalled();
    });
  });

  describe('fetchAllPlaylistVideos published_at backfill', () => {
    function mockFlatPlaylist(entries) {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      flatPlaylistSpawn.mockReturnValue(child);
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
