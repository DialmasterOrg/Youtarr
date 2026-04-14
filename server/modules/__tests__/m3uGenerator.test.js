jest.mock('fs');
jest.mock('../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../models', () => ({
  Playlist: { findByPk: jest.fn() },
  PlaylistVideo: { findAll: jest.fn() },
  Video: { findOne: jest.fn() },
}));
jest.mock('../filesystem/sanitizer', () => ({
  sanitizeNameLikeYtDlp: jest.fn((s) => s.replace(/[^a-zA-Z0-9-_ ]/g, '_')),
}));
jest.mock('../configModule', () => ({
  directoryPath: '/youtube',
}));

describe('m3uGenerator', () => {
  let m3uGenerator;
  let fs;
  let Playlist, PlaylistVideo, Video;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('fs', () => ({
      mkdirSync: jest.fn(),
      writeFileSync: jest.fn(),
    }));
    jest.doMock('../../models', () => ({
      Playlist: { findByPk: jest.fn() },
      PlaylistVideo: { findAll: jest.fn() },
      Video: { findOne: jest.fn() },
    }));
    jest.doMock('../filesystem/sanitizer', () => ({
      sanitizeNameLikeYtDlp: jest.fn((s) => s.replace(/[^a-zA-Z0-9-_ ]/g, '_')),
    }));
    jest.doMock('../configModule', () => ({
      directoryPath: '/youtube',
    }));
    jest.doMock('../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));

    fs = require('fs');
    ({ Playlist, PlaylistVideo, Video } = require('../../models'));
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
    const writeCall = fs.writeFileSync.mock.calls[0];
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
});
