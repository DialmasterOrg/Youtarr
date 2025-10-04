/* eslint-env jest */

jest.mock('fs-extra', () => {
  const mock = {
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    ensureDirSync: jest.fn(),
    moveSync: jest.fn(),
    copySync: jest.fn(),
    renameSync: jest.fn(),
    utimesSync: jest.fn(),
    pathExists: jest.fn(),
    stat: jest.fn(),
    move: jest.fn(),
    remove: jest.fn(),
  };

  mock.promises = {};
  return mock;
});

jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(() => ({ status: 0, error: null })),
}));

const mockConfig = {};

jest.mock('../configModule', () => ({
  getConfig: jest.fn(() => mockConfig),
  getJobsPath: jest.fn(() => '/mock/jobs'),
  getImagePath: jest.fn(() => '/mock/images'),
  stopWatchingConfig: jest.fn(),
  getCookiesPath: jest.fn(() => null),
  ffmpegPath: '/usr/bin/ffmpeg',
  __setConfig: (cfg) => {
    Object.keys(mockConfig).forEach((key) => delete mockConfig[key]);
    Object.assign(mockConfig, cfg);
  }
}));

jest.mock('../nfoGenerator', () => ({
  writeVideoNfoFile: jest.fn(),
}));

const fs = require('fs-extra');
const childProcess = require('child_process');
const configModule = require('../configModule');
const nfoGenerator = require('../nfoGenerator');

const flushPromises = () => new Promise((resolve) => queueMicrotask(resolve));

async function settleAsync(iterations = 5) {
  for (let i = 0; i < iterations; i += 1) {
    await flushPromises();
  }
}

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_EXIT = process.exit;

