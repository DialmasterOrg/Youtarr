jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ directoryPath: null }));
jest.mock('../../../models/video', () => ({ findByPk: jest.fn(), update: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findByPk: jest.fn(), create: jest.fn() }));
jest.mock('../../videoInfoStore', () => ({
  readInfoOrFallback: jest.fn().mockResolvedValue({ id: 'abcdefghijk', title: 'Big Build' }),
  rewriteActualPaths: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../sidecarWriter', () => ({ writeVideoSidecars: jest.fn().mockResolvedValue([]) }));
jest.mock('../../tvShows/titleShowStore', () => ({ raiseHighWater: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'abcdefghijk';
const STEM = `S2024E03151200 - Big Build [${ID}]`;

describe('reorganize itemExecutor', () => {
  let executor;
  let configModule;
  let Video;
  let VideoClassification;
  let videoInfoStore;
  let sidecarWriter;
  let root;
  let sourceDir;
  let seasonDir;

  const at = (...segments) => path.join(root, ...segments);
  const touch = (filePath, content = 'x') => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  const classification = {
    ownerChannelId: 'UC1', showTitle: 'Chan', season: 2024, episode: 3151200, source: 'date',
    timestampSource: 'timestamp', episodeTitle: 'Big Build', fileStem: STEM,
  };

  function toTvRecord() {
    const oldVideo = path.join(sourceDir, `Chan - Big Build [${ID}].mp4`);
    const oldThumb = path.join(sourceDir, `Chan - Big Build [${ID}].jpg`);
    const plan = {
      files: [
        { from: oldVideo, to: path.join(seasonDir, `${STEM}.mp4`) },
        { from: oldThumb, to: path.join(seasonDir, `${STEM}.jpg`) },
      ],
      nfoSources: [path.join(sourceDir, `Chan - Big Build [${ID}].nfo`)],
      sourceDirs: [sourceDir],
      oldVideoPath: oldVideo,
      newVideoPath: path.join(seasonDir, `${STEM}.mp4`),
      oldAudioPath: null,
      newAudioPath: null,
      layout: 'tv',
      fromLayout: 'videos',
    };
    return { youtube_id: ID, video_id: 1, files: JSON.stringify(plan), classification: JSON.stringify(classification), plan };
  }

  const videoRow = (filePath) => ({
    id: 1, youtubeId: ID, filePath, audioFilePath: null, fileSize: 1, audioFileSize: null,
    video_resolution: null, last_downloaded_at: null, removed: false,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'reorganize-item-'));
    sourceDir = at('__Kids', 'Chan', `Chan - Big Build - ${ID}`);
    seasonDir = at('__TV', 'Chan', 'Season 2024');
    configModule = require('../../configModule');
    configModule.directoryPath = root;
    Video = require('../../../models/video');
    Video.update.mockResolvedValue([1]);
    VideoClassification = require('../../../models/videoclassification');
    VideoClassification.findByPk.mockResolvedValue(null);
    videoInfoStore = require('../../videoInfoStore');
    sidecarWriter = require('../../sidecarWriter');
    executor = require('../itemExecutor');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('a title show episode', () => {
    const titleRecord = (extra = {}) => {
      const record = toTvRecord();
      return {
        ...record,
        classification: JSON.stringify({ ...classification, showKey: 'new:0', kind: 'title', season: 1, episode: 7, source: 'order', ...extra }),
      };
    };

    it('stores the episode in the title show found by its key, keeping the row\'s pattern', async () => {
      const record = titleRecord();
      touch(record.plan.oldVideoPath, 'video');
      Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));
      const stored = { update: jest.fn() };
      VideoClassification.findByPk.mockResolvedValue(stored);
      const showIdFor = jest.fn((key) => (key === 'new:0' ? 9 : null));
      await executor.executeItem(record, { showIdFor });
      expect(showIdFor).toHaveBeenCalledWith('new:0');
      const values = stored.update.mock.calls[0][0];
      expect([values.show_id, values.season, values.episode, 'pattern_id' in values]).toEqual([9, 1, 7, false]);
    });

    it('raises the season\'s high-water mark for an order number', async () => {
      const record = titleRecord();
      touch(record.plan.oldVideoPath, 'video');
      Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));
      await executor.executeItem(record, { showIdFor: () => 9 });
      expect(require('../../tvShows/titleShowStore').raiseHighWater).toHaveBeenCalledWith(9, 1, 7);
    });
  });

  it('moves a movie-style video into its season folder as an episode', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    touch(record.plan.files[1].from, 'thumb');
    touch(record.plan.nfoSources[0], '<movie/>');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await executor.executeItem(record, { showIdFor: () => 5 });

    expect(fs.readFileSync(record.plan.newVideoPath, 'utf8')).toBe('video');
    expect(fs.existsSync(path.join(seasonDir, `${STEM}.jpg`))).toBe(true);
    expect(fs.existsSync(record.plan.nfoSources[0])).toBe(false);
    expect(fs.existsSync(sourceDir)).toBe(false);
    expect(VideoClassification.create).toHaveBeenCalledWith(expect.objectContaining({
      youtube_id: ID, show_id: 5, season: 2024, episode: 3151200, file_stem: STEM, status: 'assigned',
    }));
    expect(sidecarWriter.writeVideoSidecars).toHaveBeenCalledWith(expect.objectContaining({
      videoPath: record.plan.newVideoPath,
      episode: { showTitle: 'Chan', season: 2024, episode: 3151200, episodeTitle: 'Big Build' },
    }));
    expect(Video.update).toHaveBeenCalledWith({ filePath: record.plan.newVideoPath, audioFilePath: null }, expect.anything());
    expect(videoInfoStore.rewriteActualPaths).toHaveBeenCalledWith(ID, expect.any(Map));
  });

  it('finishes a move a restart interrupted after the files moved', async () => {
    const record = toTvRecord();
    touch(record.plan.newVideoPath, 'video');
    touch(path.join(seasonDir, `${STEM}.jpg`), 'thumb');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await executor.executeItem(record, { showIdFor: () => 5 });

    expect(Video.update).toHaveBeenCalledWith({ filePath: record.plan.newVideoPath, audioFilePath: null }, expect.anything());
  });

  it('skips the row update when a restart came after it', async () => {
    const record = toTvRecord();
    touch(record.plan.newVideoPath, 'video');
    touch(path.join(seasonDir, `${STEM}.jpg`), 'thumb');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.newVideoPath));

    await executor.executeItem(record, { showIdFor: () => 5 });

    expect(Video.update).not.toHaveBeenCalled();
  });

  it('moves the earlier files back when a later one can\'t move', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    touch(record.plan.files[1].from, 'thumb');
    touch(path.join(seasonDir, `${STEM}.jpg`), 'someone else');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toMatchObject({ code: 'EEXIST' });

    expect(fs.readFileSync(record.plan.oldVideoPath, 'utf8')).toBe('video');
    expect(fs.existsSync(record.plan.newVideoPath)).toBe(false);
    expect(Video.update).not.toHaveBeenCalled();
  });

  it('refuses a video whose files changed since the preview', async () => {
    const record = toTvRecord();
    Video.findByPk.mockResolvedValue(videoRow(at('elsewhere.mp4')));

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toThrow(/changed since the preview/);
  });

  it('refuses a video that was marked missing', async () => {
    const record = toTvRecord();
    Video.findByPk.mockResolvedValue({ ...videoRow(record.plan.oldVideoPath), removed: true });

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toThrow(/marked missing/);
  });

  it('reports a row another writer changed while the files moved', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    touch(record.plan.files[1].from, 'thumb');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));
    Video.update.mockResolvedValue([0]);

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toThrow(/rescan corrects/);
  });

  it('marks a failure after the files moved as such, leaving the files at their destination', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    touch(record.plan.files[1].from, 'thumb');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));
    sidecarWriter.writeVideoSidecars.mockRejectedValueOnce(new Error('EACCES: nfo'));

    await expect(executor.executeItem(record, { showIdFor: () => 5 }))
      .rejects.toMatchObject({ filesMoved: true, message: expect.stringMatching(/files were moved.*EACCES: nfo/) });

    expect(fs.readFileSync(record.plan.newVideoPath, 'utf8')).toBe('video');
    expect(fs.existsSync(record.plan.oldVideoPath)).toBe(false);
  });

  it('refuses a destination outside the downloads folder before moving anything', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    const outside = path.join(path.dirname(root), 'escaped.mp4');
    record.plan.files[0].to = outside;
    record.files = JSON.stringify(record.plan);
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toThrow(/outside the downloads folder/);

    expect(fs.existsSync(outside)).toBe(false);
    expect(fs.existsSync(record.plan.oldVideoPath)).toBe(true);
  });

  it('returns the media home when a retry\'s later move fails after an earlier attempt moved it', async () => {
    const record = toTvRecord();
    // The first attempt moved the video and stopped; the thumbnail's destination is now taken.
    touch(record.plan.newVideoPath, 'video');
    touch(record.plan.files[1].from, 'thumb');
    touch(path.join(seasonDir, `${STEM}.jpg`), 'someone else');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toMatchObject({ code: 'EEXIST', filesMoved: false });

    expect(fs.readFileSync(record.plan.oldVideoPath, 'utf8')).toBe('video');
    expect(fs.existsSync(record.plan.newVideoPath)).toBe(false);
    expect(fs.existsSync(record.plan.files[1].from)).toBe(true);
  });

  it('reports files it could not bring home as moved', async () => {
    const record = toTvRecord();
    touch(record.plan.newVideoPath, 'video');
    const thumbFrom = at('__Kids', 'Chan', 'elsewhere', `Chan - Big Build [${ID}].jpg`);
    record.plan.files[1].from = touch(thumbFrom, 'thumb');
    record.plan.sourceDirs = [sourceDir, path.dirname(thumbFrom)];
    record.files = JSON.stringify(record.plan);
    touch(path.join(seasonDir, `${STEM}.jpg`), 'someone else');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));
    // The video's source folder is now a file, so nothing can be moved back into it.
    fs.rmSync(sourceDir, { recursive: true, force: true });
    touch(sourceDir, 'not a folder');

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toMatchObject({ code: 'EEXIST', filesMoved: true });

    expect(fs.existsSync(record.plan.newVideoPath)).toBe(true);
  });

  it('skips a thumbnail that vanished since the preview', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await executor.executeItem(record, { showIdFor: () => 5 });

    expect(fs.readFileSync(record.plan.newVideoPath, 'utf8')).toBe('video');
    expect(Video.update).toHaveBeenCalled();
  });

  it('still fails when the media file itself vanished', async () => {
    const record = toTvRecord();
    touch(record.plan.files[1].from, 'thumb');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toMatchObject({ code: 'ENOENT' });
    expect(fs.existsSync(record.plan.files[1].from)).toBe(true);
  });

  it('reports a move that failed before any file left its source as unmoved', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    touch(record.plan.files[1].from, 'thumb');
    touch(path.join(seasonDir, `${STEM}.jpg`), 'someone else');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await expect(executor.executeItem(record, { showIdFor: () => 5 })).rejects.toMatchObject({ filesMoved: false });
  });

  it('leaves the files question open for a failure before any move was tried', async () => {
    const record = toTvRecord();
    touch(record.plan.oldVideoPath, 'video');
    Video.findByPk.mockResolvedValue(videoRow(record.plan.oldVideoPath));

    await expect(executor.executeItem(record, { showIdFor: () => null })).rejects.not.toHaveProperty('filesMoved');
  });

  it('moves an episode back to a movie-style folder and removes the emptied season and show folders', async () => {
    const oldVideo = touch(path.join(seasonDir, `${STEM}.mp4`), 'video');
    touch(path.join(seasonDir, `${STEM}.nfo`), '<episodedetails/>');
    touch(at('__TV', 'Chan', 'tvshow.nfo'), '<tvshow/>');
    const newDir = at('__Kids', 'Chan', `Chan - Big Build - ${ID}`);
    const plan = {
      files: [{ from: oldVideo, to: path.join(newDir, `Chan - Big Build [${ID}].mp4`) }],
      nfoSources: [path.join(seasonDir, `${STEM}.nfo`)],
      sourceDirs: [seasonDir],
      oldVideoPath: oldVideo,
      newVideoPath: path.join(newDir, `Chan - Big Build [${ID}].mp4`),
      oldAudioPath: null,
      newAudioPath: null,
      layout: 'videos',
      fromLayout: 'tv',
    };
    Video.findByPk.mockResolvedValue(videoRow(oldVideo));

    await executor.executeItem({ youtube_id: ID, video_id: 1, files: JSON.stringify(plan), classification: null }, { showIdFor: () => null });

    expect(fs.existsSync(plan.newVideoPath)).toBe(true);
    expect(fs.existsSync(seasonDir)).toBe(false);
    expect(fs.existsSync(at('__TV', 'Chan'))).toBe(false);
    expect(VideoClassification.create).not.toHaveBeenCalled();
    expect(sidecarWriter.writeVideoSidecars).toHaveBeenCalledWith(expect.objectContaining({ episode: null }));
  });
});
