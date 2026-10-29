/* eslint-env jest */

jest.mock('../../models/video', () => ({ findAll: jest.fn() }));
jest.mock('../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../configModule', () => ({
  config: { preferredResolution: '1080' },
  getDefaultSubfolder: jest.fn().mockReturnValue(null),
}));
jest.mock('../tvShows/libraryLayouts', () => ({ getLayoutResolver: jest.fn() }));
jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const Video = require('../../models/video');
const ChannelVideo = require('../../models/channelvideo');
const Channel = require('../../models/channel');
const configModule = require('../configModule');
const libraryLayouts = require('../tvShows/libraryLayouts');
const grouper = require('../manualDownloadGrouper');

const URL_A = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';
const URL_B = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';
const HD_CHANNEL = { channel_id: 'UChd', video_quality: '720', audio_format: null, skip_video_folder: true };
const MP3_CHANNEL = { channel_id: 'UCmp3', video_quality: null, audio_format: 'mp3_only', skip_video_folder: null };
const TV_CHANNEL = { channel_id: 'UCtv', video_quality: null, audio_format: null, skip_video_folder: null, sub_folder: 'TV' };

beforeEach(() => {
  jest.clearAllMocks();
  Video.findAll.mockResolvedValue([]);
  ChannelVideo.findAll.mockResolvedValue([]);
  Channel.findAll.mockResolvedValue([]);
  configModule.getDefaultSubfolder.mockReturnValue(null);
  libraryLayouts.getLayoutResolver.mockResolvedValue((folder) => (folder === 'TV' ? 'tv' : 'videos'));
});

test('one global-settings group when nothing is attributable', async () => {
  const groups = await grouper.buildGroups({ urls: [URL_A, URL_B] });
  expect(groups).toEqual([
    { resolution: '1080', audioFormat: null, urls: [URL_A, URL_B] },
  ]);
});

test('applies channel command settings via the attribution map', async () => {
  Channel.findAll.mockResolvedValue([HD_CHANNEL]);
  const groups = await grouper.buildGroups({
    urls: [URL_A],
    videoChannelMap: { aaaaaaaaaaa: 'UChd' },
  });
  expect(groups).toEqual([
    { resolution: '720', audioFormat: null, urls: [URL_A] },
  ]);
});

test('falls back to videos.channel_id, then channelvideos listers', async () => {
  Video.findAll.mockResolvedValue([{ youtubeId: 'aaaaaaaaaaa', channel_id: 'UChd' }]);
  ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'bbbbbbbbbbb', channel_id: 'UCmp3' }]);
  Channel.findAll.mockResolvedValue([HD_CHANNEL, MP3_CHANNEL]);

  const groups = await grouper.buildGroups({ urls: [URL_A, URL_B] });

  expect(groups).toHaveLength(2);
  expect(groups).toContainEqual({ resolution: '720', audioFormat: null, urls: [URL_A] });
  expect(groups).toContainEqual({ resolution: '1080', audioFormat: 'mp3_only', urls: [URL_B] });
});

test('mapped channel wins over DB attribution', async () => {
  Video.findAll.mockResolvedValue([{ youtubeId: 'aaaaaaaaaaa', channel_id: 'UCmp3' }]);
  Channel.findAll.mockResolvedValue([HD_CHANNEL, MP3_CHANNEL]);
  const groups = await grouper.buildGroups({
    urls: [URL_A],
    videoChannelMap: { aaaaaaaaaaa: 'UChd' },
  });
  expect(groups[0].resolution).toBe('720');
});

test('untracked mapped channel is skipped in favor of a tracked lister', async () => {
  ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'aaaaaaaaaaa', channel_id: 'UCmp3' }]);
  Channel.findAll.mockResolvedValue([MP3_CHANNEL]); // UCuntracked absent = untracked/disabled
  const groups = await grouper.buildGroups({
    urls: [URL_A],
    videoChannelMap: { aaaaaaaaaaa: 'UCuntracked' },
  });
  expect(groups[0].audioFormat).toBe('mp3_only');
});

test('queries only tracked and enabled channels', async () => {
  await grouper.buildGroups({ urls: [URL_A], videoChannelMap: { aaaaaaaaaaa: 'UChd' } });
  expect(Channel.findAll).toHaveBeenCalledWith(
    expect.objectContaining({ where: { channel_id: ['UChd'], enabled: true } })
  );
});

