const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ directoryPath: '/data' }));
jest.mock('../../../models/videowatchstatus', () => ({ findAll: jest.fn() }));
jest.mock('../../mediaServers/watchStatusHolds', () => ({
  isHoldable: (row) => !(row.server_type === 'plex' && row.server_user_id !== '1'),
}));
jest.mock('../changeContext', () => ({ resolveChange: jest.fn() }));
jest.mock('../changeScope', () => ({ selectSubjects: jest.fn() }));
jest.mock('../showPlanner', () => ({ planShows: jest.fn() }));
jest.mock('../destinationPlanner', () => ({ planDestinations: jest.fn() }));
jest.mock('../titleSnapshot', () => ({ takeTitleSnapshot: jest.fn(async () => ({ shows: [], rows: [], conflicts: [] })) }));

const item = (overrides = {}) => ({
  videoId: 1,
  youtubeId: 'abcdefghijk',
  channelId: 'UC1',
  title: 'Big Build',
  layout: 'tv',
  fromLayout: 'videos',
  oldVideoPath: '/data/__Kids/Chan/A [abcdefghijk].mp4',
  newVideoPath: '/data/__TV/Chan/Season 2024/S2024E03151200 - A [abcdefghijk].mp4',
  files: [{ from: '/a', to: '/b', size: 1, mtimeMs: 1 }],
  classification: { season: 2024, episode: 3151200, fileStem: 'S2024E03151200 - A [abcdefghijk]' },
  flags: ['adopted'],
  ...overrides,
});

