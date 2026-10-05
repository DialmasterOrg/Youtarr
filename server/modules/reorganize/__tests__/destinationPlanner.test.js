jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ getConfig: jest.fn(() => ({})), directoryPath: null }));
jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn() }));
jest.mock('../../videoInfoStore', () => ({ readInfoOrFallback: jest.fn() }));
jest.mock('../movieNameRenderer', () => ({ renderMovieNames: jest.fn() }));
jest.mock('../../tvShows/titleShowStore', () => ({ highWaterMarks: jest.fn(async () => new Map()) }));
jest.mock('../showPlanner', () => {
  const path = require('path');
  return {
    plannedShowDirectory: (show) => path.join(require('../../configModule').directoryPath,
      show.libraryFolder ? `__${show.libraryFolder}` : '', show.folderName),
  };
});

const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'abcdefghijk';
// 2024-03-15 12:00:00 UTC
const TIMESTAMP = 1710504000;

describe('reorganize destinationPlanner', () => {
  let planner;
  let configModule;
  let VideoClassification;
  let videoInfoStore;
  let movieNameRenderer;
  let root;

  const touch = (relativePath, content = 'x') => {
    const full = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
  };

  const show = { ownerChannelId: 'UC1', showId: null, name: 'Chan', libraryFolder: 'TV', folderName: 'Chan' };
  const owner = { channel_id: 'UC1', folder_name: 'Chan', uploader: 'Chan', skip_video_folder: null };
  const tvContext = { type: 'channel', folderBefore: () => 'Kids' };

  const subjectFor = (filePath, overrides = {}) => ({
    video: {
      id: 1, youtubeId: ID, filePath, audioFilePath: null, youTubeVideoName: 'Big Build', youTubeChannelName: 'Chan',
      last_downloaded_at: null, ...overrides.video,
    },
    ownerChannelId: 'UC1',
    ownerChannel: owner,
    libraryFolder: 'Kids',
    currentLayout: 'videos',
    ...overrides.subject,
  });

  const planTo = (subject, target, shows = new Map([['UC1', show]])) => planner.planDestinations({
    subjects: [subject], context: tvContext, targets: new Map([[subject.video.id, target]]), shows,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'reorganize-plan-'));
    configModule = require('../../configModule');
    configModule.directoryPath = root;
    VideoClassification = require('../../../models/videoclassification');
    VideoClassification.findAll.mockResolvedValue([]);
    videoInfoStore = require('../../videoInfoStore');
    videoInfoStore.readInfoOrFallback.mockResolvedValue({ id: ID, title: 'Big Build', timestamp: TIMESTAMP });
    movieNameRenderer = require('../movieNameRenderer');
    movieNameRenderer.renderMovieNames.mockResolvedValue(new Map());
    planner = require('../destinationPlanner');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('Videos to TV', () => {
    it('renames the video\'s files to the episode stem in its season folder', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build - ${ID}/Chan - Big Build [${ID}].mp4`);
      touch(`__Kids/Chan/Chan - Big Build - ${ID}/Chan - Big Build [${ID}].jpg`);
      touch(`__Kids/Chan/Chan - Big Build - ${ID}/Chan - Big Build [${ID}].en.srt`);
      touch(`__Kids/Chan/Chan - Big Build - ${ID}/Chan - Big Build [${ID}].nfo`);

      const { items, problems } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

      expect(problems).toEqual([]);
      const seasonDir = path.join(root, '__TV', 'Chan', 'Season 2024');
      const stem = `S2024E03151200 - Big Build [${ID}]`;
      expect(items[0].files.map((file) => file.to).sort()).toEqual([
        path.join(seasonDir, `${stem}.en.srt`), path.join(seasonDir, `${stem}.jpg`), path.join(seasonDir, `${stem}.mp4`),
      ]);
      expect(items[0].nfoSources).toEqual([videoPath.replace(/\.mp4$/, '.nfo')]);
      expect(items[0].newVideoPath).toBe(path.join(seasonDir, `${stem}.mp4`));
      expect(items[0].classification).toMatchObject({ season: 2024, episode: 3151200, source: 'date', fileStem: stem });
      expect(items[0].flags).toContain('movie-tags');
    });

    it('flags a video whose MP3 file moves into a TV folder', async () => {
      const audioPath = touch(`__Kids/Chan/Chan - Big Build - ${ID}/Chan - Big Build [${ID}].mp3`);

      const { items } = await planTo(subjectFor(null, { video: { audioFilePath: audioPath } }), { libraryFolder: 'TV', layout: 'tv' });

      expect(items[0].flags).toContain('audio-to-tv');
    });

    it('does not flag a video without an MP3 file', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build - ${ID}/Chan - Big Build [${ID}].mp4`);

      const { items } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

      expect(items[0].flags).not.toContain('audio-to-tv');
    });

    it('keeps the code of a file named by the Plex TV Series preset', async () => {
      const videoPath = touch(`Chan/S2024E03151230 Big Build [${ID}].mp4`);

      const { items } = await planTo(subjectFor(videoPath, { subject: { libraryFolder: '' } }), { libraryFolder: 'TV', layout: 'tv' });

      expect(items[0].classification).toMatchObject({ episode: 3151230, source: 'adopted' });
      expect(items[0].flags).toContain('adopted');
    });

    it('reuses a number the video already holds in the show', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      VideoClassification.findAll.mockResolvedValue([{
        youtube_id: ID, show_id: 5, status: 'assigned', season: 2024, episode: 3151201, source: 'date',
        timestamp_source: 'timestamp', episode_title: 'Old title', file_stem: `S2024E03151201 - Old title [${ID}]`,
      }]);

      const { items } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' },
        new Map([['UC1', { ...show, showId: 5 }]]));

      expect(items[0].classification).toMatchObject({ episode: 3151201, fileStem: `S2024E03151201 - Old title [${ID}]` });
    });

    it('numbers by the download time when there is no upload date', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      videoInfoStore.readInfoOrFallback.mockResolvedValue({ id: ID, title: 'Big Build' });

      const { items } = await planTo(
        subjectFor(videoPath, { video: { last_downloaded_at: '2025-01-02T03:04:00Z' } }),
        { libraryFolder: 'TV', layout: 'tv' }
      );

      expect(items[0].classification).toMatchObject({ season: 2025, episode: 1020304, timestampSource: null });
      expect(items[0].flags).toContain('download-time');
    });

    it('reports a video with no date at all', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      videoInfoStore.readInfoOrFallback.mockResolvedValue({ id: ID, title: 'Big Build' });

      const { items, problems } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

      expect(items).toEqual([]);
      expect(problems).toEqual([expect.objectContaining({ youtubeId: ID, problem: 'no-date' })]);
    });
  });

  describe('Videos to a title show', () => {
    const titleShow = { key: 'title:3', kind: 'title', ownerChannelId: 'UC1', showId: 3, name: 'Beyblade', libraryFolder: 'TV', folderName: 'Beyblade' };
    const target = { libraryFolder: 'TV', layout: 'tv', showKey: 'title:3' };
    const planTitle = (subject, titleTarget, context = tvContext) => planner.planDestinations({
      subjects: [subject],
      context,
      targets: new Map([[subject.video.id, target]]),
      shows: new Map([['title:3', titleShow]]),
      titleTargets: new Map([[subject.video.id, titleTarget]]),
    });
    const assigned = { showKey: 'title:3', status: 'assigned', season: 1, episode: 20, source: 'title', episodeTitle: 'Relative' };

    it('moves the video into the show\'s season folder under its title number', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      const { items, problems } = await planTitle(subjectFor(videoPath), { showKey: 'title:3', after: assigned, pattern: null, stored: null });
      expect(problems).toEqual([]);
      expect(items[0].newVideoPath).toBe(path.join(root, '__TV', 'Beyblade', 'Season 01', `S01E20 - Relative [${ID}].mp4`));
      expect(items[0].classification).toMatchObject({ showKey: 'title:3', kind: 'title', season: 1, episode: 20, source: 'title' });
    });

    it('numbers a video waiting for an upload-time number from its info', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      const { items } = await planTitle(subjectFor(videoPath), {
        showKey: 'title:3', after: { ...assigned, status: 'pending_number', season: null, episode: null }, pattern: { seasonSource: 'year', episodeSource: 'date' }, stored: null,
      });
      expect(items[0].classification).toMatchObject({ season: 2024, episode: 3151200, source: 'date' });
    });

    it('flags a title episode numbered by its download time for the review', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      videoInfoStore.readInfoOrFallback.mockResolvedValue({ id: ID, title: 'Big Build' });
      const subject = subjectFor(videoPath, { video: { last_downloaded_at: '2024-03-15T12:00:00.000Z' } });
      const { items } = await planTitle(subject, {
        showKey: 'title:3', after: { ...assigned, status: 'pending_number', season: null, episode: null }, pattern: { seasonSource: 'year', episodeSource: 'date' }, stored: null,
      });
      expect(items[0].flags).toContain('download-time');
    });

    it('keeps clear of numbers the title plan gives other videos', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      const context = {
        ...tvContext,
        type: 'titleShows',
        titlePlan: { entries: [{ youtubeId: 'other000000', after: { showKey: 'title:3', status: 'assigned', season: 2024, episode: 3151200 } }] },
      };
      const { items } = await planTitle(subjectFor(videoPath), {
        showKey: 'title:3', after: { ...assigned, status: 'pending_number', season: null, episode: null }, pattern: { seasonSource: 'year', episodeSource: 'date' }, stored: null,
      }, context);
      expect(items[0].classification.episode).toBe(3151201);
    });

    it('reports a waiting video with no time at all', async () => {
      videoInfoStore.readInfoOrFallback.mockResolvedValue({ id: ID, title: 'Big Build' });
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      const { problems } = await planTitle(subjectFor(videoPath), {
        showKey: 'title:3', after: { ...assigned, status: 'pending_number', season: null, episode: null }, pattern: { seasonSource: 'year', episodeSource: 'date' }, stored: null,
      });
      expect(problems.map((problem) => problem.problem)).toEqual(['no-date']);
    });

    it('does not count an episode of a title show as placed by a download override', async () => {
      const videoPath = touch(`__TV/Beyblade/Season 01/S01E19 - Relative [${ID}].mp4`);
      const subject = subjectFor(videoPath, { subject: { libraryFolder: 'TV', currentLayout: 'tv' } });
      const context = {
        ...tvContext,
        type: 'titleShows',
        titlePlan: { entries: [], stored: new Map([[ID, { showKey: 'title:3', showKind: 'title', status: 'assigned', season: 1, episode: 19 }]]) },
      };
      const { items } = await planTitle(subject, { showKey: 'title:3', after: assigned, pattern: null, stored: null }, context);
      expect(items[0].flags).not.toContain('override-placed');
    });

    it('reports a waiting title episode whose number another video holds', async () => {
      const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
      const context = {
        ...tvContext,
        type: 'titleShows',
        titlePlan: { entries: [{ youtubeId: 'other000000', after: { showKey: 'title:3', status: 'assigned', season: 2024, episode: 4 } }] },
      };
      const { problems } = await planTitle(subjectFor(videoPath), {
        showKey: 'title:3', after: { ...assigned, status: 'pending_number', season: null, episode: 4 }, pattern: { seasonSource: 'year', episodeSource: 'title' }, stored: null,
      }, context);
      expect(problems.map((problem) => problem.problem)).toEqual(['episode-taken']);
    });
  });

  describe('TV to Videos', () => {
    const tvSubject = (videoPath) => subjectFor(videoPath, { subject: { libraryFolder: 'TV', currentLayout: 'tv' } });

    beforeEach(() => {
      movieNameRenderer.renderMovieNames.mockResolvedValue(new Map([[ID, {
        channelFolder: 'Uploader', videoFolder: `Chan - Big Build - ${ID}`, stem: `Chan - Big Build [${ID}]`,
      }]]));
    });

    it('moves the episode to a per-video folder in the channel\'s folder', async () => {
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);

      const { items } = await planTo(tvSubject(videoPath), { libraryFolder: 'Kids', layout: 'videos' });

      expect(items[0].newVideoPath).toBe(path.join(root, '__Kids', 'Chan', `Chan - Big Build - ${ID}`, `Chan - Big Build [${ID}].mp4`));
      expect(items[0].classification).toBeNull();
    });

    it('counts a video another folder holds as placed by a download override', async () => {
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);
      const { items } = await planTo(tvSubject(videoPath), { libraryFolder: 'Kids', layout: 'videos' });
      expect(items[0].flags).toContain('override-placed');
    });

    it('does not count an episode leaving a title show as placed by a download override', async () => {
      const videoPath = touch(`__TV/Beyblade/Season 01/S01E19 - Relative [${ID}].mp4`);
      const context = {
        ...tvContext,
        type: 'titleShows',
        titlePlan: { entries: [], stored: new Map([[ID, { showKey: 'title:3', showKind: 'title', status: 'assigned', season: 1, episode: 19 }]]) },
      };
      const { items } = await planner.planDestinations({
        subjects: [tvSubject(videoPath)], context, targets: new Map([[1, { libraryFolder: 'Kids', layout: 'videos' }]]), shows: new Map(),
      });
      expect(items[0].flags).not.toContain('override-placed');
    });

    it('moves the episode flat into the channel folder when the channel saves flat', async () => {
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);
      const subject = tvSubject(videoPath);
      subject.ownerChannel = { ...owner, skip_video_folder: true };

      const { items } = await planTo(subject, { libraryFolder: 'Kids', layout: 'videos' });

      expect(items[0].newVideoPath).toBe(path.join(root, '__Kids', 'Chan', `Chan - Big Build [${ID}].mp4`));
    });

    it('uses the rendered channel folder for an untracked channel', async () => {
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);
      const subject = tvSubject(videoPath);
      subject.ownerChannel = null;

      const { items } = await planTo(subject, { libraryFolder: '', layout: 'videos' });

      expect(items[0].newVideoPath.startsWith(path.join(root, 'Uploader'))).toBe(true);
    });

    it('reports a video yt-dlp could not name', async () => {
      movieNameRenderer.renderMovieNames.mockResolvedValue(new Map());
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);

      const { problems } = await planTo(tvSubject(videoPath), { libraryFolder: 'Kids', layout: 'videos' });

      expect(problems).toEqual([expect.objectContaining({ problem: 'no-name' })]);
    });

    it('uses the rendered channel folder, never the raw uploader name, when the channel has no folder name', async () => {
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);
      const subject = tvSubject(videoPath);
      subject.ownerChannel = { ...owner, folder_name: null, uploader: '24/7 News' };

      const { items } = await planTo(subject, { libraryFolder: 'Kids', layout: 'videos' });

      expect(items[0].newVideoPath.startsWith(path.join(root, '__Kids', 'Uploader'))).toBe(true);
    });

    it('reports a destination that would leave the downloads folder', async () => {
      movieNameRenderer.renderMovieNames.mockResolvedValue(new Map([[ID, {
        channelFolder: '..', videoFolder: `Chan - Big Build - ${ID}`, stem: `Chan - Big Build [${ID}]`,
      }]]));
      const videoPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);
      const subject = tvSubject(videoPath);
      subject.ownerChannel = null;

      const { items, problems } = await planTo(subject, { libraryFolder: '', layout: 'videos' });

      expect(items).toEqual([]);
      expect(problems).toEqual([expect.objectContaining({ problem: 'unsafe-name' })]);
    });
  });

  it('reads a folder once however many videos it holds', async () => {
    const second = 'bcdefghijkl';
    const first = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
    touch(`__Kids/Chan/Chan - Big Build [${ID}].jpg`);
    const other = touch(`__Kids/Chan/Chan - Other [${second}].mp4`);
    const subjects = [
      subjectFor(first),
      subjectFor(other, { video: { id: 2, youtubeId: second, youTubeVideoName: 'Other' } }),
    ];
    videoInfoStore.readInfoOrFallback.mockImplementation(async (video) => ({ id: video.youtubeId, title: video.youTubeVideoName, timestamp: TIMESTAMP }));
    const readdir = jest.spyOn(fs.promises, 'readdir');

    const { items } = await planner.planDestinations({
      subjects, context: tvContext, targets: new Map([[1, { libraryFolder: 'TV', layout: 'tv' }], [2, { libraryFolder: 'TV', layout: 'tv' }]]), shows: new Map([['UC1', show]]),
    });

    expect(readdir).toHaveBeenCalledTimes(1);
    expect(items.map((item) => item.files.map((file) => path.basename(file.from)).sort())).toEqual([
      [`Chan - Big Build [${ID}].jpg`, `Chan - Big Build [${ID}].mp4`],
      [`Chan - Other [${second}].mp4`],
    ]);
  });

  it('reports a video whose file is missing', async () => {
    const { items, problems } = await planTo(subjectFor(path.join(root, '__Kids/Chan/Gone [abcdefghijk].mp4')),
      { libraryFolder: 'TV', layout: 'tv' });

    expect(items).toEqual([]);
    expect(problems).toEqual([expect.objectContaining({ problem: 'missing' })]);
  });

  it('reports a destination held by another file but still plans the move', async () => {
    const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
    touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`, 'other');

    const { items, problems } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

    expect(items).toHaveLength(1);
    expect(problems).toEqual([expect.objectContaining({ problem: 'collision' })]);
  });

  // A case-only rename on a case-insensitive filesystem: the destination
  // spelling opens the source itself (a hard link stands in for it here).
  it('does not report a destination that is the source file under another spelling', async () => {
    const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
    const destination = path.join(root, `__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.linkSync(videoPath, destination);

    const { items, problems } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

    expect([items.length, problems]).toEqual([1, []]);
  });

  it('checks a destination against the source as first read, not a second look', async () => {
    const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
    touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp4`, 'other');
    const realStat = fs.promises.stat;
    let sourceStats = 0;
    // The source vanishes right after planning read it.
    const stat = jest.spyOn(fs.promises, 'stat').mockImplementation(async (target, ...rest) => {
      if (target === videoPath && ++sourceStats > 1) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
      return realStat(target, ...rest);
    });

    const planned = planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });
    const { problems } = await planned.finally(() => stat.mockRestore());

    expect(problems).toEqual([expect.objectContaining({ problem: 'collision' })]);
  });

  it('reports a file where the destination folder belongs as a collision', async () => {
    const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
    touch('__TV/Chan/Season 2024', 'not a folder');

    const { items, problems } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

    expect(items).toHaveLength(1);
    expect(problems).toEqual([expect.objectContaining({ problem: 'collision' })]);
  });

  it('leaves out leftovers of interrupted downloads and moves', async () => {
    const videoPath = touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4`);
    touch(`__Kids/Chan/Chan - Big Build [${ID}].mp4.part`);
    touch(`__Kids/Chan/Chan - Big Build [${ID}].jpg.reorganize.part`);

    const { items } = await planTo(subjectFor(videoPath), { libraryFolder: 'TV', layout: 'tv' });

    expect(items[0].files).toHaveLength(1);
  });

  it('does not flag an MP3 that is already in a TV folder', async () => {
    const audioPath = touch(`__TV/Chan/Season 2024/S2024E03151200 - Big Build [${ID}].mp3`);
    const subject = subjectFor(null, { video: { audioFilePath: audioPath }, subject: { libraryFolder: 'TV', currentLayout: 'tv' } });

    const { items } = await planTo(subject, { libraryFolder: 'TV2', layout: 'tv' }, new Map([['UC1', { ...show, libraryFolder: 'TV2' }]]));

    expect(items[0].flags).not.toContain('audio-to-tv');
  });

  it('counts a video already where it belongs as unchanged', async () => {
    const stem = `S2024E03151200 - Big Build [${ID}]`;
    const videoPath = touch(`__TV/Chan/Season 2024/${stem}.mp4`);

    const result = await planTo(subjectFor(videoPath, { subject: { libraryFolder: 'TV', currentLayout: 'tv' } }),
      { libraryFolder: 'TV', layout: 'tv' });

    expect(result.items).toEqual([]);
    expect(result.unchanged).toBe(1);
  });
});
