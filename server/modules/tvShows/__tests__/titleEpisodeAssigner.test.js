jest.mock('../../../models', () => ({
  VideoClassification: { findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() },
  TvShow: { findByPk: jest.fn() },
}));
jest.mock('../titleShowStore', () => ({ listTitleShows: jest.fn(), highWaterMarks: jest.fn(), raiseHighWater: jest.fn() }));
jest.mock('../titleMatcher', () => ({ ...jest.requireActual('../titleMatcher'), matchVideos: jest.fn() }));
jest.mock('../episodeConflicts', () => ({ recordDuplicate: jest.fn(), recordError: jest.fn() }));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { MATCH_KIND } = jest.requireActual('../titleMatcher');

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';
const VIDEO_ID = 'y7xVT7DTt2k';
// 2020-08-09 12:30 UTC
const INFO = { id: VIDEO_ID, title: 'BEYBLADE EN Episode 20: It\'s All Relative', timestamp: 1596976200 };

function show(id, patterns) {
  return { id, key: `title:${id}`, name: 'Beyblade', patterns, excludeTerms: [], seasonNames: {} };
}

function pattern(id, sources) {
  return { id, key: `p${id}`, compiledRegex: 'x', ...sources };
}

const TITLE_SHOW = show(3, [pattern(30, { seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' })]);
const SHOW_ROW = { id: 3, kind: 'title', name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows', channel_id: CHANNEL_ID, external_key: 'u' };

function match(values) {
  return new Map([[VIDEO_ID, { showKey: 'title:3', patternKey: 'p30', reason: null, episodeTitle: 'It\'s All Relative', ...values }]]);
}

describe('titleEpisodeAssigner.resolveTitlePlacement', () => {
  let assigner;
  let models;
  let store;
  let matcher;
  let conflicts;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    store = require('../titleShowStore');
    matcher = require('../titleMatcher');
    conflicts = require('../episodeConflicts');
    assigner = require('../titleEpisodeAssigner');
    store.listTitleShows.mockResolvedValue([TITLE_SHOW]);
    store.highWaterMarks.mockResolvedValue(new Map());
    models.VideoClassification.findByPk.mockResolvedValue(null);
    models.VideoClassification.findAll.mockResolvedValue([]);
    models.VideoClassification.create.mockImplementation(async (values) => values);
    models.TvShow.findByPk.mockResolvedValue(SHOW_ROW);
  });

  const resolve = (overrides = {}) => assigner.resolveTitlePlacement({
    youtubeId: VIDEO_ID, info: INFO, ownerChannelId: CHANNEL_ID, channelEnabled: true, ...overrides,
  });

  it('leaves a video of an untracked or disabled channel to the channel layout', async () => {
    expect(await resolve({ channelEnabled: false })).toBeNull();
    expect(store.listTitleShows).not.toHaveBeenCalled();
  });

  it('leaves a channel without title shows to the channel layout', async () => {
    store.listTitleShows.mockResolvedValue([]);
    expect(await resolve()).toBeNull();
  });

  it('reuses a stored episode without classifying again', async () => {
    models.VideoClassification.findByPk.mockResolvedValue({
      youtube_id: VIDEO_ID, channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 20, source: 'title',
      episode_title: 'It\'s All Relative', file_stem: 'S01E20 - It\'s All Relative [y7xVT7DTt2k]', title_opt_out: false,
    });
    const placement = await resolve();
    expect(placement).toEqual({
      show: SHOW_ROW,
      assignment: { season: 1, episode: 20, dateNumbered: false, episodeTitle: 'It\'s All Relative', fileStem: 'S01E20 - It\'s All Relative [y7xVT7DTt2k]' },
    });
    expect(matcher.matchVideos).not.toHaveBeenCalled();
  });

  it('leaves a video marked "Not an episode" to the channel layout', async () => {
    models.VideoClassification.findByPk.mockResolvedValue({ channel_id: CHANNEL_ID, show_id: 3, status: 'opted_out', title_opt_out: true });
    expect(await resolve()).toBeNull();
  });

  it('leaves a stored duplicate to the channel layout', async () => {
    models.VideoClassification.findByPk.mockResolvedValue({ channel_id: CHANNEL_ID, show_id: 3, status: 'duplicate', title_opt_out: false });
    expect(await resolve()).toBeNull();
  });

  it('leaves a channel-show episode to the channel layout', async () => {
    models.VideoClassification.findByPk.mockResolvedValue({ channel_id: CHANNEL_ID, show_id: 9, status: 'assigned', season: 2020, episode: 8091230, file_stem: 's', title_opt_out: false });
    models.TvShow.findByPk.mockResolvedValue({ id: 9, kind: 'channel' });
    expect(await resolve()).toBeNull();
  });

  it('classifies a video it hasn\'t seen by its full title', async () => {
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.NUMBERED, season: 1, episode: 20 }));
    await resolve();
    expect(matcher.matchVideos).toHaveBeenCalledWith([TITLE_SHOW], [{ youtubeId: VIDEO_ID, title: INFO.title }]);
  });

  it('numbers a title-numbered match and stores it', async () => {
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.NUMBERED, season: 1, episode: 20 }));
    const placement = await resolve();
    expect(placement.assignment).toEqual({
      season: 1, episode: 20, dateNumbered: false, episodeTitle: 'It\'s All Relative', fileStem: 'S01E20 - It\'s All Relative [y7xVT7DTt2k]',
    });
    expect(models.VideoClassification.create).toHaveBeenCalledWith(expect.objectContaining({
      youtube_id: VIDEO_ID, channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', source: 'title', pattern_id: 30,
    }));
  });

  it('records a duplicate when another video holds the number', async () => {
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.NUMBERED, season: 1, episode: 20 }));
    models.VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'heldBy00001', season: 1, episode: 20 }]);
    expect(await resolve()).toBeNull();
    expect(conflicts.recordDuplicate).toHaveBeenCalledWith(expect.objectContaining({
      youtubeId: VIDEO_ID, showId: 3, season: 1, episode: 20, duplicateOf: 'heldBy00001', downloaded: true,
    }));
    expect(models.VideoClassification.create.mock.calls[0][0]).toMatchObject({ status: 'duplicate', season: null, episode: null });
  });

  it('allocates the next order number past the high-water mark', async () => {
    const orderShow = show(3, [pattern(31, { seasonSource: 'fixed', seasonFixed: 0, episodeSource: 'order' })]);
    store.listTitleShows.mockResolvedValue([orderShow]);
    store.highWaterMarks.mockResolvedValue(new Map([['title:3|0', 6]]));
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.ORDER, patternKey: 'p31', season: 0, episode: null }));
    const placement = await resolve();
    expect(placement.assignment).toMatchObject({ season: 0, episode: 7 });
    expect(store.raiseHighWater).toHaveBeenCalledWith(3, 0, 7);
  });

  it('numbers an upload-time episode from the release time', async () => {
    const dateShow = show(3, [pattern(32, { seasonSource: 'year', episodeSource: 'date' })]);
    store.listTitleShows.mockResolvedValue([dateShow]);
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.PENDING, patternKey: 'p32', season: null, episode: null }));
    const placement = await resolve();
    expect(placement.assignment).toMatchObject({ season: 2020, episode: 8091230, dateNumbered: true });
  });

  it('numbers a title episode of a year season by the upload year', async () => {
    const yearShow = show(3, [pattern(33, { seasonSource: 'year', episodeSource: 'title' })]);
    store.listTitleShows.mockResolvedValue([yearShow]);
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.PENDING, patternKey: 'p33', season: null, episode: 20 }));
    expect((await resolve()).assignment).toMatchObject({ season: 2020, episode: 20 });
  });

  it('records an unsupported match and leaves it to the channel layout', async () => {
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.UNSUPPORTED, reason: 'part', season: 1, episode: 1 }));
    expect(await resolve()).toBeNull();
    expect(models.VideoClassification.create.mock.calls[0][0]).toMatchObject({ status: 'unsupported', show_id: 3 });
  });

  it('releases a pending row whose full title no longer matches', async () => {
    const pending = { channel_id: CHANNEL_ID, show_id: 3, status: 'pending_number', title_opt_out: false, destroy: jest.fn() };
    models.VideoClassification.findByPk.mockResolvedValue(pending);
    matcher.matchVideos.mockResolvedValue(new Map());
    expect(await resolve()).toBeNull();
    expect(pending.destroy).toHaveBeenCalled();
  });

  it('records a classification error and leaves the video to the channel layout when Python fails', async () => {
    matcher.matchVideos.mockRejectedValue(new Error('Title filter regex timed out after 15000 ms'));
    expect(await resolve()).toBeNull();
    expect(conflicts.recordError).toHaveBeenCalledWith({ youtubeId: VIDEO_ID, channelId: CHANNEL_ID, message: 'Title filter regex timed out after 15000 ms' });
  });

  it('numbers again once when the number was taken meanwhile', async () => {
    matcher.matchVideos.mockResolvedValue(match({ kind: MATCH_KIND.NUMBERED, season: 1, episode: 20 }));
    models.VideoClassification.create
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'SequelizeUniqueConstraintError' }))
      .mockImplementationOnce(async (values) => values);
    models.VideoClassification.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ youtube_id: 'heldBy00001', season: 1, episode: 20 }]);
    expect(await resolve()).toBeNull();
    expect(conflicts.recordDuplicate).toHaveBeenCalled();
  });
});
