jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ directoryPath: '/data' }));
jest.mock('../../../models/video', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn() }));
jest.mock('../../tvShows/channelFolders', () => ({ resolveChannelDirectory: jest.fn() }));

const video = (id, youtubeId, filePath, overrides = {}) => ({
  id, youtubeId, filePath, audioFilePath: null, channel_id: 'UC1', youTubeVideoName: `Video ${id}`,
  youTubeChannelName: 'Chan', removed: false, ...overrides,
});

const CHANNEL = { channel_id: 'UC1', title: 'Chan', folder_name: 'Chan', sub_folder: 'Kids' };

describe('reorganize changeScope', () => {
  let changeScope;
  let Video;
  let Channel;
  let VideoClassification;
  let channelFolders;

  const context = (overrides = {}) => ({
    type: 'channel',
    channel: CHANNEL,
    layoutBefore: (folder) => (folder === 'TV' ? 'tv' : 'videos'),
    folderBefore: (row) => row.sub_folder || '',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    Video = require('../../../models/video');
    Channel = require('../../../models/channel');
    VideoClassification = require('../../../models/videoclassification');
    channelFolders = require('../../tvShows/channelFolders');
    Channel.findAll.mockResolvedValue([CHANNEL]);
    VideoClassification.findAll.mockResolvedValue([]);
    channelFolders.resolveChannelDirectory.mockResolvedValue({ layout: 'videos', dir: '/data/__Kids/Chan' });
    changeScope = require('../changeScope');
  });

  describe('a channel\'s videos', () => {
    it('selects videos by channel id and by path, owned by the channel', async () => {
      Video.findAll.mockResolvedValue([
        video(1, 'aaaaaaaaaaa', '/data/__Kids/Chan/A [aaaaaaaaaaa].mp4'),
        video(2, 'bbbbbbbbbbb', '/data/__Kids/Chan/B [bbbbbbbbbbb].mp4', { channel_id: 'UCVEVO' }),
      ]);

      const { subjects } = await changeScope.selectSubjects(context());

      expect(subjects.map((subject) => [subject.video.id, subject.ownerChannelId, subject.libraryFolder, subject.currentLayout]))
        .toEqual([[1, 'UC1', 'Kids', 'videos'], [2, 'UC1', 'Kids', 'videos']]);
    });

    it('drops prefix matches that only matched through LIKE wildcards', async () => {
      Video.findAll.mockResolvedValue([
        video(3, 'ccccccccccc', '/data/__Kids/ChanXother/C [ccccccccccc].mp4', { channel_id: 'UCOTHER' }),
      ]);

      const { subjects } = await changeScope.selectSubjects(context());

      expect(subjects).toEqual([]);
    });

    it('leaves out an episode that belongs to another channel\'s show', async () => {
      Video.findAll.mockResolvedValue([video(4, 'ddddddddddd', '/data/__TV/Other/Season 2024/S2024E01 [ddddddddddd].mp4')]);
      VideoClassification.findAll.mockImplementation(async ({ where }) => (where.youtube_id
        ? [{ youtube_id: 'ddddddddddd', channel_id: 'UCOTHER' }]
        : []));

      const { subjects } = await changeScope.selectSubjects(context());

      expect(subjects).toEqual([]);
    });

    it('skips files outside the downloads folder', async () => {
      Video.findAll.mockResolvedValue([video(5, 'eeeeeeeeeee', '/elsewhere/E [eeeeeeeeeee].mp4')]);

      const { subjects } = await changeScope.selectSubjects(context());

      expect(subjects).toEqual([]);
    });
  });

  describe('a library folder\'s videos', () => {
    const folderContext = context({ type: 'folderLayout', folder: 'Kids', channel: undefined });

    it('selects every video in the folder and finds owners by channel folder', async () => {
      Video.findAll.mockResolvedValue([
        video(1, 'aaaaaaaaaaa', '/data/__Kids/Chan/A [aaaaaaaaaaa].mp4', { channel_id: 'UCVEVO' }),
        video(2, 'bbbbbbbbbbb', '/data/__Kids/Untracked/B [bbbbbbbbbbb].mp4', { channel_id: 'UCUNTRACKED' }),
        video(3, 'ccccccccccc', '/data/__Other/Chan/C [ccccccccccc].mp4'),
      ]);

      const { subjects } = await changeScope.selectSubjects(folderContext);

      expect(subjects.map((subject) => [subject.video.id, subject.ownerChannelId])).toEqual([[1, 'UC1'], [2, 'UCUNTRACKED']]);
      expect(subjects[1].ownerChannel).toBeNull();
    });

    it('takes an episode\'s owner from its classification in a TV folder', async () => {
      const tvContext = context({ type: 'folderLayout', folder: 'TV', channel: undefined });
      Video.findAll.mockResolvedValue([video(4, 'ddddddddddd', '/data/__TV/Show/Season 2024/S2024E01 [ddddddddddd].mp4', { channel_id: 'UCVEVO' })]);
      VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'ddddddddddd', channel_id: 'UC1' }]);

      const { subjects } = await changeScope.selectSubjects(tvContext);

      expect(subjects[0].ownerChannelId).toBe('UC1');
      expect(subjects[0].currentLayout).toBe('tv');
    });
  });

  it('selects the videos of every channel that follows the default subfolder', async () => {
    const onDefault = { ...CHANNEL, sub_folder: '##USE_GLOBAL_DEFAULT##' };
    Channel.findAll.mockResolvedValue([onDefault, { ...CHANNEL, channel_id: 'UC2', sub_folder: 'Kids' }]);
    Video.findAll.mockResolvedValue([video(1, 'aaaaaaaaaaa', '/data/__Kids/Chan/A [aaaaaaaaaaa].mp4')]);

    const { subjects } = await changeScope.selectSubjects(context({ type: 'defaultSubfolder', channel: undefined }));

    expect(channelFolders.resolveChannelDirectory).toHaveBeenCalledTimes(1);
    expect(subjects.map((subject) => subject.video.id)).toEqual([1]);
  });
});
