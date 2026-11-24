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
      // Existing files read as ones Youtarr did not generate unless a test says otherwise.
      readFileSync: jest.fn().mockReturnValue('#EXTM3U\n'),
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

  describe('removed videos', () => {
    const rowFor = (id, removal) => ({
      filePath: `/youtube/Chan/${id}/${id}.mp4`, duration: 60, youTubeVideoName: id, youTubeChannelName: 'Chan', ...removal,
    });

    const contentsFor = async (removal) => {
      Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'PL' });
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'v1', position: 1, ignored: false }]);
      Video.findOne.mockResolvedValue(rowFor('v1', removal));
      await m3uGenerator.generatePlaylistM3U(1);
      return fs.writeFileSync.mock.calls.find((c) => String(c[0]).endsWith('.m3u'))[1];
    };

    test('leaves out a video whose file was deleted', async () => {
      expect(await contentsFor({ removed: true, removed_reason: 'user_deleted' })).not.toContain('v1.mp4');
    });

    test('leaves out a video removed before its reason was recorded', async () => {
      expect(await contentsFor({ removed: true, removed_reason: null })).not.toContain('v1.mp4');
    });

    test('keeps a missing video, whose file may come back', async () => {
      expect(await contentsFor({ removed: true, removed_reason: 'not_found' })).toContain('v1.mp4');
    });
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

  describe('Video + MP3 playlist', () => {
    const MAIN_PATH = '/youtube/__playlists__/My PL.m3u';
    const MP3_PATH = '/youtube/__playlists__/My PL (MP3).m3u';
    const rows = {
      both: { filePath: '/youtube/Chan/Both/both.mp4', audioFilePath: '/youtube/Chan/Both/both.mp3', duration: 10, youTubeVideoName: 'Both', youTubeChannelName: 'Chan' },
      vid: { filePath: '/youtube/Chan/Vid/vid.mp4', audioFilePath: null, duration: 20, youTubeVideoName: 'Vid', youTubeChannelName: 'Chan' },
      aud: { filePath: null, audioFilePath: '/youtube/Chan/Aud/aud.mp3', duration: 30, youTubeVideoName: 'Aud', youTubeChannelName: 'Chan' },
    };

    const generate = async ({ audioFormat = 'video_mp3', ids = ['both', 'vid', 'aud'], overrides = {} } = {}) => {
      Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'My PL', audio_format: audioFormat });
      PlaylistVideo.findAll.mockResolvedValue(ids.map((id, i) => ({ youtube_id: id, position: i + 1, ignored: false })));
      Video.findOne.mockImplementation(({ where }) => Promise.resolve(
        rows[where.youtubeId] ? { ...rows[where.youtubeId], ...overrides[where.youtubeId] } : null
      ));
      return m3uGenerator.generatePlaylistM3U(1);
    };

    const written = (filePath) => {
      const call = fs.writeFileSync.mock.calls.find((c) => c[0] === filePath);
      return call ? call[1] : null;
    };

    test('lists only items with a video file in the main list', async () => {
      await generate();

      const main = written(MAIN_PATH);
      expect(main).toContain('both.mp4');
      expect(main).toContain('vid.mp4');
      expect(main).not.toContain('.mp3');
    });

    const OWN_MP3_LIST = '#EXTM3U\n#PLAYLIST:My PL (MP3)\n#YOUTARR-MP3-LIST:playlist:PL1\n#EXTINF:1,x\nx.mp3\n';

    // What sits at the MP3 list's path: null for nothing, else the file's contents.
    const mp3ListOnDisk = (contents) => {
      fs.existsSync.mockImplementation((p) => p !== MP3_PATH || contents !== null);
      fs.readFileSync.mockImplementation((p) => (p === MP3_PATH ? contents : '#EXTM3U\n'));
    };

    beforeEach(() => mp3ListOnDisk(null));

    describe('when a playlist really titled like the MP3 list is subscribed afterwards', () => {
      let disk;

      beforeEach(() => {
        // The real sanitizer keeps parentheses; the file-level mock does not.
        require('../filesystem/sanitizer').sanitizeNameLikeYtDlp.mockImplementation((s) => s);
        disk = new Map();
        fs.existsSync.mockImplementation((p) => disk.has(p));
        fs.readFileSync.mockImplementation((p) => disk.get(p));
        fs.writeFileSync.mockImplementation((p, contents) => disk.set(p, contents));
        fs.unlinkSync.mockImplementation((p) => disk.delete(p));
      });

      const generateOther = (title) => {
        Playlist.findByPk.mockResolvedValue({ id: 2, playlist_id: 'PL2', title, audio_format: null });
        PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'vid', position: 1, ignored: false }]);
        Video.findOne.mockResolvedValue(rows.vid);
        return m3uGenerator.generatePlaylistM3U(2);
      };

      test('its main list does not replace the first playlist\'s MP3 list', async () => {
        await generate();
        const firstPlaylistsMp3List = disk.get(MP3_PATH);

        const result = await generateOther('My PL (MP3)');

        expect(result).toBe(false);
        expect(disk.get(MP3_PATH)).toBe(firstPlaylistsMp3List);
        expect(disk.get(MP3_PATH)).toContain('#YOUTARR-MP3-LIST:playlist:PL1');
      });

      test('its main list is written once the first playlist no longer has an MP3 list', async () => {
        await generate();
        await generate({ audioFormat: null });

        const result = await generateOther('My PL (MP3)');

        expect(result).toBe(true);
        expect(disk.get(MP3_PATH)).toContain('#PLAYLIST:My PL (MP3)');
        expect(disk.get(MP3_PATH)).toContain('vid.mp4');
        expect(disk.get(MP3_PATH)).not.toContain('#YOUTARR-MP3-LIST');
      });
    });

    test('writes its main list over its own leftover MP3 list after being retitled to that name', async () => {
      require('../filesystem/sanitizer').sanitizeNameLikeYtDlp.mockImplementation((s) => s);
      mp3ListOnDisk(OWN_MP3_LIST);
      Playlist.findByPk.mockResolvedValue({ id: 1, playlist_id: 'PL1', title: 'My PL (MP3)', audio_format: null });
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'vid', position: 1, ignored: false }]);
      Video.findOne.mockResolvedValue(rows.vid);

      const result = await m3uGenerator.generatePlaylistM3U(1);

      expect(result).toBe(true);
      expect(written(MP3_PATH)).toContain('vid.mp4');
    });

    test('lists only items with an mp3 in a separate (MP3) list', async () => {
      await generate();

      const mp3 = written(MP3_PATH);
      expect(mp3).toContain('#EXTM3U');
      expect(mp3).toContain('#PLAYLIST:My PL (MP3)');
      expect(mp3).toMatch(/#EXTINF:10,Chan - Both\n\.\.\/Chan\/Both\/both\.mp3/);
      expect(mp3).toMatch(/#EXTINF:30,Chan - Aud\n\.\.\/Chan\/Aud\/aud\.mp3/);
      expect(mp3).not.toContain('.mp4');
    });

    test('marks the MP3 list as generated for this playlist', async () => {
      await generate();

      expect(written(MP3_PATH).split('\n')).toContain('#YOUTARR-MP3-LIST:playlist:PL1');
      expect(written(MAIN_PATH)).not.toContain('#YOUTARR-MP3-LIST');
    });

    test('rewrites the MP3 list it generated earlier', async () => {
      mp3ListOnDisk(OWN_MP3_LIST);

      await generate();

      expect(written(MP3_PATH)).toContain('both.mp3');
    });

    test('writes no MP3 list and removes its stale one when no item has an mp3', async () => {
      mp3ListOnDisk(OWN_MP3_LIST);

      await generate({ ids: ['vid'] });

      expect(written(MP3_PATH)).toBeNull();
      expect(fs.unlinkSync).toHaveBeenCalledWith(MP3_PATH);
    });

    test('leaves a deleted video out of the MP3 list', async () => {
      await generate({ overrides: { aud: { removed: true, removed_reason: 'user_deleted' } } });

      const mp3 = written(MP3_PATH);
      expect(mp3).toContain('both.mp3');
      expect(mp3).not.toContain('aud.mp3');
    });

    test.each([[null], ['mp3_only']])('audio_format %s removes its stale MP3 list', async (audioFormat) => {
      mp3ListOnDisk(OWN_MP3_LIST);

      await generate({ audioFormat });

      expect(written(MP3_PATH)).toBeNull();
      expect(fs.unlinkSync).toHaveBeenCalledWith(MP3_PATH);
    });

    // A file at that path Youtarr did not generate for this playlist: a
    // hand-made one, another playlist's main list (a playlist really titled
    // "My PL (MP3)", or the same name under a case-folding mount), or the MP3
    // list of another playlist whose title sanitizes to the same name.
    describe.each([
      ['a file without a marker', '#EXTM3U\n#PLAYLIST:My PL (MP3)\n#EXTINF:1,mine\nmine.mp3\n'],
      ['another playlist\'s MP3 list', '#EXTM3U\n#PLAYLIST:My PL (MP3)\n#YOUTARR-MP3-LIST:playlist:PL2\n'],
      ['a channel\'s MP3 list with the same id text', '#EXTM3U\n#PLAYLIST:My PL (MP3)\n#YOUTARR-MP3-LIST:channel:PL1\n'],
    ])('when the MP3 list path holds %s', (_label, contents) => {
      beforeEach(() => mp3ListOnDisk(contents));

      test('does not overwrite it, and still writes the main list', async () => {
        const result = await generate();

        expect(result).toBe(true);
        expect(written(MAIN_PATH)).toContain('both.mp4');
        expect(written(MP3_PATH)).toBeNull();
        expect(fs.unlinkSync).not.toHaveBeenCalled();
      });

      test.each([[null], ['mp3_only'], ['video_mp3']])('does not remove it (audio_format %s, no mp3s)', async (audioFormat) => {
        await generate({ audioFormat, ids: ['vid'] });

        expect(fs.unlinkSync).not.toHaveBeenCalled();
      });
    });

    test('a rebuild requested while another runs waits for it and reads the settings afterwards', async () => {
      // The first rebuild read Video + MP3 and is stuck on a slow lookup when
      // the Download Type changes to Video Only and a second rebuild is asked for.
      let releaseSlowLookup;
      const slowLookup = new Promise((resolve) => { releaseSlowLookup = () => resolve(rows.both); });
      Playlist.findByPk
        .mockResolvedValueOnce({ id: 1, playlist_id: 'PL1', title: 'My PL', audio_format: 'video_mp3' })
        .mockResolvedValueOnce({ id: 1, playlist_id: 'PL1', title: 'My PL', audio_format: null });
      PlaylistVideo.findAll.mockResolvedValue([{ youtube_id: 'both', position: 1, ignored: false }]);
      Video.findOne.mockReturnValueOnce(slowLookup).mockResolvedValue(rows.both);
      // Once the first rebuild writes the MP3 list, it is on disk as this playlist's own.
      fs.writeFileSync.mockImplementation((p, contents) => {
        if (p === MP3_PATH) mp3ListOnDisk(contents);
      });
      fs.unlinkSync.mockImplementation((p) => {
        if (p === MP3_PATH) mp3ListOnDisk(null);
      });

      const first = m3uGenerator.generatePlaylistM3U(1);
      const second = m3uGenerator.generatePlaylistM3U(1);
      await new Promise((resolve) => setImmediate(resolve));
      expect(Playlist.findByPk).toHaveBeenCalledTimes(1);

      releaseSlowLookup();
      await Promise.all([first, second]);

      expect(Playlist.findByPk).toHaveBeenCalledTimes(2);
      expect(fs.existsSync(MP3_PATH)).toBe(false);
    });
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

    describe('MP3 list', () => {
      const MAIN_PATH = '/youtube/Chan A/Chan A.m3u';
      const MP3_PATH = '/youtube/Chan A/Chan A (MP3).m3u';
      const both = { youtubeId: 'both', filePath: '/youtube/Chan A/Both/both.mp4', audioFilePath: '/youtube/Chan A/Both/both.mp3', duration: 10, youTubeVideoName: 'Both' };
      const vid = { youtubeId: 'vid', filePath: '/youtube/Chan A/Vid/vid.mp4', audioFilePath: null, duration: 20, youTubeVideoName: 'Vid' };
      const aud = { youtubeId: 'aud', filePath: null, audioFilePath: '/youtube/Chan A/Aud/aud.mp3', duration: 30, youTubeVideoName: 'Aud' };

      const generate = async (videos, audioFormat = 'video_mp3') => {
        Channel.findOne.mockResolvedValue({ ...baseChannel, audio_format: audioFormat });
        Video.findAll.mockResolvedValue(videos);
        return m3uGenerator.generateChannelM3U('UC1');
      };

      const written = (filePath) => {
        const call = fs.writeFileSync.mock.calls.find((c) => c[0] === `${filePath}.tmp`);
        return call ? call[1] : null;
      };

      const OWN_MP3_LIST = '#EXTM3U\n#PLAYLIST:Chan A (MP3)\n#YOUTARR-MP3-LIST:channel:UC1\n#EXTINF:1,x\nx.mp3\n';

      // What sits at the MP3 list's path: null for nothing, else the file's contents.
      const mp3ListOnDisk = (contents) => {
        fs.existsSync.mockImplementation((p) => p !== MP3_PATH || contents !== null);
        fs.readFileSync.mockReturnValue(contents);
      };

      beforeEach(() => mp3ListOnDisk(null));

      test('marks the MP3 list as generated for this channel', async () => {
        await generate([both]);

        expect(written(MP3_PATH).split('\n')).toContain('#YOUTARR-MP3-LIST:channel:UC1');
        expect(written(MAIN_PATH)).not.toContain('#YOUTARR-MP3-LIST');
      });

      describe.each([
        ['a file without a marker', '#EXTM3U\n#EXTINF:1,mine\nmine.mp3\n'],
        ['another channel\'s MP3 list', '#EXTM3U\n#PLAYLIST:Chan A (MP3)\n#YOUTARR-MP3-LIST:channel:UC2\n'],
      ])('when the MP3 list path holds %s', (_label, contents) => {
        beforeEach(() => mp3ListOnDisk(contents));

        test('does not overwrite it, and still writes the main list', async () => {
          const result = await generate([both, vid, aud]);

          expect(result).toBe(true);
          expect(written(MAIN_PATH)).toContain('both.mp4');
          expect(written(MP3_PATH)).toBeNull();
          expect(fs.unlinkSync).not.toHaveBeenCalledWith(MP3_PATH);
        });

        test.each([[null], ['mp3_only'], ['video_mp3']])('does not remove it (audio_format %s, no mp3s)', async (audioFormat) => {
          await generate([vid], audioFormat);

          expect(fs.unlinkSync).not.toHaveBeenCalledWith(MP3_PATH);
        });

        test('is kept when the channel playlist file is deleted', async () => {
          Channel.findOne.mockResolvedValue({ ...baseChannel });

          await m3uGenerator.deleteChannelM3U('UC1');

          expect(fs.unlinkSync).toHaveBeenCalledWith(MAIN_PATH);
          expect(fs.unlinkSync).not.toHaveBeenCalledWith(MP3_PATH);
        });
      });

      test('a rebuild requested while another runs waits for it', async () => {
        let releaseSlowQuery;
        const slowQuery = new Promise((resolve) => { releaseSlowQuery = () => resolve([both]); });
        Channel.findOne.mockResolvedValue({ ...baseChannel, audio_format: 'video_mp3' });
        Video.findAll.mockReturnValueOnce(slowQuery).mockResolvedValue([both]);

        const first = m3uGenerator.generateChannelM3U('UC1');
        const second = m3uGenerator.generateChannelM3U('UC1');
        await new Promise((resolve) => setImmediate(resolve));
        expect(Channel.findOne).toHaveBeenCalledTimes(1);

        releaseSlowQuery();
        await Promise.all([first, second]);

        expect(Channel.findOne).toHaveBeenCalledTimes(2);
      });

      test('Video + MP3 channel lists only items with a video file in the main list', async () => {
        await generate([both, vid, aud]);

        const main = written(MAIN_PATH);
        expect(main).toContain('Both/both.mp4');
        expect(main).toContain('Vid/vid.mp4');
        expect(main).not.toContain('.mp3');
        expect(fs.renameSync).toHaveBeenCalledWith(`${MAIN_PATH}.tmp`, MAIN_PATH);
      });

      test('Video + MP3 channel lists only items with an mp3 in a separate (MP3) list', async () => {
        await generate([both, vid, aud]);

        const mp3 = written(MP3_PATH);
        expect(mp3).toContain('#PLAYLIST:Chan A (MP3)');
        expect(mp3).toMatch(/#EXTINF:10,Both\nBoth\/both\.mp3/);
        expect(mp3).toMatch(/#EXTINF:30,Aud\nAud\/aud\.mp3/);
        expect(mp3).not.toContain('.mp4');
        expect(fs.renameSync).toHaveBeenCalledWith(`${MP3_PATH}.tmp`, MP3_PATH);
      });

      test('drops an item whose mp3 is gone from disk from the MP3 list but keeps its video', async () => {
        fs.promises.access.mockImplementation((p) =>
          String(p).endsWith('both.mp3') ? Promise.reject(new Error('ENOENT')) : Promise.resolve()
        );

        await generate([both, aud]);

        expect(written(MAIN_PATH)).toContain('both.mp4');
        expect(written(MP3_PATH)).toContain('aud.mp3');
        expect(written(MP3_PATH)).not.toContain('both.mp3');
      });

      test('Video + MP3 channel with only mp3s removes the video list and writes the MP3 list', async () => {
        await generate([aud]);

        expect(fs.unlinkSync).toHaveBeenCalledWith(MAIN_PATH);
        expect(written(MAIN_PATH)).toBeNull();
        expect(written(MP3_PATH)).toContain('aud.mp3');
      });

      test('Video + MP3 channel with no mp3s removes its stale MP3 list', async () => {
        mp3ListOnDisk(OWN_MP3_LIST);

        await generate([vid]);

        expect(fs.unlinkSync).toHaveBeenCalledWith(MP3_PATH);
        expect(written(MP3_PATH)).toBeNull();
        expect(written(MAIN_PATH)).toContain('vid.mp4');
      });

      test.each([[null], ['mp3_only']])('audio_format %s removes its stale MP3 list', async (audioFormat) => {
        mp3ListOnDisk(OWN_MP3_LIST);

        await generate([both, vid, aud], audioFormat);

        expect(fs.unlinkSync).toHaveBeenCalledWith(MP3_PATH);
        expect(written(MP3_PATH)).toBeNull();
      });
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

    test('unlinks the MP3 list it generated along with the channel m3u', async () => {
      Channel.findOne.mockResolvedValue({
        channel_id: 'UC1', folder_name: 'Chan A', uploader: 'Chan A', sub_folder: null,
      });
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('#EXTM3U\n#PLAYLIST:Chan A (MP3)\n#YOUTARR-MP3-LIST:channel:UC1\n');

      await m3uGenerator.deleteChannelM3U('UC1');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/youtube/Chan A/Chan A (MP3).m3u');
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