describe('videoDownloadPostProcessFiles', () => {
  const videoPath = '/library/Channel/Video Title [abc123].mp4';
  const jsonPath = '/library/Channel/Video Title [abc123].info.json';
  const tempPath = `${videoPath}.metadata_temp.mp4`;
  let setTimeoutSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    configModule.__setConfig({
      writeChannelPosters: false,
      writeVideoNfoFiles: true,
      ffmpegPath: '/usr/bin/ffmpeg'
    });

    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((cb) => {
      cb();
      return 0;
    });

    fs.existsSync.mockImplementation((path) => path === jsonPath);
    fs.readFileSync.mockReturnValue(JSON.stringify({
      id: 'abc123',
      upload_date: '20240131',
      title: 'Video Title',
      uploader: 'Channel',
      channel_id: 'channel123',
      categories: ['Education'],
      tags: ['tag1', 'tag2']
    }));
    fs.writeFileSync.mockImplementation(() => {});
    fs.ensureDirSync.mockImplementation(() => {});
    fs.moveSync.mockImplementation(() => {});
    fs.pathExists.mockImplementation(async (path) => path === tempPath);
    fs.stat.mockImplementation(async (path) => {
      if (path === tempPath) {
        return { size: 1000 };
      }
      if (path === videoPath) {
        return { size: 900 };
      }
      return { size: 0 };
    });
    fs.move.mockResolvedValue();
    fs.remove.mockResolvedValue();
    fs.copySync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});
    fs.utimesSync.mockImplementation(() => {});

    childProcess.execSync.mockImplementation(() => {});
    process.exit = jest.fn();
    process.argv = ['node', 'script', videoPath];
  });

  afterEach(() => {
    process.argv = [...ORIGINAL_ARGV];
    process.exit = ORIGINAL_EXIT;
    setTimeoutSpy?.mockRestore();
  });

  async function loadModule() {
    jest.isolateModules(() => {
      require('../videoDownloadPostProcessFiles');
    });
    await flushPromises();
    await flushPromises();
  }

  it('moves metadata temp file into place when size threshold passes', async () => {
    await loadModule();
    await settleAsync();

    expect(fs.moveSync).toHaveBeenCalledWith(jsonPath, '/mock/jobs/info/abc123.info.json', { overwrite: true });
    expect(childProcess.spawnSync).toHaveBeenCalled();
    expect(fs.move).toHaveBeenCalledWith(tempPath, videoPath, { overwrite: true });
    expect(fs.remove).not.toHaveBeenCalledWith(tempPath);
    expect(nfoGenerator.writeVideoNfoFile).toHaveBeenCalledWith(videoPath, expect.any(Object));
    expect(configModule.stopWatchingConfig).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('removes metadata temp file when size check fails', async () => {
    fs.stat.mockImplementation(async (path) => {
      if (path === tempPath) {
        return { size: 100 };
      }
      if (path === videoPath) {
        return { size: 1000 };
      }
      return { size: 0 };
    });

    await loadModule();
    await settleAsync();

    expect(fs.move).not.toHaveBeenCalledWith(tempPath, videoPath, expect.any(Object));
    expect(fs.remove).toHaveBeenCalledWith(tempPath);
    expect(configModule.stopWatchingConfig).toHaveBeenCalled();
  });

  it('gracefully skips processing when info json is missing', async () => {
    fs.existsSync.mockReturnValue(false);

    await loadModule();
    await settleAsync();

    expect(fs.moveSync).not.toHaveBeenCalled();
    expect(fs.move).not.toHaveBeenCalled();
    expect(nfoGenerator.writeVideoNfoFile).not.toHaveBeenCalled();
    expect(configModule.stopWatchingConfig).toHaveBeenCalled();
  });

  it('retries move when first attempt fails', async () => {
    const moveError = new Error('busy');
    fs.move
      .mockRejectedValueOnce(moveError)
      .mockResolvedValueOnce();

    await loadModule();
    await settleAsync(6);

    expect(fs.move).toHaveBeenCalledTimes(2);
    expect(fs.remove).not.toHaveBeenCalledWith(tempPath);
  });

  it('removes temp file when move fails after retries', async () => {
    fs.move.mockRejectedValue(new Error('still busy'));

    await loadModule();
    await settleAsync(8);

    expect(fs.move).toHaveBeenCalledTimes(6); // initial + 5 retries
    expect(fs.remove).toHaveBeenCalledWith(tempPath);
  });

  it('logs and ignores removal errors that are not ENOENT', async () => {
    const removeError = new Error('permission denied');
    fs.remove.mockRejectedValueOnce(removeError).mockResolvedValueOnce();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    fs.stat.mockImplementation(async (path) => {
      if (path === tempPath) {
        return { size: 100 };
      }
      if (path === videoPath) {
        return { size: 1000 };
      }
      return { size: 0 };
    });

    await loadModule();
    await settleAsync();

    const loggedError = consoleSpy.mock.calls.some(([msg]) => msg.includes('Error deleting temp file'));
    expect(loggedError).toBe(true);

    consoleSpy.mockRestore();
  });

  it('writes actual filepath to JSON before moving', async () => {
    await loadModule();
    await settleAsync();

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      jsonPath,
      expect.stringContaining('"_actual_filepath": "/library/Channel/Video Title [abc123].mp4"')
    );
    expect(fs.moveSync).toHaveBeenCalledWith(jsonPath, '/mock/jobs/info/abc123.info.json', { overwrite: true });
  });

  it('cleans up temp file in catch block when ffmpeg spawn fails', async () => {
    childProcess.spawnSync.mockReturnValueOnce({ status: 1, stderr: Buffer.from('error') });
    fs.move.mockClear();
    fs.remove.mockClear();

    await loadModule();
    await settleAsync();

    expect(fs.move).not.toHaveBeenCalled();
    expect(fs.remove).toHaveBeenCalledWith(tempPath);
  });

  it('adds release_date metadata when upload_date is present', async () => {
    await loadModule();
    await settleAsync();

    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      '/usr/bin/ffmpeg',
      expect.arrayContaining([
        '-metadata', 'release_date=2024-01-31'
      ]),
      expect.any(Object)
    );
  });

  it('skips release_date metadata when upload_date is missing', async () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      id: 'abc123',
      title: 'Video Title',
      uploader: 'Channel',
      channel_id: 'channel123'
    }));

    await loadModule();
    await settleAsync();

    const spawnCalls = childProcess.spawnSync.mock.calls;
    if (spawnCalls.length > 0) {
      const ffmpegArgs = spawnCalls[0][1];
      const hasReleaseDate = ffmpegArgs.some((arg, idx) =>
        arg === '-metadata' && ffmpegArgs[idx + 1]?.startsWith('release_date=')
      );
      expect(hasReleaseDate).toBe(false);
    }
  });
});
