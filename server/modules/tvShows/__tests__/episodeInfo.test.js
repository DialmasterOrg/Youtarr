jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/tvshow', () => ({ findAll: jest.fn() }));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const ID = 'abcdefghijk';
const STEM = `S2024E03151200 - Big Build [${ID}]`;

describe('episodeInfo.getEpisodeInfoMap', () => {
  let VideoClassification;
  let TvShow;
  let getEpisodeInfoMap;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    VideoClassification = require('../../../models/videoclassification');
    TvShow = require('../../../models/tvshow');
    ({ getEpisodeInfoMap } = require('../episodeInfo'));
    VideoClassification.findAll.mockResolvedValue([
      { youtube_id: ID, show_id: 5, season: 2024, episode: 3151200, source: 'date', file_stem: STEM },
    ]);
    TvShow.findAll.mockResolvedValue([{ id: 5, name: 'Mark Rober' }]);
  });

  it('describes a video whose file is its episode', async () => {
    const map = await getEpisodeInfoMap([{ youtubeId: ID, filePath: `/data/__TV/MR/Season 2024/${STEM}.mp4` }]);
    expect(map.get(ID)).toEqual({ showName: 'Mark Rober', season: 2024, episode: 3151200, code: 'S2024E03151200' });
  });

  it('ignores a stored episode whose file is named movie-style', async () => {
    const map = await getEpisodeInfoMap([{ youtubeId: ID, filePath: `/data/MR/Big Build [${ID}]/Big Build [${ID}].mp4` }]);
    expect(map.has(ID)).toBe(false);
  });

  it('skips videos without a file without querying', async () => {
    const map = await getEpisodeInfoMap([{ youtubeId: ID, filePath: null }]);
    expect(map.size).toBe(0);
    expect(VideoClassification.findAll).not.toHaveBeenCalled();
  });

  it('only reads assigned episodes', async () => {
    await getEpisodeInfoMap([{ youtubeId: ID, filePath: `/x/${STEM}.mp4` }]);
    expect(VideoClassification.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { youtube_id: [ID], status: 'assigned' },
    }));
  });
});
