jest.mock('../../../models', () => ({
  Video: { findAll: jest.fn() },
  VideoClassification: { findAll: jest.fn() },
  TvShow: { findAll: jest.fn() },
}));
jest.mock('../../../models/channelvideo', () => ({ findAll: jest.fn() }));
jest.mock('../titleShowStore', () => ({ listTitleShows: jest.fn(), highWaterMarks: jest.fn() }));
jest.mock('../titleMatcher', () => ({
  ...jest.requireActual('../titleMatcher'),
  matchVideos: jest.fn(),
}));

const { MATCH_KIND } = jest.requireActual('../titleMatcher');

const CHANNEL_ID = 'UCDrqiuwNRbEahL1UEB0hkKQ';

function draftShow(key, extra = {}) {
  return {
    id: key.startsWith('title:') ? Number(key.slice(6)) : null,
    key, position: 0, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV Shows',
    excludeTerms: [], seasonNames: {},
    patterns: [{ key: `${key}#0`, compiledRegex: 'x', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }],
    ...extra,
  };
}

function video(youtubeId, extra = {}) {
  return { youtubeId, title: youtubeId, publishedAtMs: 0, available: true, downloaded: false, filePath: null, videoId: null, ...extra };
}

function numbered(showKey, episode) {
  return { showKey, patternKey: `${showKey}#0`, kind: MATCH_KIND.NUMBERED, season: 1, episode, episodeTitle: `E${episode}`, reason: null };
}

