jest.mock('../../../models', () => ({
  TvShow: { findAll: jest.fn(), findOne: jest.fn() },
  VideoClassification: { findAll: jest.fn() },
  Video: { findAll: jest.fn() },
  TvShowSeason: { findAll: jest.fn() },
}));
jest.mock('../../../models/channelvideo', () => ({ findAll: jest.fn() }));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';

function classification(youtubeId, values) {
  return { youtube_id: youtubeId, show_id: 3, status: 'assigned', season: 1, episode: 1, source: 'title', ...values };
}

describe('titleShowQueries', () => {
  let queries;
  let models;
  let ChannelVideo;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    ChannelVideo = require('../../../models/channelvideo');
    queries = require('../titleShowQueries');
    models.Video.findAll.mockResolvedValue([]);
    ChannelVideo.findAll.mockResolvedValue([]);
    models.TvShowSeason.findAll.mockResolvedValue([]);
  });

  describe('countsByShow', () => {
    it('counts episodes, downloads, duplicates and unsupported videos per show', async () => {
      models.VideoClassification.findAll.mockResolvedValue([
        classification('a'), classification('b', { status: 'pending_number', season: null, episode: null }),
        classification('c', { status: 'duplicate' }), classification('d', { status: 'unsupported', show_id: 4 }),
      ]);
      models.Video.findAll.mockResolvedValue([{ youtubeId: 'a' }]);
      const counts = await queries.countsByShow([3, 4]);
      expect(counts.get(3)).toEqual({ episodes: 2, downloaded: 1, duplicates: 1, unsupported: 0 });
      expect(counts.get(4)).toEqual({ episodes: 0, downloaded: 0, duplicates: 0, unsupported: 1 });
    });

    it('asks only for downloaded files that are present', async () => {
      models.VideoClassification.findAll.mockResolvedValue([classification('a')]);
      await queries.countsByShow([3]);
      expect(models.Video.findAll.mock.calls[0][0].where).toMatchObject({ youtubeId: ['a'], removed: false });
    });
  });

  describe('countActiveByChannel', () => {
    it('counts the active title shows of each channel', async () => {
      models.TvShow.findAll.mockResolvedValue([{ channel_id: CHANNEL_ID }, { channel_id: CHANNEL_ID }, { channel_id: 'UCx' }]);
      expect(await queries.countActiveByChannel([CHANNEL_ID, 'UCx'])).toEqual(new Map([[CHANNEL_ID, 2], ['UCx', 1]]));
    });
  });

  describe('missingEpisodes', () => {
    beforeEach(() => {
      models.TvShow.findOne.mockResolvedValue({ id: 3, name: 'Beyblade', channel_id: CHANNEL_ID });
      models.VideoClassification.findAll.mockResolvedValue([
        classification('a', { episode: 1 }), classification('b', { episode: 2 }), classification('c', { episode: 5 }),
      ]);
      models.Video.findAll.mockResolvedValue([{ youtubeId: 'a' }]);
      ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'b', title: 'Day of the Dragoon' }]);
      models.TvShowSeason.findAll.mockResolvedValue([{ season: 1, name: 'Beyblade' }]);
    });

    it('lists the not-downloaded episodes and the gaps of each season', async () => {
      const result = await queries.missingEpisodes(CHANNEL_ID, 3);
      expect(result).toEqual({
        showId: 3,
        name: 'Beyblade',
        seasons: [{
          season: 1,
          name: 'Beyblade',
          episodes: 3,
          downloaded: 1,
          notDownloaded: [
            { youtubeId: 'b', title: 'Day of the Dragoon', episode: 2, code: 'S01E02' },
            { youtubeId: 'c', title: null, episode: 5, code: 'S01E05' },
          ],
          gaps: [3, 4],
          gapsTruncated: false,
        }],
      });
    });

    it('returns null for a show of another channel', async () => {
      models.TvShow.findOne.mockResolvedValue(null);
      expect(await queries.missingEpisodes(CHANNEL_ID, 99)).toBeNull();
    });
  });

  describe('showEpisodeIds', () => {
    it('returns the videos classified into one of the channel\'s active title shows', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 3 }, { id: 4 }]);
      models.VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'a' }]);
      expect(await queries.showEpisodeIds(CHANNEL_ID, ['a', 'b'])).toEqual(new Set(['a']));
      expect(models.VideoClassification.findAll.mock.calls[0][0].where).toEqual({
        youtube_id: ['a', 'b'], show_id: [3, 4], status: ['assigned', 'pending_number'],
      });
    });

    it('returns null for a channel without active title shows', async () => {
      models.TvShow.findAll.mockResolvedValue([]);
      expect(await queries.showEpisodeIds(CHANNEL_ID, ['a'])).toBeNull();
    });
  });

  describe('youtubeIdsForShow', () => {
    it('lists the videos classified into a show as episodes', async () => {
      models.VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'a' }, { youtube_id: 'b' }]);
      expect(await queries.youtubeIdsForShow(3)).toEqual(new Set(['a', 'b']));
      expect(models.VideoClassification.findAll.mock.calls[0][0].where).toEqual({ show_id: 3, status: ['assigned', 'pending_number'] });
    });
  });

  describe('describeVideos', () => {
    it('gives each video its title and whether its file is present', async () => {
      ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'a', title: 'Listed A' }]);
      models.Video.findAll.mockResolvedValue([
        { id: 5, youtubeId: 'a', youTubeVideoName: 'Downloaded A', removed: false },
        { id: 6, youtubeId: 'b', youTubeVideoName: 'Downloaded B', removed: true },
      ]);
      expect(await queries.describeVideos(CHANNEL_ID, ['a', 'b', 'c'])).toEqual(new Map([
        ['a', { title: 'Listed A', downloaded: true, videoId: 5 }],
        ['b', { title: 'Downloaded B', downloaded: false, videoId: 6 }],
        ['c', { title: null, downloaded: false, videoId: null }],
      ]));
    });
  });

  describe('plannedEpisodes', () => {
    it('gives numbered title-show episodes their code and show name', async () => {
      models.VideoClassification.findAll.mockResolvedValue([classification('a', { episode: 20 })]);
      models.TvShow.findAll.mockResolvedValue([{ id: 3, name: 'Beyblade' }]);
      expect(await queries.plannedEpisodes(['a'])).toEqual(new Map([['a', { showName: 'Beyblade', season: 1, episode: 20, code: 'S01E20' }]]));
    });

    it('asks only for active title shows', async () => {
      models.VideoClassification.findAll.mockResolvedValue([classification('a')]);
      models.TvShow.findAll.mockResolvedValue([]);
      expect(await queries.plannedEpisodes(['a'])).toEqual(new Map());
      expect(models.TvShow.findAll.mock.calls[0][0].where).toEqual({ id: [3], kind: 'title', retired_at: null });
    });
  });
});
