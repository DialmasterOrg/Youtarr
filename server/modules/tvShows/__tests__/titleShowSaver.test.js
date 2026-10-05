jest.mock('../../../db', () => ({ sequelize: { transaction: jest.fn(async (fn) => fn('t')) } }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(() => 'TV Shows'), directoryPath: '/d' }));
jest.mock('../libraryLayouts', () => ({
  getLayoutResolver: jest.fn(async () => (folder) => (folder === 'TV Shows' ? 'tv' : 'videos')),
  listTvFolders: jest.fn(async () => ['TV Shows']),
}));
jest.mock('../channelFolders', () => ({ effectiveLibraryFolder: jest.fn(() => 'Kids') }));
jest.mock('../titleShowDrafts', () => ({
  ...jest.requireActual('../titleShowDrafts'),
  assertDraftsCompile: jest.fn(),
}));
jest.mock('../titleShowStore', () => ({
  assertFolderNamesFree: jest.fn(), highWaterMarks: jest.fn(async () => new Map()), listTitleShows: jest.fn(async () => []),
}));
jest.mock('../titlePlanner', () => ({ planChannel: jest.fn() }));
jest.mock('../titleRowWriter', () => ({
  applyPlan: jest.fn(),
  isRowChangedError: jest.fn((err) => Boolean(err) && err.code === 'ROW_CHANGED'),
}));
jest.mock('../archiveSuppressor', () => ({ flush: jest.fn() }));
jest.mock('../layoutGuards', () => ({
  reorganizeRequiredError: jest.fn((message, change) => Object.assign(new Error(message), { status: 409, reorganizeRequired: true, change })),
}));
jest.mock('../../reorganize/reorganizeLock', () => ({ assertChannelFree: jest.fn(), coversChannel: jest.fn(() => false) }));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';
const channel = { channel_id: CHANNEL_ID, title: 'BEYBLADE Official', sub_folder: 'Kids' };
const rawShows = [{
  name: 'Beyblade',
  patterns: [{ text: 'BEYBLADE EN Episode {episode}: {title}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }],
}];

function plan(requiresReorganize) {
  return { requiresReorganize, entries: [], duplicates: [], highWater: new Map(), storedShows: new Map() };
}

describe('titleShowSaver', () => {
  let saver;
  let planner;
  let writer;
  let suppressor;
  let lock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    planner = require('../titlePlanner');
    writer = require('../titleRowWriter');
    suppressor = require('../archiveSuppressor');
    lock = require('../../reorganize/reorganizeLock');
    saver = require('../titleShowSaver');
  });

  describe('prepare', () => {
    it('defaults new shows to the default TV folder', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      const { drafts } = await saver.prepare({ channel, rawShows });
      expect(drafts[0].libraryFolder).toBe('TV Shows');
    });

    it('plans the channel with the normalized drafts and overrides', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      await saver.prepare({ channel, rawShows, rawOverrides: [{ youtubeId: 'abcdefghijk', notAnEpisode: true }] });
      expect(planner.planChannel).toHaveBeenCalledWith({
        channel,
        drafts: [expect.objectContaining({ key: 'new:0' })],
        overrides: new Map([['abcdefghijk', { optOut: true }]]),
        downloadsDir: '/d',
      });
    });

    it('maps a return to automatic classification', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      await saver.prepare({ channel, rawShows, rawOverrides: [{ youtubeId: 'abcdefghijk', automatic: true }] });
      expect(planner.planChannel.mock.calls[0][0].overrides.get('abcdefghijk')).toEqual({ reset: true });
    });

    it('maps an assignment to a show of the drafts', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      await saver.prepare({
        channel,
        rawShows: [{ ...rawShows[0], id: 3 }],
        rawOverrides: [{ youtubeId: 'abcdefghijk', showId: 3, season: 1, episode: 49 }],
      });
      expect(planner.planChannel.mock.calls[0][0].overrides.get('abcdefghijk')).toEqual({ showKey: 'title:3', season: 1, episode: 49 });
    });

    it('refuses an assignment to a show the channel doesn\'t have', async () => {
      await expect(saver.prepare({ channel, rawShows, rawOverrides: [{ youtubeId: 'abcdefghijk', showId: 77, season: 1, episode: 2 }] }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('accepts an assignment to an upload-year season', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      await saver.prepare({
        channel,
        rawShows: [{ ...rawShows[0], id: 3 }],
        rawOverrides: [{ youtubeId: 'abcdefghijk', showId: 3, season: 2024, episode: 5 }],
      });
      expect(planner.planChannel.mock.calls[0][0].overrides.get('abcdefghijk')).toEqual({ showKey: 'title:3', season: 2024, episode: 5 });
    });

    it('refuses a season between the title and year ranges', async () => {
      await expect(saver.prepare({
        channel, rawShows: [{ ...rawShows[0], id: 3 }], rawOverrides: [{ youtubeId: 'abcdefghijk', showId: 3, season: 200, episode: 5 }],
      })).rejects.toMatchObject({ status: 400 });
    });

    it('refuses an episode number out of range', async () => {
      await expect(saver.prepare({
        channel, rawShows: [{ ...rawShows[0], id: 3 }], rawOverrides: [{ youtubeId: 'abcdefghijk', showId: 3, season: 1, episode: 0 }],
      })).rejects.toMatchObject({ status: 400 });
    });

    it('refuses an override for an invalid video id', async () => {
      await expect(saver.prepare({ channel, rawShows, rawOverrides: [{ youtubeId: '../x', notAnEpisode: true }] }))
        .rejects.toMatchObject({ status: 400 });
    });
  });

  describe('save', () => {
    it('asks for the reorganize when downloaded videos would move', async () => {
      planner.planChannel.mockResolvedValue(plan(true));
      await expect(saver.save({ channel, rawShows })).rejects.toMatchObject({
        status: 409,
        reorganizeRequired: true,
        change: { type: 'titleShows', channelId: CHANNEL_ID, shows: rawShows, overrides: [] },
      });
      expect(writer.applyPlan).not.toHaveBeenCalled();
    });

    it('writes the plan and then the archive changes when nothing moves', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      await saver.save({ channel, rawShows });
      expect(writer.applyPlan).toHaveBeenCalledWith(expect.objectContaining({ channel, transaction: 't' }));
      expect(suppressor.flush.mock.invocationCallOrder[0]).toBeGreaterThan(writer.applyPlan.mock.invocationCallOrder[0]);
    });

    it('plans again once when a download took a number meanwhile', async () => {
      const unique = Object.assign(new Error('dup'), { name: 'SequelizeUniqueConstraintError' });
      planner.planChannel.mockResolvedValue(plan(false));
      writer.applyPlan.mockRejectedValueOnce(unique);
      await saver.save({ channel, rawShows });
      expect(planner.planChannel).toHaveBeenCalledTimes(2);
    });

    it('plans again once when a download changed an episode row meanwhile', async () => {
      planner.planChannel.mockResolvedValue(plan(false));
      writer.applyPlan.mockRejectedValueOnce(Object.assign(new Error('changed'), { code: 'ROW_CHANGED' }));
      await saver.save({ channel, rawShows });
      expect(planner.planChannel).toHaveBeenCalledTimes(2);
    });

    it('refuses while a reorganize moves the channel\'s files', async () => {
      lock.assertChannelFree.mockImplementation(() => { throw Object.assign(new Error('busy'), { status: 409 }); });
      await expect(saver.save({ channel, rawShows })).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('applyPrepared', () => {
    it('writes a prepared plan in a transaction and returns the saved show ids', async () => {
      writer.applyPlan.mockResolvedValue({ showIds: new Map([['new:0', 9]]), patternIds: new Map() });
      const result = await saver.applyPrepared({ channel, drafts: [], plan: plan(true) });
      expect([result.showIds.get('new:0'), writer.applyPlan.mock.calls[0][0].transaction]).toEqual([9, 't']);
      expect(suppressor.flush).toHaveBeenCalled();
    });
  });

  describe('classifyNew', () => {
    const storedShow = {
      id: 3, key: 'title:3', name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV Shows', position: 0,
      excludeTerms: [], seasonNames: {}, patterns: [{ id: 30, key: 'title:3#0', compiledRegex: 'x', filterRegex: 'f' }],
    };

    it('does nothing for a channel without title shows', async () => {
      await saver.classifyNew({ channel, youtubeIds: ['abcdefghijk'] });
      expect(planner.planChannel).not.toHaveBeenCalled();
    });

    it('classifies only the new videos with the stored shows, without saving them again', async () => {
      require('../titleShowStore').listTitleShows.mockResolvedValue([storedShow]);
      planner.planChannel.mockResolvedValue(plan(false));
      await saver.classifyNew({ channel, youtubeIds: ['abcdefghijk'] });
      expect(planner.planChannel).toHaveBeenCalledWith({ channel, drafts: [storedShow], onlyIds: new Set(['abcdefghijk']), downloadsDir: '/d' });
      expect(writer.applyPlan.mock.calls[0][0].definitions).toEqual({
        showIds: new Map([['title:3', 3]]), patternIds: new Map([['title:3#0', 30]]),
      });
    });

    it('leaves out downloaded videos whose files would have to move', async () => {
      require('../titleShowStore').listTitleShows.mockResolvedValue([storedShow]);
      planner.planChannel.mockResolvedValue({ ...plan(true), entries: [{ youtubeId: 'a', moves: true }, { youtubeId: 'b', moves: false }] });
      await saver.classifyNew({ channel, youtubeIds: ['a', 'b'] });
      expect(writer.applyPlan.mock.calls[0][0].plan.entries).toEqual([{ youtubeId: 'b', moves: false }]);
    });

    it('classifies again once when a download changed an episode row meanwhile', async () => {
      require('../titleShowStore').listTitleShows.mockResolvedValue([storedShow]);
      planner.planChannel.mockResolvedValue(plan(false));
      writer.applyPlan.mockRejectedValueOnce(Object.assign(new Error('changed'), { code: 'ROW_CHANGED' }));
      await saver.classifyNew({ channel, youtubeIds: ['abcdefghijk'] });
      expect(planner.planChannel).toHaveBeenCalledTimes(2);
    });

    it('waits for a running reorganize of the channel', async () => {
      require('../titleShowStore').listTitleShows.mockResolvedValue([storedShow]);
      lock.coversChannel.mockReturnValue(true);
      await saver.classifyNew({ channel, youtubeIds: ['a'] });
      expect(planner.planChannel).not.toHaveBeenCalled();
    });
  });
});
