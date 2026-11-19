jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn() }));
jest.mock('../showStore', () => ({
  findChannelShow: jest.fn(),
  createChannelShow: jest.fn(),
  relocateChannelShow: jest.fn(),
  toLocation: jest.requireActual('../showStore').toLocation,
}));
jest.mock('../episodeAllocator', () => ({ assignDateEpisode: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findOne: jest.fn() }));
jest.mock('../../../models/tvshowseason', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
jest.mock('../titleEpisodeAssigner', () => ({ resolveTitlePlacement: jest.fn() }));
jest.mock('../episodeConflicts', () => ({ noteDownloaded: jest.fn() }));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
// Retries of a failing move are instant.
jest.mock('../../filesystem/sleep', () => ({ sleep: () => Promise.resolve() }));

const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'abcdefghijk';
const STEM = `S2024E03151200 - Big Build [${ID}]`;
const ASSIGNMENT = { season: 2024, episode: 3151200, dateNumbered: true, episodeTitle: 'Big Build', fileStem: STEM };

describe('episodePlacement', () => {
  let episodePlacement;
  let libraryLayouts;
  let showStore;
  let episodeAllocator;
  let VideoClassification;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    libraryLayouts = require('../libraryLayouts');
    showStore = require('../showStore');
    episodeAllocator = require('../episodeAllocator');
    VideoClassification = require('../../../models/videoclassification');
    episodePlacement = require('../episodePlacement');
    libraryLayouts.getLayoutResolver.mockResolvedValue((folder) => (folder === 'TV' ? 'tv' : 'videos'));
    showStore.findChannelShow.mockResolvedValue(null);
    showStore.createChannelShow.mockImplementation(async (p) => ({
      id: 5, name: p.name, folder_name: p.folderName, library_folder: p.libraryFolder, external_key: p.channelId,
    }));
    episodeAllocator.assignDateEpisode.mockResolvedValue(ASSIGNMENT);
  });

  describe('planEpisode', () => {
    const plan = (overrides = {}) => episodePlacement.planEpisode({
      youtubeId: ID,
      info: { channel: 'Mark Rober', title: 'Big Build', timestamp: 1710504000 },
      ownerChannelId: 'UC1',
      channelRecord: null,
      channelEnabled: false,
      uploaderFolderName: 'Mark Rober',
      resolvedSubfolder: 'TV',
      baseDir: '/data',
      ...overrides,
    });

    it('places a title-show episode at the show\'s location, even from a videos folder', async () => {
      const titleAssigner = require('../titleEpisodeAssigner');
      const show = { id: 3, kind: 'title', name: 'Beyblade', folder_name: 'Beyblade', library_folder: 'TV', external_key: 'u' };
      const assignment = { season: 1, episode: 20, dateNumbered: false, episodeTitle: 'Relative', fileStem: `S01E20 - Relative [${ID}]` };
      titleAssigner.resolveTitlePlacement.mockResolvedValue({ show, assignment });
      await expect(plan({ resolvedSubfolder: 'Kids' })).resolves.toEqual({
        show, assignment, showDir: path.join('/data', '__TV', 'Beyblade'), seasonDir: path.join('/data', '__TV', 'Beyblade', 'Season 01'), stem: assignment.fileStem,
      });
    });

    it('asks the title shows of the owner channel first', async () => {
      const titleAssigner = require('../titleEpisodeAssigner');
      await plan({ channelRecord: { title: 'Mark Rober' }, channelEnabled: true });
      expect(titleAssigner.resolveTitlePlacement).toHaveBeenCalledWith(expect.objectContaining({ youtubeId: ID, ownerChannelId: 'UC1', channelEnabled: true }));
    });

    it('saves a title-show episode by the channel layout when its show\'s folder is no longer TV', async () => {
      const titleAssigner = require('../titleEpisodeAssigner');
      titleAssigner.resolveTitlePlacement.mockResolvedValue({
        show: { id: 3, kind: 'title', library_folder: 'Kids', folder_name: 'Beyblade' }, assignment: ASSIGNMENT,
      });
      await expect(plan({ resolvedSubfolder: 'Kids' })).resolves.toBeNull();
    });

    it('hands a downloaded duplicate\'s archive line to the download', async () => {
      await plan({ resolvedSubfolder: 'Kids' });
      expect(require('../episodeConflicts').noteDownloaded).toHaveBeenCalledWith(ID);
    });

    it('returns null for a videos folder without touching shows', async () => {
      await expect(plan({ resolvedSubfolder: 'Kids' })).resolves.toBeNull();
      expect(showStore.findChannelShow).not.toHaveBeenCalled();
    });

    it('returns null when the folder layouts cannot be read', async () => {
      libraryLayouts.getLayoutResolver.mockRejectedValue(new Error('db down'));
      await expect(plan()).resolves.toBeNull();
    });

    it('creates an untracked channel show from the uploader folder and channel name', async () => {
      await plan();
      expect(showStore.createChannelShow).toHaveBeenCalledWith({
        channelId: 'UC1', name: 'Mark Rober', folderName: 'Mark Rober', libraryFolder: 'TV',
      });
    });

    it('names a tracked channel show after the channel record', async () => {
      await plan({ channelRecord: { title: 'Mark Rober Official', folder_name: 'MarkRober' }, channelEnabled: true });
      expect(showStore.createChannelShow).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Mark Rober Official', folderName: 'MarkRober',
      }));
    });

    it('places the episode in a season folder of the show folder', async () => {
      const placement = await plan();
      expect(placement).toMatchObject({
        showDir: path.join('/data', '__TV', 'Mark Rober'),
        seasonDir: path.join('/data', '__TV', 'Mark Rober', 'Season 2024'),
        stem: STEM,
        assignment: ASSIGNMENT,
      });
    });

    it('places shows of the main folder directly under the downloads folder', async () => {
      libraryLayouts.getLayoutResolver.mockResolvedValue(() => 'tv');
      const placement = await plan({ resolvedSubfolder: null });
      expect(placement.showDir).toBe(path.join('/data', 'Mark Rober'));
    });

    it('keeps an existing show at its stored location', async () => {
      libraryLayouts.getLayoutResolver.mockResolvedValue(() => 'tv');
      showStore.findChannelShow.mockResolvedValue({ id: 2, name: 'MR', folder_name: 'Pinned', library_folder: 'TV' });
      const placement = await plan({ resolvedSubfolder: 'Other TV' });
      expect(placement.showDir).toBe(path.join('/data', '__TV', 'Pinned'));
    });

    it('moves an existing show out of a folder that is no longer TV', async () => {
      const show = { id: 2, name: 'MR', folder_name: 'Pinned', library_folder: 'Old' };
      showStore.findChannelShow.mockResolvedValue(show);
      showStore.relocateChannelShow.mockImplementation(async (s, folder) => ({ ...s, library_folder: folder }));
      const placement = await plan();
      expect(showStore.relocateChannelShow).toHaveBeenCalledWith(show, 'TV');
      expect(placement.showDir).toBe(path.join('/data', '__TV', 'Pinned'));
    });

    it('numbers the episode in the show', async () => {
      await plan();
      expect(episodeAllocator.assignDateEpisode).toHaveBeenCalledWith(expect.objectContaining({
        show: expect.objectContaining({ id: 5 }), youtubeId: ID, channelId: 'UC1',
      }));
    });
  });

  describe('earliestEpisodeDate', () => {
    it('reads the date of the lowest assigned episode', async () => {
      VideoClassification.findOne.mockResolvedValue({ season: 2019, episode: 4050000 });
      await expect(episodePlacement.earliestEpisodeDate(5)).resolves.toBe('2019-04-05');
    });

    it('returns null for a show without episodes', async () => {
      VideoClassification.findOne.mockResolvedValue(null);
      await expect(episodePlacement.earliestEpisodeDate(5)).resolves.toBeNull();
    });
  });

  describe('writeEpisodeMetadata', () => {
    let showDir;
    beforeEach(() => { showDir = fs.mkdtempSync(path.join(os.tmpdir(), 'episode-meta-')); });
    afterEach(() => fs.rmSync(showDir, { recursive: true, force: true }));

    const write = () => {
      const seasonDir = path.join(showDir, 'Season 2024');
      fs.mkdirSync(seasonDir);
      return episodePlacement.writeEpisodeMetadata({
        placement: {
          show: { id: 5, name: 'Mark Rober', external_key: 'UC1' }, assignment: ASSIGNMENT, showDir, seasonDir, stem: STEM,
        },
        info: { id: ID, title: 'Big Build', upload_date: '20240315' },
        showPlot: 'Engineering',
      });
    };

    it('writes the episode NFO next to the episode', async () => {
      await write();
      const xml = fs.readFileSync(path.join(showDir, 'Season 2024', `${STEM}.nfo`), 'utf8');
      expect(xml).toContain('<episode>3151200</episode>');
    });

    it('writes a title show\'s tvshow.nfo with its Youtarr id and season names', async () => {
      require('../../../models/tvshowseason').findAll.mockResolvedValue([{ season: 1, name: 'Beyblade' }]);
      const seasonDir = path.join(showDir, 'Season 01');
      fs.mkdirSync(seasonDir);
      await episodePlacement.writeEpisodeMetadata({
        placement: {
          show: { id: 3, kind: 'title', name: 'Beyblade', external_key: 'uuid-3' },
          assignment: { season: 1, episode: 20, dateNumbered: false, episodeTitle: 'Relative' }, showDir, seasonDir, stem: `S01E20 - Relative [${ID}]`,
        },
        info: { id: ID, title: 'x' },
        showPlot: 'Channel description',
      });
      const xml = fs.readFileSync(path.join(showDir, 'tvshow.nfo'), 'utf8');
      expect(xml).toContain('<uniqueid type="youtarr" default="true">uuid-3</uniqueid>');
      expect(xml).toContain('<namedseason number="1">Beyblade</namedseason>');
      expect(xml).not.toContain('Channel description');
      expect(fs.readFileSync(path.join(seasonDir, 'season.nfo'), 'utf8')).toContain('<title>Beyblade</title>');
    });

    it('writes tvshow.nfo with the earliest episode as premiered', async () => {
      VideoClassification.findOne.mockResolvedValue({ season: 2019, episode: 4050000 });
      await write();
      const xml = fs.readFileSync(path.join(showDir, 'tvshow.nfo'), 'utf8');
      expect(xml).toContain('<premiered>2019-04-05</premiered>');
    });
  });

  describe('moveEpisodeFiles', () => {
    let root;
    let source;
    let seasonDir;

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'episode-move-'));
      source = path.join(root, 'temp', 'Mark Rober');
      seasonDir = path.join(root, 'TV', 'Mark Rober', 'Season 2024');
      fs.mkdirSync(source, { recursive: true });
      for (const name of [`MR - Big Build [${ID}].mp4`, `MR - Big Build [${ID}].jpg`, 'MR - Other [zzzzzzzzzzz].mp4']) {
        fs.writeFileSync(path.join(source, name), name);
      }
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('moves the video and its sidecars into the season folder under the stem', async () => {
      await episodePlacement.moveEpisodeFiles({ sourceDir: source, youtubeId: ID, seasonDir, stem: STEM });
      expect(fs.readdirSync(seasonDir).sort()).toEqual([`${STEM}.jpg`, `${STEM}.mp4`]);
    });

    it('leaves other videos in the source folder', async () => {
      await episodePlacement.moveEpisodeFiles({ sourceDir: source, youtubeId: ID, seasonDir, stem: STEM });
      expect(fs.readdirSync(source)).toEqual(['MR - Other [zzzzzzzzzzz].mp4']);
    });

    // Mirrors fs-extra's move across filesystems: with overwrite it removes the
    // destination first, then the copy fails. The earlier episode must not be
    // the destination of that move.
    it('keeps the earlier episode file when the transfer of its replacement fails', async () => {
      fs.mkdirSync(seasonDir, { recursive: true });
      fs.writeFileSync(path.join(seasonDir, `${STEM}.mp4`), 'old');
      const fsExtra = require('fs-extra');
      const realMove = fsExtra.move;
      const move = jest.spyOn(fsExtra, 'move').mockImplementation(async (from, to, opts) => {
        if (!from.endsWith('.mp4')) return realMove(from, to, opts);
        if (opts && opts.overwrite) await fsExtra.remove(to);
        throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
      });
      try {
        await expect(episodePlacement.moveEpisodeFiles({ sourceDir: source, youtubeId: ID, seasonDir, stem: STEM }))
          .rejects.toThrow('no space left on device');
        expect(fs.readFileSync(path.join(seasonDir, `${STEM}.mp4`), 'utf8')).toBe('old');
        expect(fs.readdirSync(seasonDir).filter((name) => name.endsWith('.part'))).toEqual([]);
      } finally {
        move.mockRestore();
      }
    });

    it('replaces older files of the same video in the season folder', async () => {
      fs.mkdirSync(seasonDir, { recursive: true });
      fs.writeFileSync(path.join(seasonDir, `${STEM}.webm`), 'old');
      fs.writeFileSync(path.join(seasonDir, `${STEM}.mp4`), 'old');
      await episodePlacement.moveEpisodeFiles({ sourceDir: source, youtubeId: ID, seasonDir, stem: STEM });
      expect(fs.readdirSync(seasonDir).sort()).toEqual([`${STEM}.jpg`, `${STEM}.mp4`]);
      expect(fs.readFileSync(path.join(seasonDir, `${STEM}.mp4`), 'utf8')).toBe(`MR - Big Build [${ID}].mp4`);
    });
  });
});
