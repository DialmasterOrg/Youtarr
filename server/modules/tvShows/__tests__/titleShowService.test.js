jest.mock('../../../models', () => ({
  Channel: { findOne: jest.fn() },
  Video: { findOne: jest.fn() },
  VideoClassification: { findByPk: jest.fn() },
  EpisodeConflict: { findByPk: jest.fn() },
  TvShow: { findByPk: jest.fn(), findAll: jest.fn(async () => []) },
}));
jest.mock('../../../models/channelvideo', () => ({ findOne: jest.fn() }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(() => '') }));
jest.mock('../libraryLayouts', () => ({
  getLayoutResolver: jest.fn(async () => (folder) => (folder === 'TV Shows' ? 'tv' : 'videos')),
  listTvFolders: jest.fn(async () => ['TV Shows']),
}));
jest.mock('../channelFolders', () => ({
  effectiveLibraryFolder: jest.fn(() => 'Kids'),
  showDirectory: (show) => `/data/__TV Shows/${show.folder_name}`,
}));
jest.mock('../../sidecarWriter', () => ({ writeShowMetadata: jest.fn() }));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../titleShowStore', () => ({
  ...jest.requireActual('../titleShowStore'),
  listTitleShows: jest.fn(),
}));
jest.mock('../titleShowSaver', () => ({ save: jest.fn(), prepare: jest.fn() }));
jest.mock('../titleShowQueries', () => ({
  countsByShow: jest.fn(async () => new Map()),
  describeVideos: jest.fn(async () => new Map()),
  missingEpisodes: jest.fn(),
}));
jest.mock('../episodeConflicts', () => ({ listForChannel: jest.fn(async () => []) }));
jest.mock('../titlePreview', () => ({ summarizePlan: jest.fn(() => ({ shows: [] })) }));
jest.mock('../../download/videoActivity', () => ({ isActive: jest.fn(() => false) }));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';

function storedShow(id, extra = {}) {
  return {
    id, key: `title:${id}`, channelId: CHANNEL_ID, name: `Show ${id}`, folderName: `Show ${id}`, libraryFolder: 'TV Shows',
    position: 0, externalKey: 'u', excludeTerms: [], seasonNames: {}, retired: false, retiredAt: null,
    patterns: [{ id: id * 10, key: `title:${id}#0`, position: 0, text: 'Ep {episode}', kind: 'simple', compiledRegex: 'c', filterRegex: 'f', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }],
    ...extra,
  };
}

const draftOf = (id) => expect.objectContaining({ id, name: `Show ${id}` });

