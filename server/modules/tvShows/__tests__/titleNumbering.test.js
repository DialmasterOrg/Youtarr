const { planNumbers, computeGaps, ROW_STATUS } = require('../titleNumbering');
const { MATCH_KIND } = require('../titleMatcher');

const DAY = 24 * 60 * 60 * 1000;

function video(youtubeId, { daysAgo = 0, available = true, downloaded = false } = {}) {
  return { youtubeId, title: youtubeId, publishedAtMs: 1e12 - daysAgo * DAY, available, downloaded };
}

function numbered(episode, extra = {}) {
  return { showKey: 'title:1', patternKey: 'p1', kind: MATCH_KIND.NUMBERED, season: 1, episode, episodeTitle: `Ep ${episode}`, reason: null, ...extra };
}

function stored(values) {
  return { showKind: 'title', showActive: true, titleOptOut: false, patternKey: 'p1', fileStem: null, episodeTitle: null, ...values };
}

function plan({ videos, matches = new Map(), storedRows = new Map(), highWater = new Map(), overrides = new Map() }) {
  return planNumbers({ videos, matches, stored: storedRows, highWater, overrides });
}

describe('titleNumbering.planNumbers', () => {
  it('assigns a title-numbered match its captured season and episode', () => {
    const result = plan({ videos: [video('a')], matches: new Map([['a', numbered(20)]]) });
    expect(result.rows.get('a')).toMatchObject({
      showKey: 'title:1', status: ROW_STATUS.ASSIGNED, season: 1, episode: 20, source: 'title', episodeTitle: 'Ep 20',
    });
  });

  it('gives a shared number to the earliest upload and marks the later one a duplicate', () => {
    const result = plan({
      videos: [video('new', { daysAgo: 10 }), video('old', { daysAgo: 700 })],
      matches: new Map([['new', numbered(20)], ['old', numbered(20)]]),
    });
    expect(result.duplicates).toEqual([{ youtubeId: 'new', showKey: 'title:1', season: 1, episode: 20, duplicateOf: 'old' }]);
  });

  it('stores a duplicate without a number', () => {
    const result = plan({
      videos: [video('new', { daysAgo: 10 }), video('old', { daysAgo: 700 })],
      matches: new Map([['new', numbered(20)], ['old', numbered(20)]]),
    });
    expect(result.rows.get('new')).toMatchObject({ status: ROW_STATUS.DUPLICATE, season: null, episode: null });
  });

  it('prefers an available upload over an earlier unavailable one', () => {
    const result = plan({
      videos: [video('gone', { daysAgo: 700, available: false }), video('here', { daysAgo: 10 })],
      matches: new Map([['gone', numbered(5)], ['here', numbered(5)]]),
    });
    expect(result.rows.get('here').status).toBe(ROW_STATUS.ASSIGNED);
  });

  it('keeps the number with its stored holder even when an earlier upload appears', () => {
    const result = plan({
      videos: [video('holder', { daysAgo: 10 }), video('earlier', { daysAgo: 700 })],
      matches: new Map([['holder', numbered(20)], ['earlier', numbered(20)]]),
      storedRows: new Map([['holder', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 20, source: 'title' })]]),
    });
    expect(result.rows.get('earlier').status).toBe(ROW_STATUS.DUPLICATE);
  });

  it('allocates order numbers after the season high-water mark, oldest upload first', () => {
    const order = { kind: MATCH_KIND.ORDER, showKey: 'title:2', patternKey: 'p2', season: 0, episode: null, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('b', { daysAgo: 1 }), video('a', { daysAgo: 5 })],
      matches: new Map([['a', order], ['b', order]]),
      highWater: new Map([['title:2|0', 7]]),
    });
    expect([result.rows.get('a').episode, result.rows.get('b').episode]).toEqual([8, 9]);
  });

  it('raises the high-water mark past the numbers it allocates', () => {
    const order = { kind: MATCH_KIND.ORDER, showKey: 'title:2', patternKey: 'p2', season: 0, episode: null, episodeTitle: null, reason: null };
    const result = plan({ videos: [video('a')], matches: new Map([['a', order]]), highWater: new Map([['title:2|0', 7]]) });
    expect(result.highWater.get('title:2|0')).toBe(8);
  });

  it('keeps an order number the video already holds in the season', () => {
    const order = { kind: MATCH_KIND.ORDER, showKey: 'title:2', patternKey: 'p2', season: 0, episode: null, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a')],
      matches: new Map([['a', order]]),
      storedRows: new Map([['a', stored({ showKey: 'title:2', status: 'assigned', season: 0, episode: 3, source: 'order' })]]),
      highWater: new Map([['title:2|0', 9]]),
    });
    expect(result.rows.get('a').episode).toBe(3);
  });

  it('skips order numbers other rows of the season hold', () => {
    const order = { kind: MATCH_KIND.ORDER, showKey: 'title:1', patternKey: 'p2', season: 1, episode: null, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('t'), video('o')],
      matches: new Map([['t', numbered(1)], ['o', order]]),
    });
    expect(result.rows.get('o').episode).toBe(2);
  });

  it('marks a pending match pending_number without a number', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: null, episodeTitle: null, reason: null };
    const result = plan({ videos: [video('a')], matches: new Map([['a', pending]]) });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.PENDING, season: null, episode: null });
  });

  it('keeps the number of a downloaded pending match already numbered in the show', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: null, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a', { downloaded: true })],
      matches: new Map([['a', pending]]),
      storedRows: new Map([['a', stored({ showKey: 'title:1', status: 'assigned', season: 2024, episode: 3151200, source: 'date' })]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.ASSIGNED, season: 2024, episode: 3151200, source: 'date' });
  });

  it('waits for the upload year when the stored number comes from a fixed season', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: 30, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a')],
      matches: new Map([['a', pending]]),
      storedRows: new Map([['a', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 30, source: 'title' })]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.PENDING, season: null, episode: null });
  });

  it('waits for the upload year when the title now gives another episode', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: 31, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a')],
      matches: new Map([['a', pending]]),
      storedRows: new Map([['a', stored({ showKey: 'title:1', status: 'assigned', season: 2021, episode: 30, source: 'title' })]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.PENDING });
  });

  it('keeps the upload-year number of a deleted download', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: 30, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a')],
      matches: new Map([['a', pending]]),
      storedRows: new Map([['a', stored({ showKey: 'title:1', status: 'assigned', season: 2021, episode: 30, source: 'title' })]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.ASSIGNED, season: 2021, episode: 30 });
  });

  it('keeps the duplicate verdict of a downloaded pending match decided at its download', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: 5, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a', { downloaded: true })],
      matches: new Map([['a', pending]]),
      storedRows: new Map([['a', stored({ showKey: 'title:1', status: 'duplicate', season: null, episode: null, source: 'title' })]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.DUPLICATE, keep: true });
  });

  it('classifies a pending match again for a duplicate that is not downloaded', () => {
    const pending = { kind: MATCH_KIND.PENDING, showKey: 'title:1', patternKey: 'p3', season: null, episode: 5, episodeTitle: null, reason: null };
    const result = plan({
      videos: [video('a')],
      matches: new Map([['a', pending]]),
      storedRows: new Map([['a', stored({ showKey: 'title:1', status: 'duplicate', season: null, episode: null, source: 'title' })]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.PENDING });
  });

  it('records an unsupported match with its reason', () => {
    const compilation = numbered(19, { kind: MATCH_KIND.UNSUPPORTED, reason: 'compilation', episodeEnd: 20 });
    const result = plan({ videos: [video('c')], matches: new Map([['c', compilation]]) });
    expect(result.unsupported).toEqual([expect.objectContaining({ youtubeId: 'c', reason: 'compilation', episode: 19, episodeEnd: 20 })]);
  });

  it('never puts an opted-out video back into a title show', () => {
    const optedOut = stored({ showKey: 'title:1', status: 'opted_out', season: null, episode: null, source: null, titleOptOut: true });
    const result = plan({ videos: [video('a')], matches: new Map([['a', numbered(4)]]), storedRows: new Map([['a', optedOut]]) });
    expect(result.rows.get('a')).toMatchObject({ status: 'opted_out', keep: true });
  });

  it('leaves a manual assignment untouched', () => {
    const manual = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 49, source: 'manual' });
    const result = plan({ videos: [video('a')], matches: new Map([['a', numbered(4)]]), storedRows: new Map([['a', manual]]) });
    expect(result.rows.get('a')).toMatchObject({ episode: 49, source: 'manual', keep: true });
  });

  it('makes title claimants of a manually assigned number duplicates of it', () => {
    const manual = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 4, source: 'manual' });
    const result = plan({
      videos: [video('m'), video('t', { daysAgo: 900 })],
      matches: new Map([['t', numbered(4)]]),
      storedRows: new Map([['m', manual]]),
    });
    expect(result.duplicates).toEqual([expect.objectContaining({ youtubeId: 't', duplicateOf: 'm' })]);
  });

  it('releases the row of a video that no longer matches its title show', () => {
    const row = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 4, source: 'title' });
    const result = plan({ videos: [video('a')], storedRows: new Map([['a', row]]) });
    expect(result.rows.get('a')).toBeNull();
  });

  it('keeps the order number of a retired show\'s video that matches nothing', () => {
    const row = stored({ showKey: 'title:9', showActive: false, status: 'assigned', season: 0, episode: 2, source: 'order' });
    const result = plan({ videos: [video('a')], storedRows: new Map([['a', row]]) });
    expect(result.rows.get('a')).toMatchObject({ episode: 2, keep: true });
  });

  it('keeps a channel-show episode that matches no title show', () => {
    const row = stored({ showKey: 'channel:UC1', showKind: 'channel', status: 'assigned', season: 2024, episode: 1010101, source: 'date' });
    const result = plan({ videos: [video('a', { downloaded: true })], storedRows: new Map([['a', row]]) });
    expect(result.rows.get('a')).toMatchObject({ showKey: 'channel:UC1', keep: true });
  });

  it('moves a channel-show episode into a title show it now matches', () => {
    const row = stored({ showKey: 'channel:UC1', showKind: 'channel', status: 'assigned', season: 2024, episode: 1010101, source: 'date' });
    const result = plan({ videos: [video('a', { downloaded: true })], matches: new Map([['a', numbered(7)]]), storedRows: new Map([['a', row]]) });
    expect(result.rows.get('a')).toMatchObject({ showKey: 'title:1', season: 1, episode: 7, keep: false });
  });

  it('applies a manual assignment override', () => {
    const result = plan({
      videos: [video('a')],
      overrides: new Map([['a', { showKey: 'title:1', season: 1, episode: 51 }]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.ASSIGNED, season: 1, episode: 51, source: 'manual' });
  });

  it('turns the holder of an overridden number into a duplicate of the override', () => {
    const row = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 51, source: 'title' });
    const result = plan({
      videos: [video('holder'), video('fix')],
      matches: new Map([['holder', numbered(51)]]),
      storedRows: new Map([['holder', row]]),
      overrides: new Map([['fix', { showKey: 'title:1', season: 1, episode: 51 }]]),
    });
    expect(result.duplicates).toEqual([expect.objectContaining({ youtubeId: 'holder', duplicateOf: 'fix' })]);
  });

  it('applies a "Not an episode" override', () => {
    const row = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 4, source: 'title' });
    const result = plan({
      videos: [video('a')],
      matches: new Map([['a', numbered(4)]]),
      storedRows: new Map([['a', row]]),
      overrides: new Map([['a', { optOut: true }]]),
    });
    expect(result.rows.get('a')).toMatchObject({ showKey: 'title:1', status: ROW_STATUS.OPTED_OUT, titleOptOut: true, season: null });
  });
});

