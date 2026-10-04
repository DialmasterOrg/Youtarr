jest.mock('../../configModule', () => ({ directoryPath: '/data' }));
jest.mock('../../../models/videowatchstatus', () => ({ findAll: jest.fn() }));
jest.mock('../../mediaServers/watchStatusHolds', () => ({
  isHoldable: (row) => !(row.server_type === 'plex' && row.server_user_id !== '1'),
}));
jest.mock('../changeContext', () => ({ resolveChange: jest.fn() }));
jest.mock('../changeScope', () => ({ selectSubjects: jest.fn() }));
jest.mock('../showPlanner', () => ({ planShows: jest.fn() }));
jest.mock('../destinationPlanner', () => ({ planDestinations: jest.fn() }));

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
});
