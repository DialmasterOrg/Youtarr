const { Op } = require('sequelize');

jest.mock('../../logger');

jest.mock('../../models/channelvideo', () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../db', () => ({
  sequelize: {
    transaction: jest.fn(async (cb) => cb('TXN')),
  },
  Sequelize: require('sequelize').Sequelize,
}));

const ChannelVideo = require('../../models/channelvideo');
const reanchor = require('../channelVideoReanchor');

const DAY = 86400000;
// Arbitrary epoch base so the numbers stay readable; absolute value is irrelevant.
const BASE = 1700000000000;
const at = (days) => BASE + days * DAY;
const NOW = at(1000);

describe('channelVideoReanchor.computeReanchoredDates (pure ordering)', () => {
  test('returns empty for empty input', () => {
    expect(reanchor.computeReanchoredDates([], NOW)).toEqual([]);
  });

  test('leaves a consistent descending list of approximate dates unchanged', () => {
    const rows = [
      { ms: at(100), source: 'approximate' },
      { ms: at(90), source: 'approximate' },
      { ms: at(80), source: 'approximate' },
    ];
    expect(reanchor.computeReanchoredDates(rows, NOW)).toEqual([at(100), at(90), at(80)]);
  });

  test('keeps exact dates exactly and never moves them', () => {
    const rows = [
      { ms: at(100), source: 'exact' },
      { ms: at(50), source: 'estimated' },
      { ms: at(60), source: 'exact' },
    ];
    const result = reanchor.computeReanchoredDates(rows, NOW);
    expect(result[0]).toBe(at(100));
    expect(result[2]).toBe(at(60));
  });

  test('an exact date inside an identical approximate cluster preserves order', () => {
    // The user's scenario: 5 videos at ~day100, open the middle one -> exact day95.
    const rows = [
      { ms: at(100), source: 'approximate' },
      { ms: at(100), source: 'approximate' },
      { ms: at(95), source: 'exact' },
      { ms: at(100), source: 'approximate' },
      { ms: at(100), source: 'approximate' },
    ];
    const result = reanchor.computeReanchoredDates(rows, NOW);
    // strictly descending => original positions preserved after a publishedAt sort
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeLessThan(result[i - 1]);
    }
    expect(result[0]).toBe(at(100)); // first sibling kept as anchor
    expect(result[2]).toBe(at(95)); // exact preserved
    // the tied sibling above the exact is pulled between day100 and day95
    expect(result[1]).toBeLessThan(at(100));
    expect(result[1]).toBeGreaterThan(at(95));
    // the siblings after the exact are pushed below it
    expect(result[3]).toBeLessThan(at(95));
    expect(result[4]).toBeLessThan(result[3]);
  });

  test('interpolates an estimated run evenly between two exact anchors', () => {
    const rows = [
      { ms: at(100), source: 'exact' },
      { ms: at(50), source: 'estimated' },
      { ms: at(50), source: 'estimated' },
      { ms: at(50), source: 'estimated' },
      { ms: at(60), source: 'exact' },
    ];
    const result = reanchor.computeReanchoredDates(rows, NOW);
    expect(result).toEqual([at(100), at(90), at(80), at(70), at(60)]);
  });

  test('steps estimated rows down by a fixed gap when there is no lower bound', () => {
    const rows = [
      { ms: at(100), source: 'exact' },
      { ms: at(50), source: 'estimated' },
      { ms: at(50), source: 'estimated' },
    ];
    const result = reanchor.computeReanchoredDates(rows, NOW);
    expect(result[0]).toBe(at(100));
    expect(result[1]).toBe(at(100) - 1000);
    expect(result[2]).toBe(at(100) - 2000);
  });

  test('uses now as the upper bound for an estimated run at the newest end', () => {
    const rows = [
      { ms: at(50), source: 'estimated' },
      { ms: at(50), source: 'estimated' },
      { ms: at(100), source: 'exact' },
    ];
    const result = reanchor.computeReanchoredDates(rows, NOW);
    expect(result[0]).toBeLessThan(NOW);
    expect(result[1]).toBeLessThan(result[0]);
    expect(result[2]).toBe(at(100));
    expect(result[1]).toBeGreaterThan(at(100));
  });

  test('reassigns an out-of-order approximate date to preserve position', () => {
    const rows = [
      { ms: at(80), source: 'approximate' },
      { ms: at(100), source: 'approximate' }, // violates: newer date but older position
    ];
    const result = reanchor.computeReanchoredDates(rows, NOW);
    expect(result[0]).toBe(at(80));
    expect(result[1]).toBeLessThan(at(80));
  });

  test('treats null-source legacy rows as approximate anchors when consistent', () => {
    const rows = [
      { ms: at(100), source: null },
      { ms: at(90), source: null },
    ];
    expect(reanchor.computeReanchoredDates(rows, NOW)).toEqual([at(100), at(90)]);
  });
});

