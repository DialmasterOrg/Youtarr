jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../configModule', () => ({ getJobsPath: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');

const ID = 'abcdefghijk';

describe('videoInfoStore', () => {
  let videoInfoStore;
  let configModule;
  let root;

  beforeEach(() => {
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-info-store-'));
    fs.mkdirSync(path.join(root, 'info'));
    configModule = require('../configModule');
    configModule.getJobsPath.mockReturnValue(root);
    videoInfoStore = require('../videoInfoStore');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const writeInfo = (info) => fs.writeFileSync(path.join(root, 'info', `${ID}.info.json`), JSON.stringify(info));
  const storedInfo = () => JSON.parse(fs.readFileSync(path.join(root, 'info', `${ID}.info.json`), 'utf8'));

  it('reads the stored info.json', async () => {
    writeInfo({ id: ID, title: 'Title' });

    await expect(videoInfoStore.readInfo(ID)).resolves.toEqual({ id: ID, title: 'Title' });
  });

  it('returns null when the info.json is missing', async () => {
    await expect(videoInfoStore.readInfo(ID)).resolves.toBeNull();
  });

  it('returns null when the info.json is not valid JSON', async () => {
    fs.writeFileSync(path.join(root, 'info', `${ID}.info.json`), '{broken');

    await expect(videoInfoStore.readInfo(ID)).resolves.toBeNull();
  });

  it('rewrites stored final paths that point at moved files', async () => {
    writeInfo({ id: ID, _actual_filepath: '/old/a.mp4', _actual_video_filepath: '/old/a.mp4', _actual_audio_filepath: '/old/a.mp3' });

    const changed = await videoInfoStore.rewriteActualPaths(ID, new Map([['/old/a.mp4', '/new/a.mp4'], ['/old/a.mp3', '/new/a.mp3']]));

    expect(changed).toBe(true);
    expect(storedInfo()).toMatchObject({
      _actual_filepath: '/new/a.mp4',
      _actual_video_filepath: '/new/a.mp4',
      _actual_audio_filepath: '/new/a.mp3',
    });
  });

  it('leaves the file alone when no stored path moved', async () => {
    writeInfo({ id: ID, _actual_filepath: '/other/a.mp4' });

    await expect(videoInfoStore.rewriteActualPaths(ID, new Map([['/old/a.mp4', '/new/a.mp4']]))).resolves.toBe(false);
    expect(storedInfo()._actual_filepath).toBe('/other/a.mp4');
  });

  it('does nothing when the info.json is missing', async () => {
    await expect(videoInfoStore.rewriteActualPaths(ID, new Map([['/old/a.mp4', '/new/a.mp4']]))).resolves.toBe(false);
  });
});

describe('videoInfoStore.readInfoOrFallback', () => {
  let videoInfoStore;
  let root;

  beforeEach(() => {
    jest.resetModules();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-info-fallback-'));
    fs.mkdirSync(path.join(root, 'info'));
    require('../configModule').getJobsPath.mockReturnValue(root);
    videoInfoStore = require('../videoInfoStore');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const video = { youtubeId: ID, youTubeVideoName: 'Row title', youTubeChannelName: 'Row channel', originalDate: '20240315' };

  it('builds the info from the videos row when the info.json is gone', async () => {
    await expect(videoInfoStore.readInfoOrFallback(video)).resolves.toEqual({
      id: ID, title: 'Row title', uploader: 'Row channel', channel: 'Row channel', upload_date: '20240315',
    });
  });

  it('fills a missing upload date from the videos row', async () => {
    fs.writeFileSync(path.join(root, 'info', `${ID}.info.json`), JSON.stringify({ id: ID, title: 'Stored' }));

    await expect(videoInfoStore.readInfoOrFallback(video)).resolves.toEqual({ id: ID, title: 'Stored', upload_date: '20240315' });
  });

  it('keeps a stored timestamp as is', async () => {
    fs.writeFileSync(path.join(root, 'info', `${ID}.info.json`), JSON.stringify({ id: ID, timestamp: 1710504000 }));

    await expect(videoInfoStore.readInfoOrFallback(video)).resolves.toEqual({ id: ID, timestamp: 1710504000 });
  });
});
