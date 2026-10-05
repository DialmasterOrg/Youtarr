jest.mock('../../../models', () => ({
  VideoClassification: { findAll: jest.fn() },
  TvShow: { findAll: jest.fn() },
}));

const CHANNEL_ID = 'UC1';

function subject(id, youtubeId, extra = {}) {
  return { video: { id, youtubeId }, ownerChannelId: CHANNEL_ID, libraryFolder: 'Kids', currentLayout: 'videos', ...extra };
}

describe('reorganize titleTargets', () => {
  let titleTargets;
  let models;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    models = require('../../../models');
    titleTargets = require('../titleTargets');
  });

  describe('a title show change', () => {
    const draft = (key, extra = {}) => ({
      key, id: key.startsWith('title:') ? Number(key.slice(6)) : null, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV',
      patterns: [{ key: `${key}#0`, seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }], ...extra,
    });
    const context = (drafts, entries, storedShows = new Map(), stored = new Map()) => ({
      type: 'titleShows',
      channel: { channel_id: CHANNEL_ID },
      drafts,
      titlePlan: { entries, storedShows, stored },
    });
    const after = (showKey, extra = {}) => ({ showKey, status: 'assigned', season: 1, episode: 20, patternKey: `${showKey}#0`, ...extra });

    it('sends a video the plan puts in a show to that show', async () => {
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('new:0')], [{ youtubeId: 'aaaaaaaaaaa', after: after('new:0') }])
      );
      expect(result.targets.get(1)).toMatchObject({ showKey: 'new:0', after: { episode: 20 }, pattern: { episodeSource: 'title' } });
    });

    it('plans a new show to be created', async () => {
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('new:0')], [{ youtubeId: 'aaaaaaaaaaa', after: after('new:0') }])
      );
      expect(result.shows.get('new:0')).toEqual({
        key: 'new:0', kind: 'title', ownerChannelId: CHANNEL_ID, showId: null, action: 'create',
        name: 'Beyblade', libraryFolder: 'TV', folderName: 'Beyblade',
      });
    });

    it('plans an existing show whose folder changes to move', async () => {
      const storedShows = new Map([['title:3', { key: 'title:3', libraryFolder: 'TV', folderName: 'Old name' }]]);
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('title:3')], [{ youtubeId: 'aaaaaaaaaaa', after: after('title:3') }], storedShows)
      );
      expect(result.shows.get('title:3')).toMatchObject({
        action: 'move', showId: 3, previousLocation: { libraryFolder: 'TV', folderName: 'Old name' },
      });
    });

    it('plans a show whose folder name changes only in case to move', async () => {
      const storedShows = new Map([['title:3', { key: 'title:3', libraryFolder: 'TV', folderName: 'beyblade' }]]);
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('title:3')], [{ youtubeId: 'aaaaaaaaaaa', after: after('title:3') }], storedShows)
      );
      expect(result.shows.get('title:3')).toMatchObject({
        action: 'move', previousLocation: { libraryFolder: 'TV', folderName: 'beyblade' },
      });
    });

    it('keeps a show whose folder stays the same', async () => {
      const storedShows = new Map([['title:3', { key: 'title:3', libraryFolder: 'TV', folderName: 'Beyblade' }]]);
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('title:3')], [{ youtubeId: 'aaaaaaaaaaa', after: after('title:3') }], storedShows)
      );
      expect(result.shows.get('title:3').action).toBe('keep');
    });

    it('leaves a video that leaves its show to the channel layout', async () => {
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([], [{ youtubeId: 'aaaaaaaaaaa', after: null }])
      );
      expect(result.targets.has(1)).toBe(false);
    });

    it('leaves a duplicate to the channel layout', async () => {
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('new:0')], [{ youtubeId: 'aaaaaaaaaaa', after: after('new:0', { status: 'duplicate', season: null, episode: null }) }])
      );
      expect(result.targets.has(1)).toBe(false);
    });

    it('passes the stored row along for its stem', async () => {
      const stored = new Map([['aaaaaaaaaaa', { showKey: 'new:0', fileStem: 's' }]]);
      const result = await titleTargets.resolveTitleTargets(
        [subject(1, 'aaaaaaaaaaa')],
        context([draft('new:0')], [{ youtubeId: 'aaaaaaaaaaa', after: after('new:0') }], new Map(), stored)
      );
      expect(result.targets.get(1).stored).toEqual({ showKey: 'new:0', fileStem: 's' });
    });
  });

  describe('any other change', () => {
    const channels = new Map([[CHANNEL_ID, { channel_id: CHANNEL_ID, enabled: true }]]);
    const row = (extra = {}) => ({
      youtube_id: 'aaaaaaaaaaa', channel_id: CHANNEL_ID, show_id: 3, status: 'assigned', season: 1, episode: 20,
      source: 'title', episode_title: 'Relative', file_stem: 'S01E20 - Relative [aaaaaaaaaaa]', ...extra,
    });
    const titleShow = { id: 3, kind: 'title', channel_id: CHANNEL_ID, name: 'Beyblade', library_folder: 'TV', folder_name: 'Beyblade' };

    it('keeps an episode of an active title show in its show', async () => {
      models.VideoClassification.findAll.mockResolvedValue([row()]);
      models.TvShow.findAll.mockResolvedValue([titleShow]);
      const result = await titleTargets.resolveTitleTargets([subject(1, 'aaaaaaaaaaa')], { type: 'channel' }, channels);
      expect(result.targets.get(1)).toMatchObject({ showKey: 'title:3', after: { season: 1, episode: 20, source: 'title' } });
      expect(result.shows.get('title:3')).toMatchObject({ action: 'keep', showId: 3, libraryFolder: 'TV', folderName: 'Beyblade' });
    });

    it('passes the stored row\'s time source along, so a kept number keeps it', async () => {
      models.VideoClassification.findAll.mockResolvedValue([row({ source: 'date', timestamp_source: 'upload_date' })]);
      models.TvShow.findAll.mockResolvedValue([titleShow]);
      const result = await titleTargets.resolveTitleTargets([subject(1, 'aaaaaaaaaaa')], { type: 'channel' }, channels);
      expect(result.targets.get(1).stored.timestampSource).toBe('upload_date');
    });

    it('asks only for active title shows', async () => {
      models.VideoClassification.findAll.mockResolvedValue([row()]);
      models.TvShow.findAll.mockResolvedValue([]);
      await titleTargets.resolveTitleTargets([subject(1, 'aaaaaaaaaaa')], { type: 'channel' }, channels);
      expect(models.TvShow.findAll.mock.calls[0][0].where).toEqual({ id: [3], kind: 'title', retired_at: null });
    });

    it('lets an episode of an unsubscribed channel\'s show follow the channel layout', async () => {
      models.VideoClassification.findAll.mockResolvedValue([row()]);
      models.TvShow.findAll.mockResolvedValue([titleShow]);
      const disabled = new Map([[CHANNEL_ID, { channel_id: CHANNEL_ID, enabled: false }]]);
      const result = await titleTargets.resolveTitleTargets([subject(1, 'aaaaaaaaaaa')], { type: 'channel' }, disabled);
      expect(result.targets.size).toBe(0);
    });

    it('reads nothing without subjects', async () => {
      await titleTargets.resolveTitleTargets([], { type: 'channel' }, channels);
      expect(models.VideoClassification.findAll).not.toHaveBeenCalled();
    });
  });
});