describe('channelVideoReanchor.applyExactDateForGroup (DB wrapper)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const args = {
    channelId: 'UC1',
    mediaType: 'video',
    youtubeId: 'vid-mid',
    exactIso: '2026-05-07T00:00:00.000Z',
  };

  test('no-ops when the row already holds this exact date', async () => {
    ChannelVideo.findOne.mockResolvedValue({
      publishedAt: '2026-05-07T00:00:00.000Z',
      published_at_source: 'exact',
      update: jest.fn(),
    });

    await reanchor.applyExactDateForGroup(args);

    expect(ChannelVideo.count).not.toHaveBeenCalled();
    expect(ChannelVideo.findAll).not.toHaveBeenCalled();
  });

  test('fast path: writes only the target when ordering is not broken', async () => {
    const update = jest.fn();
    ChannelVideo.findOne.mockResolvedValue({
      publishedAt: '2026-05-08T00:00:00.000Z',
      published_at_source: 'approximate',
      update,
    });
    ChannelVideo.count.mockResolvedValue(0); // no tie sibling, nothing between

    await reanchor.applyExactDateForGroup(args);

    expect(update).toHaveBeenCalledWith({
      publishedAt: args.exactIso,
      published_at_source: 'exact',
    });
    expect(ChannelVideo.findAll).not.toHaveBeenCalled();
  });

  test('full repair: re-anchors and writes changed rows when a tie sibling exists', async () => {
    ChannelVideo.findOne.mockResolvedValue({
      publishedAt: '2026-05-12T00:00:00.000Z',
      published_at_source: 'approximate',
      update: jest.fn(),
    });
    // tie-sibling check returns > 0 -> full repair
    ChannelVideo.count.mockResolvedValue(2);

    // Two siblings at the same date as the target, one before and one after it.
    ChannelVideo.findAll.mockResolvedValue([
      { id: 1, youtube_id: 'before', publishedAt: '2026-05-12T00:00:00.000Z', published_at_source: 'approximate' },
      { id: 2, youtube_id: 'vid-mid', publishedAt: '2026-05-12T00:00:00.000Z', published_at_source: 'approximate' },
      { id: 3, youtube_id: 'after', publishedAt: '2026-05-12T00:00:00.000Z', published_at_source: 'approximate' },
    ]);

    await reanchor.applyExactDateForGroup(args);

    // The target gets the exact date + source.
    expect(ChannelVideo.update).toHaveBeenCalledWith(
      { publishedAt: args.exactIso, published_at_source: 'exact' },
      { where: { id: 2 }, transaction: 'TXN' },
    );
    // The trailing sibling (after the exact date) is pushed below it, source untouched.
    const afterCall = ChannelVideo.update.mock.calls.find((c) => c[1].where.id === 3);
    expect(afterCall).toBeDefined();
    expect(afterCall[0].published_at_source).toBeUndefined();
    expect(new Date(afterCall[0].publishedAt).getTime()).toBeLessThan(new Date(args.exactIso).getTime());
  });

  test('returns without writing when the target row does not exist', async () => {
    ChannelVideo.findOne.mockResolvedValue(null);
    await reanchor.applyExactDateForGroup(args);
    expect(ChannelVideo.count).not.toHaveBeenCalled();
    expect(ChannelVideo.update).not.toHaveBeenCalled();
  });
});

describe('channelVideoReanchor._orderWouldBreak', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns false when the date is unchanged', async () => {
    const result = await reanchor._orderWouldBreak('UC1', 'video', 'v', '2026-05-07T00:00:00.000Z', '2026-05-07T00:00:00.000Z');
    expect(result).toBe(false);
    expect(ChannelVideo.count).not.toHaveBeenCalled();
  });

  test('returns true when a tie sibling shares the old date', async () => {
    ChannelVideo.count.mockResolvedValueOnce(1);
    const result = await reanchor._orderWouldBreak('UC1', 'video', 'v', '2026-05-12T00:00:00.000Z', '2026-05-07T00:00:00.000Z');
    expect(result).toBe(true);
  });

  test('checks the older-positioned window when the new date is older', async () => {
    ChannelVideo.count
      .mockResolvedValueOnce(0) // no tie
      .mockResolvedValueOnce(0); // nothing strictly between
    const result = await reanchor._orderWouldBreak('UC1', 'video', 'v', '2026-05-12T00:00:00.000Z', '2026-05-07T00:00:00.000Z');
    expect(result).toBe(false);
    const betweenWhere = ChannelVideo.count.mock.calls[1][0].where;
    expect(betweenWhere.publishedAt[Op.lt]).toBe('2026-05-12T00:00:00.000Z');
    expect(betweenWhere.publishedAt[Op.gt]).toBe('2026-05-07T00:00:00.000Z');
  });
});