const storedTitleShow = { key: 'title:3', kind: 'title', active: true, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV Shows' };

function storedRow(extra) {
  return {
    showKey: 'title:3', showKind: 'title', showActive: true, status: 'assigned', season: 1, episode: 20, source: 'title',
    titleOptOut: false, patternKey: 'title:3#0', episodeTitle: 'E20', fileStem: 'S01E20 - E20 [a]', ...extra,
  };
}

describe('titlePlanner', () => {
  let planner;
  let models;
  let ChannelVideo;
  let titleShowStore;
  let titleMatcher;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    ChannelVideo = require('../../../models/channelvideo');
    titleShowStore = require('../titleShowStore');
    titleMatcher = require('../titleMatcher');
    planner = require('../titlePlanner');
  });

  describe('buildChannelPlan', () => {
    const build = (params) => planner.buildChannelPlan({
      drafts: [draftShow('title:3')],
      storedShows: new Map([['title:3', storedTitleShow]]),
      stored: new Map(),
      matches: new Map(),
      highWater: new Map(),
      overrides: new Map(),
      ...params,
    });

    it('needs no file move for a video that is not downloaded', () => {
      const plan = build({ videos: [video('a')], matches: new Map([['a', numbered('title:3', 20)]]) });
      expect(plan.entries[0]).toMatchObject({ youtubeId: 'a', moves: false, after: expect.objectContaining({ episode: 20 }) });
      expect(plan.requiresReorganize).toBe(false);
    });

    it('moves a downloaded video that joins a title show', () => {
      const plan = build({ videos: [video('a', { downloaded: true, filePath: '/d/__Kids/Ch/a.mp4' })], matches: new Map([['a', numbered('title:3', 20)]]) });
      expect(plan.entries[0].moves).toBe(true);
      expect(plan.requiresReorganize).toBe(true);
    });

    it('keeps a downloaded episode in place when nothing about it changes', () => {
      const plan = build({
        videos: [video('a', { downloaded: true, filePath: '/d/__TV Shows/Beyblade/Season 01/S01E20 - E20 [a].mp4' })],
        stored: new Map([['a', storedRow()]]),
        matches: new Map([['a', numbered('title:3', 20)]]),
      });
      expect(plan.entries[0].moves).toBe(false);
    });

    it('leaves a downloaded file outside the downloads folder where it is', () => {
      const plan = build({
        videos: [video('a', { downloaded: true, filePath: '/elsewhere/a.mp4', outsideDownloads: true })],
        matches: new Map([['a', numbered('title:3', 20)]]),
      });
      expect([plan.entries[0].moves, plan.entries[0].staysOutside, plan.requiresReorganize]).toEqual([false, true, false]);
    });

    it('moves a downloaded episode whose number changes', () => {
      const plan = build({
        videos: [video('a', { downloaded: true, filePath: '/d/__TV Shows/Beyblade/Season 01/S01E20 - E20 [a].mp4' })],
        stored: new Map([['a', storedRow()]]),
        matches: new Map([['a', numbered('title:3', 21)]]),
      });
      expect(plan.entries[0].moves).toBe(true);
    });

    it('moves the downloaded episodes of a show whose folder changes', () => {
      const plan = build({
        drafts: [draftShow('title:3', { folderName: 'Beyblade (2001)' })],
        videos: [video('a', { downloaded: true, filePath: '/d/__TV Shows/Beyblade/Season 01/S01E20 - E20 [a].mp4' })],
        stored: new Map([['a', storedRow()]]),
        matches: new Map([['a', numbered('title:3', 20)]]),
      });
      expect([plan.entries[0].moves, plan.relocated]).toEqual([true, ['title:3']]);
    });

    // The database compares folder names ignoring case and accents; most
    // filesystems don't, so a new download would land in a second folder.
    it.each([
      ['case', 'beyblade'],
      ['accents', 'Beybladé'],
    ])('moves the downloaded episodes of a show whose folder name changes only in %s', (_label, folderName) => {
      const plan = build({
        drafts: [draftShow('title:3', { folderName })],
        videos: [video('a', { downloaded: true, filePath: '/d/__TV Shows/Beyblade/Season 01/S01E20 - E20 [a].mp4' })],
        stored: new Map([['a', storedRow()]]),
        matches: new Map([['a', numbered('title:3', 20)]]),
      });
      expect([plan.entries[0].moves, plan.relocated]).toEqual([true, ['title:3']]);
    });

    it('moves a downloaded episode out of a show it leaves', () => {
      const plan = build({
        drafts: [],
        videos: [video('a', { downloaded: true, filePath: '/d/__TV Shows/Beyblade/Season 01/S01E20 - E20 [a].mp4' })],
        stored: new Map([['a', storedRow()]]),
      });
      expect([plan.entries[0].moves, plan.entries[0].after, plan.retired]).toEqual([true, null, ['title:3']]);
    });

    it('does not move a downloaded video whose stored row never placed its file', () => {
      const plan = build({
        drafts: [],
        videos: [video('a', { downloaded: true, filePath: '/d/__Kids/Ch/Ch - a [a].mp4' })],
        stored: new Map([['a', storedRow()]]),
      });
      expect(plan.entries[0].moves).toBe(false);
    });

    it('moves a downloaded duplicate nowhere', () => {
      const plan = build({
        videos: [video('old', { publishedAtMs: 1 }), video('new', { downloaded: true, publishedAtMs: 5, filePath: '/d/__Kids/Ch/new.mp4' })],
        matches: new Map([['old', numbered('title:3', 20)], ['new', numbered('title:3', 20)]]),
      });
      expect(plan.entries.find((entry) => entry.youtubeId === 'new')).toMatchObject({ moves: false, after: expect.objectContaining({ status: 'duplicate' }) });
    });

    it('needs no move for a downloaded year-show duplicate decided at its download', () => {
      const pending = { showKey: 'title:3', patternKey: 'title:3#0', kind: MATCH_KIND.PENDING, season: null, episode: 5, episodeTitle: null, reason: null };
      const plan = build({
        videos: [video('a', { downloaded: true, filePath: '/d/__Kids/Ch/a.mp4' })],
        matches: new Map([['a', pending]]),
        stored: new Map([['a', storedRow({ status: 'duplicate', season: null, episode: null, fileStem: null })]]),
      });
      expect(plan.entries[0]).toMatchObject({ moves: false, after: expect.objectContaining({ status: 'duplicate' }) });
      expect(plan.requiresReorganize).toBe(false);
    });

    it('marks a downloaded video waiting for an upload-time number as moving', () => {
      const pending = { showKey: 'title:3', patternKey: 'title:3#0', kind: MATCH_KIND.PENDING, season: null, episode: null, episodeTitle: null, reason: null };
      const plan = build({ videos: [video('a', { downloaded: true, filePath: '/d/__Kids/Ch/a.mp4' })], matches: new Map([['a', pending]]) });
      expect(plan.entries[0].moves).toBe(true);
    });

    it('leaves out videos with neither a match nor a row', () => {
      expect(build({ videos: [video('loose')] }).entries).toEqual([]);
    });

    it('leaves every video but the ones asked for exactly as stored', () => {
      const plan = build({
        videos: [video('old'), video('new')],
        stored: new Map([['old', storedRow({ episode: 4 })]]),
        matches: new Map([['old', numbered('title:3', 9)], ['new', numbered('title:3', 5)]]),
        onlyIds: new Set(['new']),
      });
      expect(plan.entries.map((entry) => [entry.youtubeId, entry.after.episode])).toEqual([['old', 4], ['new', 5]]);
    });

    it('counts the videos it looked at', () => {
      expect(build({ videos: [video('loose'), video('x')] }).knownVideos).toBe(2);
    });
  });

  describe('planChannel', () => {
    const channel = { channel_id: CHANNEL_ID, title: 'BEYBLADE Official' };

    beforeEach(() => {
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'a', title: 'BEYBLADE EN Episode 20: x', publishedAt: '2020-08-09T00:00:00.000Z', youtube_removed: false, availability: null },
      ]);
      models.Video.findAll.mockResolvedValue([
        { id: 11, youtubeId: 'b', youTubeVideoName: 'BEYBLADE EN Episode 2: y', originalDate: '20200628', channel_id: CHANNEL_ID, filePath: '/d/b.mp4', audioFilePath: null, removed: false },
      ]);
      models.VideoClassification.findAll.mockResolvedValue([]);
      models.TvShow.findAll.mockResolvedValue([]);
      titleShowStore.listTitleShows.mockResolvedValue([]);
      titleShowStore.highWaterMarks.mockResolvedValue(new Map());
      titleMatcher.matchVideos.mockResolvedValue(new Map());
    });

    it('matches listed and downloaded videos of the channel', async () => {
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      expect(titleMatcher.matchVideos.mock.calls[0][1]).toEqual([
        expect.objectContaining({ youtubeId: 'a', title: 'BEYBLADE EN Episode 20: x', downloaded: false }),
        expect.objectContaining({ youtubeId: 'b', title: 'BEYBLADE EN Episode 2: y', downloaded: true, videoId: 11 }),
      ]);
    });

    it('dates a listed video by its listing date and a downloaded one by its upload date', async () => {
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      const [a, b] = titleMatcher.matchVideos.mock.calls[0][1];
      expect([a.publishedAtMs, b.publishedAtMs]).toEqual([Date.UTC(2020, 7, 9), Date.UTC(2020, 5, 28)]);
    });

    it('gives a downloaded video its upload year and a listed one none', async () => {
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      const [a, b] = titleMatcher.matchVideos.mock.calls[0][1];
      expect([a.uploadYear, b.uploadYear]).toEqual([null, 2020]);
    });

    it('gives a downloaded video without an upload date no upload year', async () => {
      models.Video.findAll.mockResolvedValue([
        { id: 11, youtubeId: 'b', youTubeVideoName: 'x', originalDate: null, channel_id: CHANNEL_ID, filePath: '/d/b.mp4', audioFilePath: null, removed: false },
      ]);
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      expect(titleMatcher.matchVideos.mock.calls[0][1][1].uploadYear).toBeNull();
    });

    it('matches only the videos asked for', async () => {
      await planner.planChannel({ channel, drafts: [draftShow('new:0')], onlyIds: new Set(['a']) });
      expect(titleMatcher.matchVideos.mock.calls[0][1].map((entry) => entry.youtubeId)).toEqual(['a']);
    });

    it('returns every known video with the plan', async () => {
      const plan = await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      expect(plan.videos.map((entry) => entry.youtubeId)).toEqual(['a', 'b']);
    });

    it('treats a members-only or removed listing as unavailable', async () => {
      ChannelVideo.findAll.mockResolvedValue([
        { youtube_id: 'm', title: 'm', publishedAt: null, youtube_removed: false, availability: 'subscriber_only' },
        { youtube_id: 'r', title: 'r', publishedAt: null, youtube_removed: true, availability: null },
      ]);
      models.Video.findAll.mockResolvedValue([]);
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      expect(titleMatcher.matchVideos.mock.calls[0][1].map((entry) => entry.available)).toEqual([false, false]);
    });

    it('leaves out videos classified into another channel\'s show', async () => {
      models.VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'a', channel_id: 'UCother', show_id: 5, status: 'assigned' }]);
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      expect(titleMatcher.matchVideos.mock.calls[0][1].map((entry) => entry.youtubeId)).toEqual(['b']);
    });

    it('marks a download whose file is outside the downloads folder', async () => {
      models.Video.findAll.mockResolvedValue([
        { id: 11, youtubeId: 'b', youTubeVideoName: 'x', originalDate: null, channel_id: CHANNEL_ID, filePath: '/elsewhere/b.mp4', audioFilePath: null, removed: false },
        { id: 12, youtubeId: 'c', youTubeVideoName: 'y', originalDate: null, channel_id: CHANNEL_ID, filePath: '/d/__Kids/c.mp4', audioFilePath: null, removed: false },
      ]);
      const plan = await planner.planChannel({ channel, drafts: [draftShow('new:0')], downloadsDir: '/d' });
      expect(plan.videos.filter((entry) => entry.outsideDownloads).map((entry) => entry.youtubeId)).toEqual(['b']);
    });

    it('plans a video classified for the channel but downloaded under another channel id', async () => {
      const vevo = {
        youtube_id: 'v', channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 7, source: 'title',
        pattern_id: 31, title_opt_out: false, episode_title: 'z', file_stem: 'S01E07 - z [v]',
      };
      models.VideoClassification.findAll.mockImplementation(async ({ where }) => (where.channel_id ? [{ youtube_id: 'v' }] : [vevo]));
      models.Video.findAll.mockImplementation(async ({ where }) => (where.youtubeId
        ? [{ id: 12, youtubeId: 'v', youTubeVideoName: 'BEYBLADE EN Episode 7: z', originalDate: '20200701', channel_id: 'UCvevo', filePath: '/d/v.mp4', audioFilePath: null, removed: false }]
        : []));
      await planner.planChannel({ channel, drafts: [draftShow('new:0')] });
      expect(titleMatcher.matchVideos.mock.calls[0][1]).toContainEqual(
        expect.objectContaining({ youtubeId: 'v', title: 'BEYBLADE EN Episode 7: z', downloaded: true, videoId: 12 })
      );
    });

    it('keeps the row of a classified video Youtarr has no other record of as stored', async () => {
      const orphan = {
        youtube_id: 'o', channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 9, source: 'title',
        pattern_id: 31, title_opt_out: false, episode_title: 'gone', file_stem: 'S01E09 - gone [o]',
      };
      models.VideoClassification.findAll.mockImplementation(async ({ where }) => (where.channel_id ? [{ youtube_id: 'o', episode_title: 'gone' }] : [orphan]));
      models.Video.findAll.mockResolvedValue([]);
      models.TvShow.findAll.mockResolvedValue([{ id: 3, kind: 'title', retired_at: null, name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows', channel_id: CHANNEL_ID }]);
      titleShowStore.listTitleShows.mockResolvedValue([{ id: 3, key: 'title:3', patterns: [{ id: 31, key: 'title:3#0' }] }]);
      const plan = await planner.planChannel({ channel, drafts: [draftShow('title:3')] });
      expect(plan.entries.find((entry) => entry.youtubeId === 'o').after).toMatchObject({ status: 'assigned', season: 1, episode: 9, keep: true });
    });

    it('reads a stored row with its show and pattern keys', async () => {
      models.VideoClassification.findAll.mockResolvedValue([{
        youtube_id: 'a', channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 20, source: 'title',
        pattern_id: 31, title_opt_out: false, episode_title: 'x', file_stem: 'S01E20 - x [a]', timestamp_source: 'timestamp',
      }]);
      models.TvShow.findAll.mockResolvedValue([{ id: 3, kind: 'title', retired_at: null, name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV Shows', channel_id: CHANNEL_ID }]);
      titleShowStore.listTitleShows.mockResolvedValue([{ id: 3, key: 'title:3', patterns: [{ id: 31, key: 'title:3#0' }] }]);
      const plan = await planner.planChannel({ channel, drafts: [draftShow('title:3')] });
      expect(plan.entries.find((entry) => entry.youtubeId === 'a').before).toMatchObject({
        showKey: 'title:3', showKind: 'title', showActive: true, patternKey: 'title:3#0', patternId: 31, fileStem: 'S01E20 - x [a]',
        timestampSource: 'timestamp',
      });
    });
  });
});
