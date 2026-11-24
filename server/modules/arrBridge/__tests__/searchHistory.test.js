/* eslint-env jest */
const { Op } = require('sequelize');
const { createSearchHistory, RETENTION_DAYS, MAX_ROWS } = require('../searchHistory');

const AT = new Date('2025-06-01T10:00:00.000Z');
const NOW = new Date('2025-06-01T10:00:05.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KEPT_SINCE = new Date(NOW.getTime() - RETENTION_DAYS * DAY_MS);

const asked = (overrides = {}) => ({
  text: 'Beyblade', textSource: 'title', season: null, episode: null, year: null, month: null, day: null, limit: 100,
  ...overrides,
});

const STAGES = [{
  matcher: 'episode-code',
  query: 'Beyblade S01E29',
  results: 1,
  candidates: [{
    youtubeId: 'aaaaaaaaaaa', title: 'Video', channelName: 'Uploads', duration: 1320,
    outcome: 'offered', reason: null, releaseTitle: 'Beyblade.S01E29.1080p.YT.WEB-DL-Uploads',
  }],
}];

const entry = (overrides = {}) => ({
  at: AT,
  kind: 'tv',
  shape: 'episode',
  asked: asked({ season: 1, episode: 29 }),
  outcome: 'offered',
  offered: 1,
  note: null,
  titleStageSkipped: null,
  stages: STAGES,
  ...overrides,
});

const placeholder = (kind, at = AT) => entry({
  at, kind, shape: 'rss', asked: asked({ text: null, textSource: null }), outcome: 'not-searched', offered: 0,
  note: 'no-query', stages: [],
});

function setup({ foldedRow = null, boundaryRow = null } = {}) {
  const ArrBridgeSearch = {
    findOne: jest.fn().mockResolvedValue(foldedRow),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(0),
    findAll: jest.fn().mockResolvedValue(boundaryRow ? [boundaryRow] : []),
    findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
  };
  const logger = { warn: jest.fn() };
  const clock = { now: NOW };
  const history = createSearchHistory({ models: { ArrBridgeSearch }, logger, now: () => clock.now });
  return { history, ArrBridgeSearch, logger, clock };
}

describe('searchHistory', () => {
  describe('record', () => {
    test('stores a search as one row, its details as JSON text', async () => {
      const { history, ArrBridgeSearch } = setup();

      await history.record(entry());

      expect(ArrBridgeSearch.create).toHaveBeenCalledWith({
        at: AT,
        first_at: AT,
        count: 1,
        kind: 'tv',
        shape: 'episode',
        outcome: 'offered',
        offered: 1,
        note: null,
        title_stage_skipped: null,
        search_text: 'Beyblade S01E29',
        asked: JSON.stringify(asked({ season: 1, episode: 29 })),
        stages: JSON.stringify(STAGES),
      });
    });

    test.each([
      ['an episode', { season: 1, episode: 29 }, 'Beyblade S01E29'],
      ['a season', { season: 2 }, 'Beyblade S02 season 2'],
      ['an air date', { year: 2024, month: 5, day: 1 }, 'Beyblade 2024-05-01'],
      ['a movie', { year: 1999 }, 'Beyblade (1999)'],
      ['a name alone', {}, 'Beyblade'],
      ['no name', { text: null, season: 1, episode: 2 }, 'S01E02'],
    ])('the search box text of %s holds what the row shows', async (_name, fields, expected) => {
      const { history, ArrBridgeSearch } = setup();

      await history.record(entry({ asked: asked(fields) }));

      expect(ArrBridgeSearch.create.mock.calls[0][0].search_text).toBe(expected);
    });

    test('a request that asked for nothing has no search box text', async () => {
      const { history, ArrBridgeSearch } = setup();

      await history.record(placeholder('tv'));

      expect(ArrBridgeSearch.create.mock.calls[0][0].search_text).toBeNull();
    });

    describe('the no-query feed, asked on every RSS sync', () => {
      test('gets a row of its own the first time', async () => {
        const { history, ArrBridgeSearch } = setup();

        await history.record(placeholder('movie'));

        expect(ArrBridgeSearch.findOne).toHaveBeenCalledWith({ where: { note: 'no-query', kind: 'movie' } });
        expect(ArrBridgeSearch.create).toHaveBeenCalledWith(expect.objectContaining({ kind: 'movie', count: 1 }));
      });

      test('counts a later request on the row of its kind, at the time of that request', async () => {
        const { history, ArrBridgeSearch } = setup({ foldedRow: { id: 7, count: 4 } });
        const later = new Date(AT.getTime() + 15 * 60 * 1000);

        await history.record(placeholder('tv', later));

        expect(ArrBridgeSearch.update).toHaveBeenCalledWith({ at: later, count: 5 }, { where: { id: 7 } });
        expect(ArrBridgeSearch.create).not.toHaveBeenCalled();
      });

      test('does not fold other requests that ran no search', async () => {
        const { history, ArrBridgeSearch } = setup({ foldedRow: { id: 7, count: 4 } });

        await history.record(entry({ shape: 'empty', outcome: 'not-searched', offered: 0, note: 'no-season', stages: [] }));

        expect(ArrBridgeSearch.findOne).not.toHaveBeenCalled();
        expect(ArrBridgeSearch.create).toHaveBeenCalledTimes(1);
      });
    });

    test('a write that fails is logged and never rejects, and later searches are still stored', async () => {
      const { history, ArrBridgeSearch, logger } = setup();
      const failure = new Error('db down');
      ArrBridgeSearch.create.mockRejectedValueOnce(failure);

      await expect(history.record(entry())).resolves.toBeUndefined();
      await history.record(entry({ asked: asked({ text: 'Bluey' }) }));

      expect(logger.warn).toHaveBeenCalledWith({ err: failure }, expect.any(String));
      expect(ArrBridgeSearch.create).toHaveBeenCalledTimes(2);
    });

    test('writes one search at a time, in the order they were answered', async () => {
      const { history, ArrBridgeSearch } = setup();
      let finishFirst;
      ArrBridgeSearch.create.mockImplementationOnce(() => new Promise((resolve) => {
        finishFirst = resolve;
      }));

      const first = history.record(entry());
      const second = history.record(entry({ asked: asked({ text: 'Bluey' }) }));
      await Promise.resolve();
      await Promise.resolve();

      expect(ArrBridgeSearch.create).toHaveBeenCalledTimes(1);

      finishFirst({});
      await Promise.all([first, second]);

      expect(ArrBridgeSearch.create.mock.calls.map(([row]) => row.search_text)).toEqual(['Beyblade S01E29', 'Bluey']);
    });
  });

  describe('pruning', () => {
    test('removes searches past the retention after a write', async () => {
      const { history, ArrBridgeSearch } = setup();

      await history.record(entry());

      expect(ArrBridgeSearch.destroy).toHaveBeenCalledTimes(1);
      expect(ArrBridgeSearch.destroy).toHaveBeenCalledWith({ where: { at: { [Op.lt]: KEPT_SINCE } } });
    });

    test('past the row limit, removes everything older than the last row kept', async () => {
      const boundaryAt = new Date('2025-05-20T08:00:00.000Z');
      const { history, ArrBridgeSearch } = setup({ boundaryRow: { at: boundaryAt } });

      await history.record(entry());

      expect(ArrBridgeSearch.findAll).toHaveBeenCalledWith({
        attributes: ['at'],
        order: [['at', 'DESC'], ['id', 'DESC']],
        offset: MAX_ROWS - 1,
        limit: 1,
        raw: true,
      });
      expect(ArrBridgeSearch.destroy).toHaveBeenLastCalledWith({ where: { at: { [Op.lt]: boundaryAt } } });
    });

    test('runs at most once an hour', async () => {
      const { history, ArrBridgeSearch, clock } = setup();

      await history.record(entry());
      clock.now = new Date(NOW.getTime() + HOUR_MS - 1000);
      await history.record(entry());

      expect(ArrBridgeSearch.destroy).toHaveBeenCalledTimes(1);

      clock.now = new Date(NOW.getTime() + HOUR_MS);
      await history.record(entry());

      expect(ArrBridgeSearch.destroy).toHaveBeenCalledTimes(2);
    });

    test('a prune that fails is tried again with the next write', async () => {
      const { history, ArrBridgeSearch, logger } = setup();
      ArrBridgeSearch.destroy.mockRejectedValueOnce(new Error('locked'));

      await history.record(entry());
      await history.record(entry());

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(ArrBridgeSearch.destroy).toHaveBeenCalledTimes(2);
    });
  });

  describe('list', () => {
    const row = (overrides = {}) => ({
      id: 12,
      at: AT,
      first_at: AT,
      count: 1,
      kind: 'tv',
      shape: 'episode',
      outcome: 'offered',
      offered: 1,
      note: null,
      title_stage_skipped: 'no-runtime',
      search_text: 'Beyblade S01E29',
      asked: JSON.stringify(asked({ season: 1, episode: 29 })),
      stages: JSON.stringify(STAGES),
      ...overrides,
    });

    test('reads one page, newest first, with the number of searches there are', async () => {
      const { history, ArrBridgeSearch } = setup();
      ArrBridgeSearch.findAndCountAll.mockResolvedValue({ rows: [row()], count: 31 });

      const result = await history.list({ page: '2', pageSize: '10' });

      expect(ArrBridgeSearch.findAndCountAll).toHaveBeenCalledWith({
        where: { at: { [Op.gte]: KEPT_SINCE } },
        order: [['at', 'DESC'], ['id', 'DESC']],
        limit: 10,
        offset: 10,
        raw: true,
      });
      expect(result).toEqual({
        searches: [{
          id: 12,
          at: AT,
          firstAt: AT,
          count: 1,
          kind: 'tv',
          shape: 'episode',
          asked: asked({ season: 1, episode: 29 }),
          outcome: 'offered',
          offered: 1,
          note: null,
          titleStageSkipped: 'no-runtime',
          stages: STAGES,
        }],
        total: 31,
        page: 2,
        pageSize: 10,
      });
    });

    test('a search text must match in every word', async () => {
      const { history, ArrBridgeSearch } = setup();

      await history.list({ q: 'beyblade s01e29' });

      expect(ArrBridgeSearch.findAndCountAll.mock.calls[0][0].where).toEqual({
        at: { [Op.gte]: KEPT_SINCE },
        [Op.and]: [
          { search_text: { [Op.like]: '%beyblade%' } },
          { search_text: { [Op.like]: '%s01e29%' } },
        ],
      });
    });

    test('lists nothing past the retention, even when no write has pruned it yet', async () => {
      const { history, ArrBridgeSearch, clock } = setup();
      clock.now = new Date(NOW.getTime() + 10 * DAY_MS);

      await history.list();

      expect(ArrBridgeSearch.findAndCountAll.mock.calls[0][0].where).toEqual({
        at: { [Op.gte]: new Date(KEPT_SINCE.getTime() + 10 * DAY_MS) },
      });
      expect(ArrBridgeSearch.destroy).not.toHaveBeenCalled();
    });

    test('a row whose details cannot be read is listed without them', async () => {
      const { history, ArrBridgeSearch } = setup();
      ArrBridgeSearch.findAndCountAll.mockResolvedValue({ rows: [row({ asked: '{', stages: 'null' })], count: 1 });

      const { searches } = await history.list();

      expect(searches[0]).toMatchObject({
        id: 12,
        asked: { text: null, textSource: null, season: null, episode: null, year: null, month: null, day: null, limit: null },
        stages: [],
      });
    });
  });
});
