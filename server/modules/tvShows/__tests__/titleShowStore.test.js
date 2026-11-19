jest.mock('../../../models', () => ({
  TvShow: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn(), destroy: jest.fn() },
  TvShowPattern: { destroy: jest.fn(), bulkCreate: jest.fn() },
  TvShowSeason: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';

function patternRow(id, position, extra = {}) {
  return {
    id, position, pattern_text: 'Ep {episode}', pattern_kind: 'simple', compiled_regex: '(?i)Ep\\s+(?P<episode>[0-9]+)',
    filter_regex: '(?i:Ep\\s+(?:[0-9]+))', season_source: 'fixed', season_fixed: 1, episode_source: 'title', ...extra,
  };
}

function showRow(id, extra = {}) {
  return {
    id, channel_id: CHANNEL_ID, kind: 'title', name: `Show ${id}`, folder_name: `Show ${id}`, library_folder: 'TV Shows',
    position: 0, exclude_terms: JSON.stringify(['Official Clip']), external_key: `uuid-${id}`, retired_at: null,
    patterns: [patternRow(id * 10 + 1, 1), patternRow(id * 10, 0)],
    seasons: [{ season: 1, name: 'Beyblade', order_high_water: 4 }, { season: 2, name: null, order_high_water: 0 }],
    ...extra,
  };
}

function draft(key, extra = {}) {
  return {
    id: key.startsWith('title:') ? Number(key.slice(6)) : null,
    key, position: 0, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV Shows', excludeTerms: [], seasonNames: { 1: 'Beyblade' },
    patterns: [{
      key: `${key}#0`, position: 0, text: 'Ep {episode}', kind: 'simple', compiledRegex: 'c', filterRegex: 'f',
      seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title',
    }],
    ...extra,
  };
}

describe('titleShowStore', () => {
  let store;
  let models;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    store = require('../titleShowStore');
  });

  describe('listTitleShows', () => {
    it('serializes shows with their patterns in order and their named seasons', async () => {
      models.TvShow.findAll.mockResolvedValue([showRow(3)]);
      const [show] = await store.listTitleShows(CHANNEL_ID);
      expect(show).toMatchObject({
        id: 3, key: 'title:3', name: 'Show 3', excludeTerms: ['Official Clip'], seasonNames: { 1: 'Beyblade' }, retired: false,
      });
      expect(show.patterns.map((pattern) => [pattern.id, pattern.key])).toEqual([[30, 'title:3#0'], [31, 'title:3#1']]);
    });

    it('asks only for active title shows of the channel by default', async () => {
      models.TvShow.findAll.mockResolvedValue([]);
      await store.listTitleShows(CHANNEL_ID);
      expect(models.TvShow.findAll.mock.calls[0][0].where).toEqual({ channel_id: CHANNEL_ID, kind: 'title', retired_at: null });
    });

    it('includes retired shows when asked', async () => {
      models.TvShow.findAll.mockResolvedValue([]);
      await store.listTitleShows(CHANNEL_ID, { includeRetired: true });
      expect(models.TvShow.findAll.mock.calls[0][0].where).toEqual({ channel_id: CHANNEL_ID, kind: 'title' });
    });
  });

  describe('toDraft', () => {
    it('turns a stored show back into a draft', async () => {
      models.TvShow.findAll.mockResolvedValue([showRow(3)]);
      const [show] = await store.listTitleShows(CHANNEL_ID);
      expect(store.toDraft(show)).toEqual({
        id: 3, name: 'Show 3', folderName: 'Show 3', libraryFolder: 'TV Shows', excludeTerms: ['Official Clip'],
        seasonNames: { 1: 'Beyblade' },
        patterns: [
          { text: 'Ep {episode}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' },
          { text: 'Ep {episode}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' },
        ],
      });
    });
  });

  describe('saveDefinitions', () => {
    beforeEach(() => {
      models.TvShow.findAll.mockResolvedValue([]);
      models.TvShow.create.mockImplementation(async (values) => ({ id: 9, ...values }));
      models.TvShowPattern.bulkCreate.mockImplementation(async (rows) => rows.map((row, index) => ({ id: 100 + index, ...row })));
      models.TvShowSeason.findAll.mockResolvedValue([]);
    });

    it('creates a new show with a fresh external key and returns its id', async () => {
      const { showIds } = await store.saveDefinitions({ channelId: CHANNEL_ID, drafts: [draft('new:0')] });
      expect(showIds.get('new:0')).toBe(9);
      expect(models.TvShow.create.mock.calls[0][0]).toMatchObject({
        channel_id: CHANNEL_ID, kind: 'title', name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows',
        external_key: expect.stringMatching(/^[0-9a-f-]{36}$/),
      });
    });

    it('replaces the patterns of a show and maps their keys to the new ids', async () => {
      const { patternIds } = await store.saveDefinitions({ channelId: CHANNEL_ID, drafts: [draft('new:0')] });
      expect(models.TvShowPattern.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { show_id: 9 } }));
      expect(patternIds.get('new:0#0')).toBe(100);
    });

    it('updates an existing show of the channel and clears its retirement', async () => {
      const existing = { ...showRow(3), update: jest.fn() };
      models.TvShow.findAll.mockResolvedValue([existing]);
      await store.saveDefinitions({ channelId: CHANNEL_ID, drafts: [draft('title:3', { position: 2 })] });
      expect(existing.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Beyblade', position: 2, retired_at: null }),
        expect.anything()
      );
    });

    it('refuses a show id the channel does not own', async () => {
      await expect(store.saveDefinitions({ channelId: CHANNEL_ID, drafts: [draft('title:77')] })).rejects.toMatchObject({ status: 404 });
    });

    it('retires active shows the drafts leave out', async () => {
      const left = { ...showRow(5), update: jest.fn() };
      models.TvShow.findAll.mockResolvedValue([left]);
      await store.saveDefinitions({ channelId: CHANNEL_ID, drafts: [] });
      expect(left.update).toHaveBeenCalledWith({ retired_at: expect.any(Date) }, expect.anything());
    });

    it('names a season and clears the name of one no longer named', async () => {
      const named = { season: 2, name: 'Old', update: jest.fn() };
      models.TvShowSeason.findAll.mockResolvedValue([named]);
      await store.saveDefinitions({ channelId: CHANNEL_ID, drafts: [draft('new:0')] });
      expect(models.TvShowSeason.create).toHaveBeenCalledWith({ show_id: 9, season: 1, name: 'Beyblade' }, expect.anything());
      expect(named.update).toHaveBeenCalledWith({ name: null }, expect.anything());
    });
  });

  describe('assertFolderNamesFree', () => {
    it('refuses a folder another show uses, suggesting the name with the channel', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 2, name: 'Beyblade', folder_name: 'beyblade', library_folder: 'TV Shows', channel_id: 'UCother', kind: 'title', retired_at: null }]);
      await expect(store.assertFolderNamesFree({ channelTitle: 'BEYBLADE Official', channelId: CHANNEL_ID, drafts: [draft('new:0')] }))
        .rejects.toMatchObject({ status: 409, details: { suggestion: 'Beyblade (BEYBLADE Official)' } });
    });

    it('offers to restore a retired show of the same channel at that folder', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 2, name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows', channel_id: CHANNEL_ID, kind: 'title', retired_at: new Date() }]);
      await expect(store.assertFolderNamesFree({ channelTitle: 'x', channelId: CHANNEL_ID, drafts: [draft('new:0')] }))
        .rejects.toMatchObject({ details: { retiredShowId: 2 } });
    });

    // The location index is unique, so a hand-off within one change would fail
    // partway through the save or its undo, depending on the order of the writes.
    it('refuses a folder another show of the channel gives up in the same change', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 3, name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows', channel_id: CHANNEL_ID, kind: 'title', retired_at: null }]);
      const drafts = [draft('title:3', { folderName: 'Beyblade (2001)' }), draft('new:1')];
      await expect(store.assertFolderNamesFree({ channelTitle: 'x', channelId: CHANNEL_ID, drafts })).rejects.toMatchObject({ status: 409 });
    });

    it('lets a show keep its own folder', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 3, name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows', channel_id: CHANNEL_ID, kind: 'title', retired_at: null }]);
      await expect(store.assertFolderNamesFree({ channelTitle: 'x', channelId: CHANNEL_ID, drafts: [draft('title:3')] })).resolves.toBeUndefined();
    });
  });

  describe('assertOwnShows', () => {
    it('refuses a draft naming a show of another channel', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 3 }]);
      await expect(store.assertOwnShows({ channelId: CHANNEL_ID, drafts: [draft('title:3'), draft('title:9')] }))
        .rejects.toMatchObject({ status: 404 });
    });

    it('accepts the channel\'s own shows and new ones', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 3 }]);
      await expect(store.assertOwnShows({ channelId: CHANNEL_ID, drafts: [draft('title:3'), draft('new:0')] })).resolves.toBeUndefined();
    });

    it('reads nothing when every draft is new', async () => {
      await store.assertOwnShows({ channelId: CHANNEL_ID, drafts: [draft('new:0')] });
      expect(models.TvShow.findAll).not.toHaveBeenCalled();
    });
  });

  describe('highWaterMarks', () => {
    it('reads the order high-water mark of each show season', async () => {
      models.TvShowSeason.findAll.mockResolvedValue([{ show_id: 3, season: 1, order_high_water: 4 }]);
      expect(await store.highWaterMarks([3])).toEqual(new Map([['title:3|1', 4]]));
    });
  });

  describe('raiseHighWater', () => {
    it('creates the season row when it is missing', async () => {
      models.TvShowSeason.findOne.mockResolvedValue(null);
      await store.raiseHighWater(3, 0, 5);
      expect(models.TvShowSeason.create).toHaveBeenCalledWith({ show_id: 3, season: 0, order_high_water: 5 }, expect.anything());
    });

    it('raises the mark another writer created meanwhile', async () => {
      const season = { order_high_water: 3, update: jest.fn() };
      models.TvShowSeason.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(season);
      models.TvShowSeason.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { name: 'SequelizeUniqueConstraintError' }));
      await store.raiseHighWater(3, 0, 5);
      expect(season.update).toHaveBeenCalledWith({ order_high_water: 5 }, expect.anything());
    });

    it('never lowers the mark', async () => {
      const season = { order_high_water: 9, update: jest.fn() };
      models.TvShowSeason.findOne.mockResolvedValue(season);
      await store.raiseHighWater(3, 0, 5);
      expect(season.update).not.toHaveBeenCalled();
    });
  });

  describe('titleShowIds', () => {
    it('lists every title show id of the channel, retired ones included', async () => {
      models.TvShow.findAll.mockResolvedValue([{ id: 3 }, { id: 7 }]);
      expect(await store.titleShowIds(CHANNEL_ID, { transaction: 't' })).toEqual([3, 7]);
      expect(models.TvShow.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { channel_id: CHANNEL_ID, kind: 'title' }, transaction: 't' }));
    });
  });

  describe('deleteShows', () => {
    it('deletes only title shows with the given ids', async () => {
      await store.deleteShows([7], { transaction: 't' });
      expect(models.TvShow.destroy).toHaveBeenCalledWith({ where: { id: [7], kind: 'title' }, transaction: 't' });
    });

    it('deletes nothing for no ids', async () => {
      await store.deleteShows([]);
      expect(models.TvShow.destroy).not.toHaveBeenCalled();
    });
  });

  describe('showFiltersByChannel', () => {
    it('gives each channel one download filter per active title show', async () => {
      models.TvShow.findAll.mockResolvedValue([showRow(3)]);
      const filters = await store.showFiltersByChannel([CHANNEL_ID]);
      expect(filters.get(CHANNEL_ID)).toEqual([{
        filterRegex: '(?i:Ep\\s+(?:[0-9]+))|(?i:Ep\\s+(?:[0-9]+))',
        excludeRegexes: ['(?i:Official\\s+Clip)'],
      }]);
    });
  });
});