describe('titleShowService', () => {
  let service;
  let store;
  let saver;
  let models;
  let ChannelVideo;
  let queries;
  let conflicts;
  const channel = { channel_id: CHANNEL_ID, title: 'BEYBLADE Official', enabled: true, tv_show_only_downloads: false, update: jest.fn() };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    ChannelVideo = require('../../../models/channelvideo');
    store = require('../titleShowStore');
    saver = require('../titleShowSaver');
    queries = require('../titleShowQueries');
    conflicts = require('../episodeConflicts');
    service = require('../titleShowService');
    store.listTitleShows.mockImplementation(async (channelId, { includeRetired } = {}) => (
      includeRetired ? [storedShow(3), storedShow(4), storedShow(5, { retired: true })] : [storedShow(3), storedShow(4)]
    ));
    models.Channel.findOne.mockResolvedValue(channel);
  });

  describe('getChannelShows', () => {
    it('lists the shows, retired ones included, with their counts', async () => {
      queries.countsByShow.mockResolvedValue(new Map([[3, { episodes: 51 }]]));
      const result = await service.getChannelShows(channel);
      expect(result.shows.map((show) => [show.id, show.retired, show.counts])).toEqual([
        [3, false, { episodes: 51 }], [4, false, null], [5, true, null],
      ]);
    });

    it('gives each pattern its compiled regex for regex mode', async () => {
      const result = await service.getChannelShows(channel);
      expect(result.shows[0].patterns[0]).toEqual({
        text: 'Ep {episode}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title', compiledRegex: 'c',
      });
    });

    it('describes the channel\'s conflicts', async () => {
      conflicts.listForChannel.mockResolvedValue([{ youtubeId: 'dup', duplicateOf: 'win', kind: 'duplicate' }]);
      queries.describeVideos.mockResolvedValue(new Map([
        ['dup', { title: 'Re-upload', downloaded: true, videoId: 8 }],
        ['win', { title: 'Original', downloaded: false, videoId: null }],
      ]));
      const result = await service.getChannelShows(channel);
      expect(result.conflicts).toEqual([expect.objectContaining({
        youtubeId: 'dup', title: 'Re-upload', downloaded: true, videoId: 8, duplicateOfTitle: 'Original',
      })]);
    });

    it('tells the editor where new shows go by default', async () => {
      const result = await service.getChannelShows(channel);
      expect([result.tvFolders, result.defaultLibraryFolder, result.showOnlyDownloads]).toEqual([['TV Shows'], 'TV Shows', false]);
    });
  });

  describe('changes', () => {
    it('adds a show after the existing ones', async () => {
      await service.createShow(channel, { name: 'New' });
      expect(saver.save.mock.calls[0][0].rawShows).toEqual([draftOf(3), draftOf(4), { name: 'New' }]);
    });

    it('replaces a show\'s definition, keeping its id', async () => {
      await service.updateShow(channel, 4, { name: 'Renamed', id: 99 });
      expect(saver.save.mock.calls[0][0].rawShows).toEqual([draftOf(3), { name: 'Renamed', id: 4 }]);
    });

    it('refuses to edit a show the channel doesn\'t have', async () => {
      await expect(service.updateShow(channel, 9, { name: 'x' })).rejects.toMatchObject({ status: 404 });
    });

    it('retires a show by leaving it out', async () => {
      await service.retireShow(channel, 3);
      expect(saver.save.mock.calls[0][0].rawShows).toEqual([draftOf(4)]);
    });

    it('restores a retired show at the end', async () => {
      await service.restoreShow(channel, 5);
      expect(saver.save.mock.calls[0][0].rawShows).toEqual([draftOf(3), draftOf(4), draftOf(5)]);
    });

    it('refuses to restore a show that isn\'t retired', async () => {
      await expect(service.restoreShow(channel, 3)).rejects.toMatchObject({ status: 400 });
    });

    it('reorders the shows', async () => {
      await service.reorderShows(channel, [4, 3]);
      expect(saver.save.mock.calls[0][0].rawShows).toEqual([draftOf(4), draftOf(3)]);
    });

    it('refuses an order that leaves out a show', async () => {
      await expect(service.reorderShows(channel, [4])).rejects.toMatchObject({ status: 400 });
    });

    it('re-checks the channel\'s titles with its current shows', async () => {
      await service.recheck(channel);
      expect(saver.save.mock.calls[0][0]).toEqual({ channel, rawShows: [draftOf(3), draftOf(4)] });
    });
  });

  describe('show metadata', () => {
    it('rewrites the NFO files of the channel\'s title shows after a save', async () => {
      const row = { id: 4, kind: 'title', folder_name: 'Show 4' };
      models.TvShow.findAll.mockResolvedValue([row]);
      await service.updateShow(channel, 4, { name: 'Renamed' });
      expect(require('../../sidecarWriter').writeShowMetadata).toHaveBeenCalledWith({ show: row, showDir: '/data/__TV Shows/Show 4' });
    });

    it('asks only for the channel\'s active title shows', async () => {
      await service.updateShow(channel, 4, { name: 'Renamed' });
      expect(models.TvShow.findAll).toHaveBeenCalledWith({ where: { channel_id: CHANNEL_ID, kind: 'title', retired_at: null } });
    });

    it('keeps a save whose NFO files could not be written', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 4, kind: 'title', folder_name: 'Show 4' }]);
      require('../../sidecarWriter').writeShowMetadata.mockRejectedValueOnce(new Error('EACCES'));
      await expect(service.updateShow(channel, 4, { name: 'Renamed' })).resolves.toBeDefined();
    });
  });

  describe('setShowOnly', () => {
    it('stores the switch', async () => {
      await service.setShowOnly(channel, true);
      expect(channel.update).toHaveBeenCalledWith({ tv_show_only_downloads: true });
    });
  });

  describe('preview', () => {
    it('summarizes the plan of the drafts with the compiled patterns', async () => {
      saver.prepare.mockResolvedValue({
        drafts: [{ key: 'new:0', patterns: [{ compiledRegex: '(?i)x', filterRegex: 'f' }] }],
        plan: { videos: [] },
      });
      const result = await service.preview(channel, { shows: [{ name: 'x' }], overrides: [] });
      expect(result.compiled).toEqual([{ key: 'new:0', patterns: ['(?i)x'] }]);
    });
  });

  describe('useDuplicateCopy', () => {
    it('gives the duplicate the number its holder has', async () => {
      models.EpisodeConflict.findByPk.mockResolvedValue({ youtube_id: 'dup', channel_id: CHANNEL_ID, kind: 'duplicate', show_id: 3, details: JSON.stringify({ season: 1, episode: 20 }) });
      await service.useDuplicateCopy(channel, 'dup');
      expect(saver.save.mock.calls[0][0].rawOverrides).toEqual([{ youtubeId: 'dup', showId: 3, season: 1, episode: 20 }]);
    });

    it('refuses a video that is not a duplicate of the channel', async () => {
      models.EpisodeConflict.findByPk.mockResolvedValue(null);
      await expect(service.useDuplicateCopy(channel, 'dup')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('getVideoEpisode', () => {
    it('describes a video\'s classification and the shows it can join', async () => {
      models.VideoClassification.findByPk.mockResolvedValue({
        youtube_id: 'abc', channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 20, source: 'title', title_opt_out: false,
      });
      models.TvShow.findByPk.mockResolvedValue({ id: 3, name: 'Show 3', kind: 'title' });
      const result = await service.getVideoEpisode('abc');
      expect(result).toEqual({
        channelId: CHANNEL_ID,
        assignable: true,
        classification: { showId: 3, showName: 'Show 3', kind: 'title', status: 'assigned', season: 1, episode: 20, code: 'S01E20', source: 'title', notAnEpisode: false },
        shows: [{ id: 3, name: 'Show 3', seasonNames: {} }, { id: 4, name: 'Show 4', seasonNames: {} }],
      });
    });

    it('finds the owner of an unclassified video through its download or listing', async () => {
      models.VideoClassification.findByPk.mockResolvedValue(null);
      models.Video.findOne.mockResolvedValue(null);
      ChannelVideo.findOne.mockResolvedValue({ channel_id: CHANNEL_ID });
      expect((await service.getVideoEpisode('abc')).channelId).toBe(CHANNEL_ID);
    });

    it('is not assignable without a tracked channel', async () => {
      models.VideoClassification.findByPk.mockResolvedValue(null);
      models.Video.findOne.mockResolvedValue(null);
      ChannelVideo.findOne.mockResolvedValue(null);
      expect(await service.getVideoEpisode('abc')).toEqual({ channelId: null, assignable: false, classification: null, shows: [] });
    });
  });

  describe('assignEpisode', () => {
    it('saves the assignment as an override with the current shows', async () => {
      models.VideoClassification.findByPk.mockResolvedValue(null);
      models.Video.findOne.mockResolvedValue({ channel_id: CHANNEL_ID });
      await service.assignEpisode('abcdefghijk', { showId: 3, season: 1, episode: 51 });
      expect(saver.save.mock.calls[0][0]).toEqual({
        channel,
        rawShows: [draftOf(3), draftOf(4)],
        rawOverrides: [{ youtubeId: 'abcdefghijk', showId: 3, season: 1, episode: 51 }],
      });
    });

    it('refuses "Not an episode" for a video that is not in a title show', async () => {
      models.VideoClassification.findByPk.mockResolvedValue({ youtube_id: 'abcdefghijk', channel_id: CHANNEL_ID, show_id: 9, status: 'assigned', season: 2024, episode: 3151200, source: 'date', title_opt_out: false });
      models.TvShow.findByPk.mockResolvedValue({ id: 9, kind: 'channel' });
      await expect(service.assignEpisode('abcdefghijk', { notAnEpisode: true })).rejects.toMatchObject({ status: 400 });
      expect(saver.save).not.toHaveBeenCalled();
    });

    it('marks an episode of a title show "Not an episode"', async () => {
      models.VideoClassification.findByPk.mockResolvedValue({ youtube_id: 'abcdefghijk', channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 5, source: 'title', title_opt_out: false });
      models.TvShow.findByPk.mockResolvedValue({ id: 3, kind: 'title' });
      await service.assignEpisode('abcdefghijk', { notAnEpisode: true });
      expect(saver.save.mock.calls[0][0].rawOverrides).toEqual([{ youtubeId: 'abcdefghijk', notAnEpisode: true }]);
    });

    it('refuses a video whose channel has no shows', async () => {
      models.VideoClassification.findByPk.mockResolvedValue(null);
      models.Video.findOne.mockResolvedValue({ channel_id: CHANNEL_ID });
      store.listTitleShows.mockResolvedValue([]);
      await expect(service.assignEpisode('abcdefghijk', { notAnEpisode: true })).rejects.toMatchObject({ status: 400 });
    });
  });
});
