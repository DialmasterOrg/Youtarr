const { assignTitleEpisodes } = require('../titleAssignments');
const { interpretMatch } = require('../../tvShows/titleMatcher');
const { planNumbers } = require('../../tvShows/titleNumbering');

const SHOW = { key: 'title:3', name: 'Beyblade', ownerChannelId: 'UC1' };
// 2020-08-09 12:30 UTC
const TIMESTAMP = 1596976200;

function entry(youtubeId, after, extra = {}) {
  return {
    youtubeId,
    title: `Video ${youtubeId}`,
    info: { timestamp: TIMESTAMP },
    after: { showKey: 'title:3', status: 'assigned', season: 1, episode: 20, source: 'title', episodeTitle: 'Relative', ...after },
    pattern: { seasonSource: 'fixed', episodeSource: 'title' },
    stored: null,
    ...extra,
  };
}

const assign = (entries, { taken = new Map(), highWater = new Map() } = {}) => assignTitleEpisodes({ show: SHOW, entries, taken, highWater });

describe('reorganize titleAssignments', () => {
  it('gives a numbered episode its planned number and a new stem', () => {
    const { assignments } = assign([entry('aaaaaaaaaaa')]);
    expect(assignments.get('aaaaaaaaaaa')).toEqual({
      showKey: 'title:3', kind: 'title', ownerChannelId: 'UC1', showTitle: 'Beyblade', season: 1, episode: 20,
      source: 'title', timestampSource: null, episodeTitle: 'Relative', fileStem: 'S01E20 - Relative [aaaaaaaaaaa]',
    });
  });

  it('keeps the stored stem of an episode whose number stays', () => {
    const stored = { showKey: 'title:3', season: 1, episode: 20, fileStem: 'S01E20 - Old [aaaaaaaaaaa]' };
    const { assignments } = assign([entry('aaaaaaaaaaa', {}, { stored })]);
    expect(assignments.get('aaaaaaaaaaa').fileStem).toBe('S01E20 - Old [aaaaaaaaaaa]');
  });

  it('keeps the stored time source of an episode whose number stays', () => {
    const stored = { showKey: 'title:3', season: 1, episode: 20, fileStem: 'S01E20 - Old [aaaaaaaaaaa]', timestampSource: 'timestamp' };
    const { assignments } = assign([entry('aaaaaaaaaaa', {}, { stored })]);
    expect(assignments.get('aaaaaaaaaaa').timestampSource).toBe('timestamp');
  });

  it('numbers a waiting date episode from its upload time', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: null, source: null }, {
      pattern: { seasonSource: 'year', episodeSource: 'date' },
    });
    expect(assign([pending]).assignments.get('aaaaaaaaaaa')).toMatchObject({
      season: 2020, episode: 8091230, source: 'date', timestampSource: 'timestamp', fileStem: 'S2020E08091230 - Relative [aaaaaaaaaaa]',
    });
  });

  it('numbers a year-season episode with the episode its title gave the plan', () => {
    const pattern = { seasonSource: 'year', episodeSource: 'title' };
    const match = { showKey: 'title:3', patternKey: 'title:3#0', ...interpretMatch(pattern, { episode: '7', title: 'Relative' }) };
    const { rows } = planNumbers({
      videos: [{ youtubeId: 'aaaaaaaaaaa', publishedAtMs: 0, available: true, downloaded: true }],
      matches: new Map([['aaaaaaaaaaa', match]]),
      stored: new Map(),
      highWater: new Map(),
    });
    const planned = { ...entry('aaaaaaaaaaa', {}, { pattern }), after: rows.get('aaaaaaaaaaa') };
    expect(assign([planned]).assignments.get('aaaaaaaaaaa')).toMatchObject({
      season: 2020, episode: 7, source: 'title', fileStem: 'S2020E07 - Relative [aaaaaaaaaaa]',
    });
  });

  it('bumps a date number another episode holds', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: null }, {
      pattern: { seasonSource: 'year', episodeSource: 'date' },
    });
    const taken = new Map([[2020, new Set([8091230])]]);
    expect(assign([pending], { taken }).assignments.get('aaaaaaaaaaa').episode).toBe(8091231);
  });

  it('numbers a waiting title episode in its upload year', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: 4 }, {
      pattern: { seasonSource: 'year', episodeSource: 'title' },
    });
    expect(assign([pending]).assignments.get('aaaaaaaaaaa')).toMatchObject({ season: 2020, episode: 4, source: 'title' });
  });

  it('leaves out a waiting title episode whose number is taken', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: 4 }, {
      pattern: { seasonSource: 'year', episodeSource: 'title' },
    });
    const result = assign([pending], { taken: new Map([[2020, new Set([4])]]) });
    expect([result.assignments.has('aaaaaaaaaaa'), [...result.taken]]).toEqual([false, ['aaaaaaaaaaa']]);
  });

  it('allocates order numbers in a year season past its high-water mark', () => {
    const pending = (id, timestamp) => entry(id, { status: 'pending_number', season: null, episode: null }, {
      info: { timestamp }, pattern: { seasonSource: 'year', episodeSource: 'order' },
    });
    const { assignments } = assign([pending('bbbbbbbbbbb', TIMESTAMP + 60), pending('aaaaaaaaaaa', TIMESTAMP)], {
      highWater: new Map([[2020, 2]]),
    });
    expect([assignments.get('aaaaaaaaaaa').episode, assignments.get('bbbbbbbbbbb').episode]).toEqual([3, 4]);
  });

  it('numbers a waiting episode without an upload time by its download time', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: null }, {
      info: {}, downloadedAt: '2021-01-02T03:04:00.000Z', pattern: { seasonSource: 'year', episodeSource: 'date' },
    });
    expect(assign([pending]).assignments.get('aaaaaaaaaaa')).toMatchObject({ season: 2021, episode: 1020304, timestampSource: null });
  });

  // The move review counts these, as it does for channel shows.
  it('flags a waiting episode numbered by its download time', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: null }, {
      info: {}, downloadedAt: '2021-01-02T03:04:00.000Z', pattern: { seasonSource: 'year', episodeSource: 'order' },
    });
    expect(assign([pending]).flags.get('aaaaaaaaaaa')).toEqual(['download-time']);
  });

  it('flags a waiting date episode numbered by its upload day', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: null }, {
      info: { upload_date: '20200809' }, pattern: { seasonSource: 'year', episodeSource: 'date' },
    });
    expect(assign([pending]).flags.get('aaaaaaaaaaa')).toEqual(['upload-date-only']);
  });

  it('does not flag a year-season episode whose upload day gives its year', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: 4 }, {
      info: { upload_date: '20200809' }, pattern: { seasonSource: 'year', episodeSource: 'title' },
    });
    expect(assign([pending]).flags.has('aaaaaaaaaaa')).toBe(false);
  });

  it('leaves out a waiting episode with no time at all', () => {
    const pending = entry('aaaaaaaaaaa', { status: 'pending_number', season: null, episode: null }, {
      info: {}, pattern: { seasonSource: 'year', episodeSource: 'date' },
    });
    expect([...assign([pending]).noDate]).toEqual(['aaaaaaaaaaa']);
  });
});
