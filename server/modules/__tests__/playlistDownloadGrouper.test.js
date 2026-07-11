jest.mock('../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../configModule', () => ({
  config: { preferredResolution: '1080' },
  getDefaultSubfolder: jest.fn().mockReturnValue(null),
}));

const Channel = require('../../models/channel');
const grouper = require('../playlistDownloadGrouper');

const playlist = {
  playlist_id: 'PL1',
  title: 'P',
  default_sub_folder: 'PlaylistFolder',
  video_quality: '720',
  audio_format: null,
  default_rating: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  Channel.findAll.mockResolvedValue([]);
});

test('groups contain only command settings (no subFolder/rating)', async () => {
  const groups = await grouper.buildGroups(playlist, [{ youtube_id: 'a', channel_id: 'UCnone' }], {});
  expect(groups).toHaveLength(1);
  expect(groups[0]).toEqual({
    resolution: '720',
    audioFormat: null,
    skipVideoFolder: false,
    youtubeIds: ['a'],
  });
  expect(groups[0]).not.toHaveProperty('subFolder');
  expect(groups[0]).not.toHaveProperty('rating');
});

test('uses channel command settings when the channel is configured', async () => {
  Channel.findAll.mockResolvedValue([
    { channel_id: 'UCc', video_quality: '1080', audio_format: 'mp3_only', skip_video_folder: true },
  ]);
  const groups = await grouper.buildGroups(playlist, [{ youtube_id: 'b', channel_id: 'UCc' }], {});
  expect(groups[0]).toEqual({
    resolution: '1080',
    audioFormat: 'mp3_only',
    skipVideoFolder: true,
    youtubeIds: ['b'],
  });
});

test('only loads enabled channels for settings resolution', async () => {
  await grouper.buildGroups(playlist, [{ youtube_id: 'b', channel_id: 'UCc' }], {});
  expect(Channel.findAll).toHaveBeenCalledWith(
    expect.objectContaining({ where: { channel_id: ['UCc'], enabled: true } })
  );
});

test('falls through to playlist settings when the channel is disabled', async () => {
  // The enabled filter excludes the row, so findAll returns nothing and resolution
  // falls through to playlist -> global.
  Channel.findAll.mockResolvedValue([]);
  const groups = await grouper.buildGroups(
    { ...playlist, audio_format: 'video_mp3' },
    [{ youtube_id: 'b', channel_id: 'UCdisabled' }],
    {}
  );
  expect(groups[0]).toEqual({
    resolution: '720',
    audioFormat: 'video_mp3',
    skipVideoFolder: false,
    youtubeIds: ['b'],
  });
});

test('override beats channel and playlist for command settings', async () => {
  Channel.findAll.mockResolvedValue([
    { channel_id: 'UCc', video_quality: '1080', audio_format: 'mp3_only', skip_video_folder: true },
  ]);
  const groups = await grouper.buildGroups(playlist, [{ youtube_id: 'b', channel_id: 'UCc' }], {
    resolution: '2160', audioFormat: 'video_mp3', skipVideoFolder: false,
  });
  expect(groups[0]).toMatchObject({ resolution: '2160', audioFormat: 'video_mp3', skipVideoFolder: false });
});

test('explicit null audioFormat override forces video-only despite channel/playlist MP3 settings', async () => {
  Channel.findAll.mockResolvedValue([
    { channel_id: 'UCc', video_quality: null, audio_format: 'mp3_only', skip_video_folder: false },
  ]);
  const groups = await grouper.buildGroups(
    { ...playlist, audio_format: 'mp3_only' },
    [{ youtube_id: 'b', channel_id: 'UCc' }],
    { audioFormat: null }
  );
  expect(groups).toHaveLength(1);
  expect(groups[0].audioFormat).toBeNull();
});

test('videos sharing command settings group together even with different channels', async () => {
  Channel.findAll.mockResolvedValue([
    { channel_id: 'UCa', video_quality: null, audio_format: null, skip_video_folder: false },
    { channel_id: 'UCb', video_quality: null, audio_format: null, skip_video_folder: false },
  ]);
  const groups = await grouper.buildGroups(playlist, [
    { youtube_id: 'x', channel_id: 'UCa' },
    { youtube_id: 'y', channel_id: 'UCb' },
  ], {});
  expect(groups).toHaveLength(1);
  expect(groups[0].youtubeIds).toEqual(['x', 'y']);
  expect(groups[0].resolution).toBe('720');
});

test('videos with differing command settings split into separate groups', async () => {
  Channel.findAll.mockResolvedValue([
    { channel_id: 'UCc', video_quality: '1080', audio_format: null, skip_video_folder: false },
  ]);
  const groups = await grouper.buildGroups(playlist, [
    { youtube_id: 'configured', channel_id: 'UCc' },
    { youtube_id: 'unconfigured', channel_id: 'UCnone' },
  ], {});
  expect(groups).toHaveLength(2);
  const byVideo = Object.fromEntries(groups.flatMap((g) => g.youtubeIds.map((id) => [id, g.resolution])));
  expect(byVideo.configured).toBe('1080');
  expect(byVideo.unconfigured).toBe('720');
});

test('routing values (subfolder/rating) never split groups', async () => {
  Channel.findAll.mockResolvedValue([]);
  const groups = await grouper.buildGroups(
    { ...playlist, default_rating: 'PG' },
    [{ youtube_id: 'a', channel_id: 'UC1' }, { youtube_id: 'b', channel_id: 'UC2' }],
    {}
  );
  expect(groups).toHaveLength(1);
});