describe('titleNumbering.planNumbers review fixes', () => {
  const order = { kind: MATCH_KIND.ORDER, showKey: 'title:1', patternKey: 'p2', season: 1, episode: null, episodeTitle: null, reason: null };
  const manualTo5 = new Map([['copy', { showKey: 'title:1', season: 1, episode: 5 }]]);

  it('takes a manually held number for an override and leaves the holder without it', () => {
    const result = plan({
      videos: [video('holder', { daysAgo: 700 }), video('copy', { daysAgo: 10 })],
      matches: new Map([['holder', numbered(5)], ['copy', numbered(5)]]),
      storedRows: new Map([['holder', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 5, source: 'manual' })]]),
      overrides: manualTo5,
    });
    expect(result.rows.get('holder')).toMatchObject({ status: ROW_STATUS.DUPLICATE, season: null, episode: null });
  });

  it('records the displaced manual holder as a duplicate of the override', () => {
    const result = plan({
      videos: [video('holder', { daysAgo: 700 }), video('copy', { daysAgo: 10 })],
      matches: new Map([['holder', numbered(5)], ['copy', numbered(5)]]),
      storedRows: new Map([['holder', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 5, source: 'manual' })]]),
      overrides: manualTo5,
    });
    expect(result.duplicates).toEqual([{ youtubeId: 'holder', showKey: 'title:1', season: 1, episode: 5, duplicateOf: 'copy' }]);
  });

  it('gives an order-numbered holder of an overridden number the next order number', () => {
    const result = plan({
      videos: [video('holder', { daysAgo: 700 }), video('copy', { daysAgo: 10 })],
      matches: new Map([['holder', order]]),
      storedRows: new Map([['holder', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 5, source: 'order', patternKey: 'p2' })]]),
      highWater: new Map([['title:1|1', 5]]),
      overrides: manualTo5,
    });
    expect(result.rows.get('holder')).toMatchObject({ status: ROW_STATUS.ASSIGNED, season: 1, episode: 6, source: 'order' });
  });

  it('hands a number from a removed, never-downloaded holder to the earliest available upload', () => {
    const result = plan({
      videos: [video('gone', { daysAgo: 700, available: false }), video('reupload', { daysAgo: 10 })],
      matches: new Map([['gone', numbered(20)], ['reupload', numbered(20)]]),
      storedRows: new Map([['gone', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 20, source: 'title' })]]),
    });
    expect(result.rows.get('reupload')).toMatchObject({ status: ROW_STATUS.ASSIGNED, season: 1, episode: 20 });
  });

  it('keeps the number with a removed holder that was downloaded', () => {
    const result = plan({
      videos: [video('kept', { daysAgo: 700, available: false, downloaded: true }), video('reupload', { daysAgo: 10 })],
      matches: new Map([['kept', numbered(20)], ['reupload', numbered(20)]]),
      storedRows: new Map([['kept', stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 20, source: 'title' })]]),
    });
    expect(result.rows.get('reupload').status).toBe(ROW_STATUS.DUPLICATE);
  });

  it('keeps the channel-show row of an episode that loses a title claim', () => {
    const channelRow = stored({ showKey: 'channel:UC1', showKind: 'channel', status: 'assigned', season: 2024, episode: 3151200, source: 'date', patternKey: null });
    const result = plan({
      videos: [video('holder', { daysAgo: 700 }), video('episode', { daysAgo: 10, downloaded: true })],
      matches: new Map([['holder', numbered(20)], ['episode', numbered(20)]]),
      storedRows: new Map([['episode', channelRow]]),
    });
    expect(result.rows.get('episode')).toMatchObject({ showKey: 'channel:UC1', status: ROW_STATUS.ASSIGNED, season: 2024, episode: 3151200 });
  });

  it('still records a channel-show episode that loses a title claim as a duplicate', () => {
    const channelRow = stored({ showKey: 'channel:UC1', showKind: 'channel', status: 'assigned', season: 2024, episode: 3151200, source: 'date', patternKey: null });
    const result = plan({
      videos: [video('holder', { daysAgo: 700 }), video('episode', { daysAgo: 10, downloaded: true })],
      matches: new Map([['holder', numbered(20)], ['episode', numbered(20)]]),
      storedRows: new Map([['episode', channelRow]]),
    });
    expect(result.duplicates).toEqual([{ youtubeId: 'episode', showKey: 'title:1', season: 1, episode: 20, duplicateOf: 'holder' }]);
  });
});