describe('reorganize planner', () => {
  let planner;
  let VideoWatchStatus;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    const context = { type: 'channel', label: 'Chan', stored: { type: 'channel', channelId: 'UC1', subFolder: 'TV' } };
    require('../changeContext').resolveChange.mockResolvedValue(context);
    require('../changeScope').selectSubjects.mockResolvedValue({ subjects: [] });
    require('../showPlanner').planShows.mockResolvedValue({
      targets: new Map(),
      shows: new Map([
        ['UC1', { ownerChannelId: 'UC1', action: 'create', name: 'Chan', libraryFolder: 'TV', folderName: 'Chan' }],
        ['UC9', { ownerChannelId: 'UC9', action: 'create', name: 'Unused', libraryFolder: 'TV', folderName: 'Unused' }],
      ]),
    });
    require('../destinationPlanner').planDestinations.mockResolvedValue({
      items: [item()],
      problems: [{ videoId: 2, youtubeId: 'bbbbbbbbbbb', title: 'B', problem: 'collision', detail: '/data/__TV/x.mp4' }],
      unchanged: 3,
    });
    VideoWatchStatus = require('../../../models/videowatchstatus');
    VideoWatchStatus.findAll.mockResolvedValue([]);
    planner = require('../planner');
  });

  it('keeps only the shows that receive a moved video and computes a revision', async () => {
    const plan = await planner.buildPlan({ type: 'channel' });

    expect(plan.shows.map((show) => show.ownerChannelId)).toEqual(['UC1']);
    expect(plan.revision).toMatch(/^[0-9a-f]{64}$/);
  });

  describe('a title show change', () => {
    const titleItem = item({
      classification: { showKey: 'title:3', kind: 'title', season: 1, episode: 20, source: 'title', fileStem: 'S01E20 - A [abcdefghijk]' },
    });

    beforeEach(() => {
      require('../changeContext').resolveChange.mockResolvedValue({
        type: 'titleShows', label: 'Chan: shows', channel: { channel_id: 'UC1' },
        stored: { type: 'titleShows', channelId: 'UC1', shows: [], overrides: [] },
      });
      require('../showPlanner').planShows.mockResolvedValue({
        targets: new Map(),
        shows: new Map([['title:3', { key: 'title:3', kind: 'title', ownerChannelId: 'UC1', action: 'keep', name: 'Beyblade', libraryFolder: 'TV', folderName: 'Beyblade' }]]),
        titleTargets: new Map([[1, { showKey: 'title:3' }]]),
      });
      require('../destinationPlanner').planDestinations.mockResolvedValue({ items: [titleItem], problems: [], unchanged: 0 });
    });

    it('keeps the title show that receives a moved video', async () => {
      const plan = await planner.buildPlan({ type: 'titleShows' });
      expect(plan.shows.map((show) => show.key)).toEqual(['title:3']);
    });

    it('hands the title targets to the destination planner', async () => {
      await planner.buildPlan({ type: 'titleShows' });
      expect(require('../destinationPlanner').planDestinations.mock.calls[0][0].titleTargets).toEqual(new Map([[1, { showKey: 'title:3' }]]));
    });

    it('snapshots the channel\'s shows and episodes to undo the change', async () => {
      const plan = await planner.buildPlan({ type: 'titleShows' });
      expect(require('../titleSnapshot').takeTitleSnapshot).toHaveBeenCalledWith('UC1');
      expect(plan.snapshot).toEqual({ shows: [], rows: [], conflicts: [] });
    });

    it('shows a title episode code with two-digit numbers', async () => {
      const summary = await planner.summarizePlan(await planner.buildPlan({ type: 'titleShows' }));
      expect(summary.items[0].episode).toBe('S01E20');
    });
  });

  it('takes no snapshot for other changes', async () => {
    const plan = await planner.buildPlan({ type: 'channel' });
    expect([plan.snapshot, require('../titleSnapshot').takeTitleSnapshot.mock.calls.length]).toEqual([null, 0]);
  });

  it('passes the channels on to the show planner', async () => {
    const channels = new Map([['UC1', {}]]);
    require('../changeScope').selectSubjects.mockResolvedValue({ subjects: [], channels });
    await planner.buildPlan({ type: 'channel' });
    expect(require('../showPlanner').planShows.mock.calls[0][2]).toBe(channels);
  });

  it('summarizes the plan for the preview with paths relative to the downloads folder', async () => {
    const plan = await planner.buildPlan({ type: 'channel' });

    const preview = await planner.summarizePlan(plan, { blocked: { reason: 'download-running', message: 'Wait' } });

    expect(preview).toMatchObject({
      needed: true,
      change: { type: 'channel', label: 'Chan' },
      totals: { videos: 1, toTv: 1, toVideos: 0, unchanged: 3, collisions: 1, adopted: 1 },
      items: [{ from: '__Kids/Chan/A [abcdefghijk].mp4', to: '__TV/Chan/Season 2024/S2024E03151200 - A [abcdefghijk].mp4', episode: 'S2024E03151200' }],
      problems: [{ problem: 'collision', detail: '__TV/x.mp4' }],
      blocked: { reason: 'download-running' },
    });
  });

  it('names the MP3 in the preview when a relocation moves no video file', async () => {
    require('../destinationPlanner').planDestinations.mockResolvedValue({
      items: [item({
        relocate: true, layout: 'videos', classification: null, flags: [],
        oldVideoPath: '/data/Chan/A [abcdefghijk].mp4', newVideoPath: null,
        oldAudioPath: '/data/Chan/A [abcdefghijk].mp3', newAudioPath: '/data/__Videos/Chan/A [abcdefghijk].mp3',
      })],
      problems: [],
    });
    const preview = await planner.summarizePlan(await planner.buildPlan({ type: 'channel' }));
    expect(preview.items[0]).toMatchObject({ from: 'Chan/A [abcdefghijk].mp3', to: '__Videos/Chan/A [abcdefghijk].mp3' });
  });

  it('counts the MP3 files that move into a TV folder', async () => {
    require('../destinationPlanner').planDestinations.mockResolvedValue({
      items: [item({ flags: ['audio-to-tv'] }), item({ youtubeId: 'ccccccccccc' })], problems: [],
    });
    const preview = await planner.summarizePlan(await planner.buildPlan({ type: 'channel' }));
    expect(preview.totals.audioToTv).toBe(1);
  });

  it('names the TV folders videos move into', async () => {
    require('../destinationPlanner').planDestinations.mockResolvedValue({
      items: [item({ libraryFolder: 'TV' }), item({ youtubeId: 'ccccccccccc', libraryFolder: '', layout: 'tv' }), item({ youtubeId: 'ddddddddddd', layout: 'videos', libraryFolder: 'Kids' })],
      problems: [],
      unchanged: 0,
    });
    const plan = await planner.buildPlan({ type: 'channel' });

    const preview = await planner.summarizePlan(plan);

    expect(preview.tvFolders).toEqual(['TV', '']);
  });

  it('counts videos whose watch state the servers will lose, leaving out other Plex accounts', async () => {
    VideoWatchStatus.findAll.mockResolvedValue([
      { video_id: 1, server_type: 'jellyfin', server_user_id: 'u1', played: true },
      { video_id: 1, server_type: 'jellyfin', server_user_id: 'u2', played: true },
      { video_id: 1, server_type: 'plex', server_user_id: '5', played: true },
    ]);
    const plan = await planner.buildPlan({ type: 'channel' });

    const preview = await planner.summarizePlan(plan);

    expect(preview.watchState).toEqual([{ serverType: 'jellyfin', videos: 1, users: 2 }]);
  });

  it('reports that nothing needs to move', async () => {
    require('../destinationPlanner').planDestinations.mockResolvedValue({ items: [], problems: [], unchanged: 0 });
    const plan = await planner.buildPlan({ type: 'channel' });

    await expect(planner.summarizePlan(plan)).resolves.toMatchObject({ needed: false, shows: [], blocked: null });
  });

  it('refuses to apply a change none of whose videos could be planned', async () => {
    require('../destinationPlanner').planDestinations.mockResolvedValue({
      items: [], unchanged: 0,
      problems: [{ videoId: 2, youtubeId: 'bbbbbbbbbbb', title: 'B', problem: 'no-name', detail: null }],
    });
    const plan = await planner.buildPlan({ type: 'channel' });

    expect(planner.applyRefusal(plan)).toMatchObject({ reason: 'problems' });
    await expect(planner.summarizePlan(plan)).resolves.toMatchObject({ needed: false, blocked: { reason: 'problems' } });
  });

  it('still applies directly when the only problems are files that are gone', async () => {
    require('../destinationPlanner').planDestinations.mockResolvedValue({
      items: [], unchanged: 1,
      problems: [{ videoId: 2, youtubeId: 'bbbbbbbbbbb', title: 'B', problem: 'missing', detail: null }],
    });
    const plan = await planner.buildPlan({ type: 'channel' });

    expect(planner.applyRefusal(plan)).toBeNull();
  });

  describe('main folder moves', () => {
    let root;

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-main-'));
      require('../../configModule').directoryPath = root;
    });

    afterEach(() => {
      fs.rmSync(root, { recursive: true, force: true });
      require('../../configModule').directoryPath = '/data';
    });

    const write = (relative) => {
      const full = path.join(root, relative);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, 'x');
      return full;
    };
    const basePlan = () => ({ context: { type: 'channel', label: 'Chan', stored: { type: 'channel' } }, items: [], problems: [], unchanged: 0, shows: [], revision: 'r' });
    const mainPlan = (moving) => ({
      ...basePlan(),
      context: { type: 'mainFolderMove', stored: { type: 'mainFolderMove' }, label: 'the main folder' },
      items: moving.map((from, index) => item({ videoId: index + 1, files: [{ from, to: `${from}.moved` }] })),
    });

    it('lists a file no planned move takes inside a folder that moves', async () => {
      const tracked = write('Chan/a [abcdefghijk].mp4');
      write('Chan/unknown.mp4');
      const summary = await planner.summarizePlan(mainPlan([tracked]));
      expect(summary.leftInMain).toEqual({ count: 1, paths: [path.join('Chan', 'unknown.mp4')], truncated: false });
    });

    it('lists files in folders nothing moves, and skips __ folders, hidden files and channel art', async () => {
      const tracked = write('Chan/a [abcdefghijk].mp4');
      write('Chan/poster.jpg');
      write('My Movies/film.mkv');
      write('__Kids/Other/b [bbbbbbbbbbb].mp4');
      write('.plexignore');
      write('notes.txt');
      const summary = await planner.summarizePlan(mainPlan([tracked]));
      expect(summary.leftInMain.paths).toEqual([path.join('My Movies', 'film.mkv'), 'notes.txt']);
    });

    it('skips an unreadable folder, lists the rest and marks the list incomplete', async () => {
      const tracked = write('Chan/a [abcdefghijk].mp4');
      write('notes.txt');
      write('lost+found/x.txt');
      const realReaddir = fs.promises.readdir;
      const spy = jest.spyOn(fs.promises, 'readdir').mockImplementation((dir, ...args) => {
        if (dir === path.join(root, 'lost+found')) return Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' }));
        return realReaddir(dir, ...args);
      });
      try {
        const summary = await planner.summarizePlan(mainPlan([tracked]));
        expect(summary.leftInMain).toEqual({ count: 1, paths: ['notes.txt'], truncated: true });
        expect(require('../../../logger').warn).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });

    it('skips the walk while the preview is blocked', async () => {
      write('notes.txt');
      const summary = await planner.summarizePlan(mainPlan([]), { blocked: { reason: 'download-running', message: 'Wait' } });
      expect(summary.leftInMain).toBeNull();
    });

    it('has no leftovers for other changes', async () => {
      expect((await planner.summarizePlan(basePlan())).leftInMain).toBeNull();
    });
  });
});
