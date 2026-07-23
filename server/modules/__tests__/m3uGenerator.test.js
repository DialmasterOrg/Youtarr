jest.mock('fs');
jest.mock('../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../models', () => ({
  Playlist: { findByPk: jest.fn() },
  PlaylistVideo: { findAll: jest.fn() },
  Video: { findOne: jest.fn(), findAll: jest.fn() },
  Channel: { findOne: jest.fn(), findAll: jest.fn() },
}));
jest.mock('../filesystem/sanitizer', () => ({
  sanitizeNameLikeYtDlp: jest.fn((s) => s.replace(/[^a-zA-Z0-9-_ ]/g, '_')),
}));
jest.mock('../configModule', () => ({
  directoryPath: '/youtube',
  getDefaultSubfolder: jest.fn().mockReturnValue(null),
}));

describe('m3uGenerator', () => {
  let m3uGenerator;
  let fs;
  let Playlist, PlaylistVideo, Video, Channel;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('fs', () => ({
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
      existsSync: jest.fn().mockReturnValue(true),
      unlinkSync: jest.fn(),
      renameSync: jest.fn(),
      promises: {
        access: jest.fn().mockResolvedValue(undefined),
      },
    }));
    jest.doMock('../../models', () => ({
      Playlist: { findByPk: jest.fn() },
      PlaylistVideo: { findAll: jest.fn() },
      Video: { findOne: jest.fn(), findAll: jest.fn() },
      Channel: { findOne: jest.fn(), findAll: jest.fn() },
    }));
    jest.doMock('../filesystem/sanitizer', () => ({
      sanitizeNameLikeYtDlp: jest.fn((s) => s.replace(/[^a-zA-Z0-9-_ ]/g, '_')),
    }));
    jest.doMock('../configModule', () => ({
      directoryPath: '/youtube',
      getDefaultSubfolder: jest.fn().mockReturnValue(null),
    }));
    jest.doMock('../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    fs = require('fs');
    ({ Playlist, PlaylistVideo, Video, Channel } = require('../../models'));
    m3uGenerator = require('../m3uGenerator');
  });

  test('writes M3U with relative paths ordered by position, skipping un-downloaded entries', async () => {
    Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'My PL' });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'v1', position: 1, ignored: false },
      { youtube_id: 'v2', position: 2, ignored: false },
      { youtube_id: 'v3', position: 3, ignored: false },
    ]);
    Video.findOne.mockImplementation(({ where }) => {
      const key = where.youtubeId;
      if (key === 'v1') return Promise.resolve({ filePath: '/youtube/ChanA/Video 1/v1.mp4', duration: 120, youTubeVideoName: 'Video 1', youTubeChannelName: 'ChanA' });
      if (key === 'v3') return Promise.resolve({ filePath: '/youtube/ChanC/Video 3/v3.mp4', duration: 60, youTubeVideoName: 'Video 3', youTubeChannelName: 'ChanC' });
      return Promise.resolve(null);
    });

    const result = await m3uGenerator.generatePlaylistM3U(1);

    expect(result).toBe(true);
    expect(fs.mkdirSync).toHaveBeenCalledWith('/youtube/__playlists__', expect.any(Object));
    const writeCall = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u'));
    const filePath = writeCall[0];
    const contents = writeCall[1];
    expect(filePath).toBe('/youtube/__playlists__/My PL.m3u');
    expect(contents).toContain('#EXTM3U');
    expect(contents).toContain('#PLAYLIST:My PL');
    expect(contents).toMatch(/#EXTINF:120,ChanA - Video 1/);
    expect(contents).toMatch(/\n\.\.\/ChanA\/Video 1\/v1\.mp4/);
    expect(contents).not.toContain('v2'); // skipped — not downloaded
    expect(contents).toMatch(/\n\.\.\/ChanC\/Video 3\/v3\.mp4/);
  });

  test('writes a .ignore marker so Jellyfin/Emby skip the playlists folder', async () => {
    Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'My PL' });
    PlaylistVideo.findAll.mockResolvedValue([]);

    await m3uGenerator.generatePlaylistM3U(1);

    expect(fs.writeFileSync).toHaveBeenCalledWith('/youtube/__playlists__/.ignore', '', 'utf8');
  });

  test('returns false when playlist not found', async () => {
    Playlist.findByPk.mockResolvedValue(null);
    const result = await m3uGenerator.generatePlaylistM3U(9999);
    expect(result).toBe(false);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test('filters out ignored videos', async () => {
    Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'PL' });
    PlaylistVideo.findAll.mockResolvedValue([]);
    const result = await m3uGenerator.generatePlaylistM3U(1);
    expect(result).toBe(true);
    // Verify findAll was called with ignored: false in the where clause
    expect(PlaylistVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ignored: false }),
      order: [['position', 'ASC']],
    }));
  });

  test('includes audio-only entries via audioFilePath and prefers filePath when both exist', async () => {
    Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'Audio PL' });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'a1', position: 1, ignored: false },
      { youtube_id: 'a2', position: 2, ignored: false },
    ]);
    Video.findOne.mockImplementation(({ where }) => {
      const key = where.youtubeId;
      if (key === 'a1') return Promise.resolve({ filePath: null, audioFilePath: '/youtube/ChanA/Song 1/a1.mp3', duration: 200, youTubeVideoName: 'Song 1', youTubeChannelName: 'ChanA' });
      if (key === 'a2') return Promise.resolve({ filePath: '/youtube/ChanB/Vid 2/a2.mp4', audioFilePath: '/youtube/ChanB/Vid 2/a2.mp3', duration: 100, youTubeVideoName: 'Vid 2', youTubeChannelName: 'ChanB' });
      return Promise.resolve(null);
    });

    const result = await m3uGenerator.generatePlaylistM3U(1);

    expect(result).toBe(true);
    const writeCall = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u'));
    const contents = writeCall[1];
    expect(contents).toMatch(/\n\.\.\/ChanA\/Song 1\/a1\.mp3/);
    expect(contents).toMatch(/\n\.\.\/ChanB\/Vid 2\/a2\.mp4/);
    expect(contents).not.toContain('a2.mp3');
  });

  test('MP3 Only playlist prefers the mp3 when both files exist, keeping video-only items as fallback', async () => {
    Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'Audio PL', audio_format: 'mp3_only' });
    PlaylistVideo.findAll.mockResolvedValue([
      { youtube_id: 'b1', position: 1, ignored: false },
      { youtube_id: 'v1', position: 2, ignored: false },
    ]);
    Video.findOne.mockImplementation(({ where }) => {
      const key = where.youtubeId;
      if (key === 'b1') return Promise.resolve({ filePath: '/youtube/ChanA/Both 1/b1.mp4', audioFilePath: '/youtube/ChanA/Both 1/b1.mp3', duration: 200, youTubeVideoName: 'Both 1', youTubeChannelName: 'ChanA' });
      if (key === 'v1') return Promise.resolve({ filePath: '/youtube/ChanB/Vid 1/v1.mp4', audioFilePath: null, duration: 100, youTubeVideoName: 'Vid 1', youTubeChannelName: 'ChanB' });
      return Promise.resolve(null);
    });

    const result = await m3uGenerator.generatePlaylistM3U(1);

    expect(result).toBe(true);
    const writeCall = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u'));
    const contents = writeCall[1];
    expect(contents).toMatch(/\n\.\.\/ChanA\/Both 1\/b1\.mp3/);
    expect(contents).not.toContain('b1.mp4');
    // No mp3 for v1, but the .m3u never drops a downloaded item.
    expect(contents).toMatch(/\n\.\.\/ChanB\/Vid 1\/v1\.mp4/);
  });

  test('reversed sort order queries positions descending', async () => {
    Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'PL', sort_order: 'reversed' });
    PlaylistVideo.findAll.mockResolvedValue([]);

    await m3uGenerator.generatePlaylistM3U(1);

    expect(PlaylistVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      order: [['position', 'DESC']],
    }));
  });

  describe('generateChannelM3U', () => {
    const baseChannel = {
      channel_id: 'UC1',
      title: 'Chan A',
      uploader: 'Chan A',
      folder_name: 'Chan A',
      sub_folder: null,
      audio_format: null,
      enabled: true,
      m3u_enabled: true,
      m3u_sort_order: 'oldest_first',
    };

    test('writes channel m3u with relative paths, oldest first', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel });
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/Chan A/Video 1/v1.mp4', duration: 120, youTubeVideoName: 'Video 1' },
        { youtubeId: 'v2', filePath: '/youtube/Chan A/Video 2/v2.mp4', duration: 60, youTubeVideoName: 'Video 2' },
      ]);

      const result = await m3uGenerator.generateChannelM3U('UC1');

      expect(result).toBe(true);
      expect(Video.findAll).toHaveBeenCalledWith({
        where: { channel_id: 'UC1', removed: false },
        attributes: ['youtubeId', 'filePath', 'audioFilePath', 'duration', 'youTubeVideoName'],
        order: [['originalDate', 'ASC'], ['id', 'ASC']],
      });
      const writeCall = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u.tmp'));
      expect(writeCall[0]).toBe('/youtube/Chan A/Chan A.m3u.tmp');
      expect(fs.renameSync).toHaveBeenCalledWith('/youtube/Chan A/Chan A.m3u.tmp', '/youtube/Chan A/Chan A.m3u');
      const contents = writeCall[1];
      expect(contents).toContain('#EXTM3U');
      expect(contents).toContain('#PLAYLIST:Chan A');
      expect(contents).toMatch(/#EXTINF:120,Video 1/);
      expect(contents).toMatch(/\nVideo 1\/v1\.mp4/);
      expect(contents).toMatch(/\nVideo 2\/v2\.mp4/);
    });

    test('newest_first queries originalDate descending', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel, m3u_sort_order: 'newest_first' });
      Video.findAll.mockResolvedValue([]);

      await m3uGenerator.generateChannelM3U('UC1');

      expect(Video.findAll).toHaveBeenCalledWith(expect.objectContaining({
        order: [['originalDate', 'DESC'], ['id', 'DESC']],
      }));
    });

    test('places the m3u inside the subfolder channel path', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel, sub_folder: 'Kids' });
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/__Kids/Chan A/Video 1/v1.mp4', duration: 10, youTubeVideoName: 'Video 1' },
      ]);

      await m3uGenerator.generateChannelM3U('UC1');

      const writeCall = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u.tmp'));
      expect(writeCall[0]).toBe('/youtube/__Kids/Chan A/Chan A.m3u.tmp');
      expect(fs.renameSync).toHaveBeenCalledWith('/youtube/__Kids/Chan A/Chan A.m3u.tmp', '/youtube/__Kids/Chan A/Chan A.m3u');
    });

    test('returns false without writing when channel missing, disabled, or m3u disabled', async () => {
      Channel.findOne.mockResolvedValueOnce(null);
      expect(await m3uGenerator.generateChannelM3U('UCx')).toBe(false);

      Channel.findOne.mockResolvedValueOnce({ ...baseChannel, enabled: false });
      expect(await m3uGenerator.generateChannelM3U('UC1')).toBe(false);

      Channel.findOne.mockResolvedValueOnce({ ...baseChannel, m3u_enabled: false });
      expect(await m3uGenerator.generateChannelM3U('UC1')).toBe(false);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('mp3_only channel prefers audioFilePath with filePath fallback', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel, audio_format: 'mp3_only' });
      Video.findAll.mockResolvedValue([
        { youtubeId: 'b1', filePath: '/youtube/Chan A/Both/b1.mp4', audioFilePath: '/youtube/Chan A/Both/b1.mp3', duration: 10, youTubeVideoName: 'Both' },
        { youtubeId: 'v1', filePath: '/youtube/Chan A/VidOnly/v1.mp4', audioFilePath: null, duration: 10, youTubeVideoName: 'VidOnly' },
      ]);

      await m3uGenerator.generateChannelM3U('UC1');

      const contents = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u.tmp'))[1];
      expect(contents).toMatch(/\nBoth\/b1\.mp3/);
      expect(contents).not.toContain('b1.mp4');
      expect(contents).toMatch(/\nVidOnly\/v1\.mp4/);
    });

    test('skips entries whose file is missing on disk', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel });
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/Chan A/Video 1/v1.mp4', duration: 10, youTubeVideoName: 'Video 1' },
        { youtubeId: 'v2', filePath: '/youtube/Chan A/Video 2/v2.mp4', duration: 10, youTubeVideoName: 'Video 2' },
      ]);
      fs.promises.access.mockImplementation((p) =>
        String(p).includes('v2.mp4') ? Promise.reject(new Error('ENOENT')) : Promise.resolve()
      );

      await m3uGenerator.generateChannelM3U('UC1');

      const contents = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u.tmp'))[1];
      expect(contents).toContain('v1.mp4');
      expect(contents).not.toContain('v2.mp4');
    });

    test('zero includable entries deletes stale m3u and does not write or mkdir', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel });
      Video.findAll.mockResolvedValue([]);
      fs.existsSync.mockReturnValue(true);

      const result = await m3uGenerator.generateChannelM3U('UC1');

      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith('/youtube/Chan A/Chan A.m3u');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    test('never writes a .ignore file for channel m3u', async () => {
      Channel.findOne.mockResolvedValue({ ...baseChannel });
      Video.findAll.mockResolvedValue([
        { youtubeId: 'v1', filePath: '/youtube/Chan A/Video 1/v1.mp4', duration: 10, youTubeVideoName: 'Video 1' },
      ]);

      await m3uGenerator.generateChannelM3U('UC1');

      const ignoreCall = fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.ignore'));
      expect(ignoreCall).toBeUndefined();
    });
  });

  describe('deleteChannelM3U', () => {
    test('unlinks an existing channel m3u', async () => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UC1', folder_name: 'Chan A', uploader: 'Chan A', sub_folder: null,
      });
      fs.existsSync.mockReturnValue(true);

      const result = await m3uGenerator.deleteChannelM3U('UC1');

      expect(result).toBe(true);
      expect(fs.unlinkSync).toHaveBeenCalledWith('/youtube/Chan A/Chan A.m3u');
    });

    test('is a no-op success when the file does not exist', async () => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UC1', folder_name: 'Chan A', uploader: 'Chan A', sub_folder: null,
      });
      fs.existsSync.mockReturnValue(false);

      const result = await m3uGenerator.deleteChannelM3U('UC1');

      expect(result).toBe(true);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test('returns false when channel not found', async () => {
      Channel.findOne.mockResolvedValue(null);
      expect(await m3uGenerator.deleteChannelM3U('UCx')).toBe(false);
    });
  });

  describe('regenerateAllChannelM3Us', () => {
    test('generates for every enabled channel with m3u enabled and reports counts', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: 'UC1' },
        { channel_id: 'UC2' },
      ]);
      const spy = jest.spyOn(m3uGenerator, 'generateChannelM3U')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await m3uGenerator.regenerateAllChannelM3Us();

      expect(Channel.findAll).toHaveBeenCalledWith({
        where: { m3u_enabled: true, enabled: true },
      });
      expect(spy).toHaveBeenCalledWith('UC1');
      expect(spy).toHaveBeenCalledWith('UC2');
      expect(result).toEqual({ attempted: 2, succeeded: 1 });
    });

    test('returns zero counts on query failure without throwing', async () => {
      Channel.findAll.mockRejectedValue(new Error('db down'));
      const result = await m3uGenerator.regenerateAllChannelM3Us();
      expect(result).toEqual({ attempted: 0, succeeded: 0 });
    });
  });

  describe('background wrappers', () => {
    test('generateChannelM3UInBackground delegates to generateChannelM3U', () => {
      const spy = jest.spyOn(m3uGenerator, 'generateChannelM3U').mockResolvedValue(true);

      m3uGenerator.generateChannelM3UInBackground('UC1', 'test-context');

      expect(spy).toHaveBeenCalledWith('UC1');
    });

    test('generateChannelM3UInBackground logs a rejection instead of throwing', async () => {
      jest.spyOn(m3uGenerator, 'generateChannelM3U').mockRejectedValue(new Error('boom'));
      const logger = require('../../logger');

      m3uGenerator.generateChannelM3UInBackground('UC1', 'test-context');
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC1', context: 'test-context' }),
        expect.any(String)
      );
    });

    test('deleteChannelM3UInBackground logs a rejection instead of throwing', async () => {
      jest.spyOn(m3uGenerator, 'deleteChannelM3U').mockRejectedValue(new Error('boom'));
      const logger = require('../../logger');

      m3uGenerator.deleteChannelM3UInBackground('UC1', 'test-context');
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'UC1', context: 'test-context' }),
        expect.any(String)
      );
    });
  });
});