describe('titleNumbering.planNumbers reset override', () => {
  it('classifies an opted-out video again', () => {
    const optedOut = stored({ showKey: 'title:1', status: 'opted_out', season: null, episode: null, source: null, titleOptOut: true });
    const result = plan({
      videos: [video('a')], matches: new Map([['a', numbered(4)]]), storedRows: new Map([['a', optedOut]]),
      overrides: new Map([['a', { reset: true }]]),
    });
    expect(result.rows.get('a')).toMatchObject({ status: ROW_STATUS.ASSIGNED, episode: 4, titleOptOut: false });
  });

  it('releases a manual row that no pattern matches', () => {
    const manual = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 49, source: 'manual' });
    const result = plan({ videos: [video('a')], storedRows: new Map([['a', manual]]), overrides: new Map([['a', { reset: true }]]) });
    expect(result.rows.get('a')).toBeNull();
  });
});

describe('titleNumbering.planNumbers frozen videos', () => {
  it('keeps a frozen video\'s row as stored even when its title now claims another number', () => {
    const row = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 4, source: 'title' });
    const result = planNumbers({
      videos: [video('a')], matches: new Map([['a', numbered(9)]]), stored: new Map([['a', row]]),
      highWater: new Map(), frozen: new Set(['a']),
    });
    expect(result.rows.get('a')).toMatchObject({ episode: 4, keep: true });
  });

  it('makes a new video that claims a frozen video\'s number its duplicate', () => {
    const row = stored({ showKey: 'title:1', status: 'assigned', season: 1, episode: 4, source: 'title' });
    const result = planNumbers({
      videos: [video('a', { daysAgo: 1 }), video('new', { daysAgo: 900 })],
      matches: new Map([['new', numbered(4)]]), stored: new Map([['a', row]]),
      highWater: new Map(), frozen: new Set(['a']),
    });
    expect(result.duplicates).toEqual([expect.objectContaining({ youtubeId: 'new', duplicateOf: 'a' })]);
  });

  it('leaves out a frozen video without a row', () => {
    const result = planNumbers({
      videos: [video('a')], matches: new Map(), stored: new Map(), highWater: new Map(), frozen: new Set(['a']),
    });
    expect(result.rows.has('a')).toBe(false);
  });
});