test('dialog overrides pin command settings into a single group', async () => {
  Video.findAll.mockResolvedValue([{ youtubeId: 'aaaaaaaaaaa', channel_id: 'UChd' }]);
  Channel.findAll.mockResolvedValue([HD_CHANNEL]);
  const groups = await grouper.buildGroups({
    urls: [URL_A, URL_B],
    overrideSettings: { resolution: '480', audioFormat: null },
  });
  expect(groups).toEqual([
    { resolution: '480', audioFormat: null, urls: [URL_A, URL_B] },
  ]);
});

test('explicit null audioFormat override forces video-only despite channel MP3 setting', async () => {
  Video.findAll.mockResolvedValue([{ youtubeId: 'aaaaaaaaaaa', channel_id: 'UCmp3' }]);
  Channel.findAll.mockResolvedValue([MP3_CHANNEL]);
  const groups = await grouper.buildGroups({
    urls: [URL_A],
    overrideSettings: { audioFormat: null },
  });
  expect(groups[0].audioFormat).toBeNull();
});

test('channels differing only in file structure share one group', async () => {
  Video.findAll.mockResolvedValue([
    { youtubeId: 'aaaaaaaaaaa', channel_id: 'UCsubs' },
    { youtubeId: 'bbbbbbbbbbb', channel_id: 'UCflat' },
  ]);
  Channel.findAll.mockResolvedValue([
    { channel_id: 'UCsubs', video_quality: null, audio_format: null, skip_video_folder: false },
    { channel_id: 'UCflat', video_quality: null, audio_format: null, skip_video_folder: true },
  ]);
  const groups = await grouper.buildGroups({ urls: [URL_A, URL_B] });
  expect(groups).toHaveLength(1);
  expect(groups[0].urls).toEqual([URL_A, URL_B]);
});

test('an unparseable URL keeps its original string and joins the global group', async () => {
  const weird = 'https://example.com/not-youtube';
  const groups = await grouper.buildGroups({ urls: [weird] });
  expect(groups).toEqual([
    { resolution: '1080', audioFormat: null, urls: [weird] },
  ]);
});

describe('TV folders are video-only', () => {
  test('downgrades an MP3 override to video for the URL of a channel in a TV folder', async () => {
    Channel.findAll.mockResolvedValue([TV_CHANNEL]);
    const groups = await grouper.buildGroups({
      urls: [URL_A],
      overrideSettings: { audioFormat: 'mp3_only' },
      videoChannelMap: { aaaaaaaaaaa: 'UCtv' },
    });
    expect(groups).toEqual([{ resolution: '1080', audioFormat: null, urls: [URL_A] }]);
  });

  test('keeps an MP3 override for the URL of a channel in a videos folder', async () => {
    Channel.findAll.mockResolvedValue([{ ...HD_CHANNEL, sub_folder: 'Music' }]);
    const groups = await grouper.buildGroups({
      urls: [URL_A],
      overrideSettings: { audioFormat: 'mp3_only' },
      videoChannelMap: { aaaaaaaaaaa: 'UChd' },
    });
    expect(groups[0].audioFormat).toBe('mp3_only');
  });

  test('splits MP3 URLs by destination layout', async () => {
    Channel.findAll.mockResolvedValue([TV_CHANNEL, { ...MP3_CHANNEL, sub_folder: 'Music' }]);
    const groups = await grouper.buildGroups({
      urls: [URL_A, URL_B],
      overrideSettings: { audioFormat: 'mp3_only' },
      videoChannelMap: { aaaaaaaaaaa: 'UCtv', bbbbbbbbbbb: 'UCmp3' },
    });
    expect(groups).toContainEqual({ resolution: '1080', audioFormat: null, urls: [URL_A] });
    expect(groups).toContainEqual({ resolution: '1080', audioFormat: 'mp3_only', urls: [URL_B] });
  });

  test('downgrades MP3 for an unattributed URL when the default subfolder is TV', async () => {
    configModule.getDefaultSubfolder.mockReturnValue('TV');
    const groups = await grouper.buildGroups({ urls: [URL_A], overrideSettings: { audioFormat: 'video_mp3' } });
    expect(groups[0].audioFormat).toBeNull();
  });

  test('downgrades MP3 for a destination override that is a TV folder', async () => {
    const groups = await grouper.buildGroups({
      urls: [URL_A],
      overrideSettings: { audioFormat: 'mp3_only', subfolder: 'TV' },
    });
    expect(groups[0].audioFormat).toBeNull();
  });

  test('reads the folder layouts once per batch', async () => {
    await grouper.buildGroups({ urls: [URL_A, URL_B], overrideSettings: { audioFormat: 'mp3_only' } });
    expect(libraryLayouts.getLayoutResolver).toHaveBeenCalledTimes(1);
  });
});