describe('titleNumbering.computeGaps', () => {
  const row = (episode, source = 'title', season = 1) => ({ showKey: 'title:1', status: 'assigned', season, episode, source });

  it('lists the numbers missing below the highest episode of a season', () => {
    expect(computeGaps([row(1), row(2), row(5)])).toEqual([
      { showKey: 'title:1', season: 1, have: 3, highest: 5, missing: [3, 4], truncated: false },
    ]);
  });

  it('skips date-numbered seasons', () => {
    expect(computeGaps([row(1010101, 'date', 2024), row(5050505, 'date', 2024)])).toEqual([]);
  });

  // Uploads of one year hold numbers a series spreads over several years.
  it('skips upload-year seasons with title episodes', () => {
    expect(computeGaps([row(11, 'title', 2021), row(44, 'title', 2021)])).toEqual([]);
  });

  it('still lists gaps in season 199, the highest fixed season', () => {
    expect(computeGaps([row(1, 'title', 199), row(3, 'title', 199)])).toEqual([
      expect.objectContaining({ season: 199, missing: [2] }),
    ]);
  });

  it('caps the missing list', () => {
    const [gap] = computeGaps([row(1), row(400)], { limit: 3 });
    expect([gap.missing, gap.truncated]).toEqual([[2, 3, 4], true]);
  });
});
