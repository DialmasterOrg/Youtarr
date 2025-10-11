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

const mockTempPathManager = {
  isEnabled: jest.fn(() => false),
  isTempPath: jest.fn(() => false),
  convertTempToFinal: jest.fn((path) => path),
  moveToFinal: jest.fn(() => Promise.resolve({ success: true }))
};

jest.mock('../download/tempPathManager', () => mockTempPathManager);

const mockJobVideoDownload = {
  update: jest.fn(() => Promise.resolve([0]))
};

jest.mock('../../models', () => ({
  JobVideoDownload: mockJobVideoDownload
}));

const fs = require('fs-extra');
const childProcess = require('child_process');
const configModule = require('../configModule');
const nfoGenerator = require('../nfoGenerator');
const tempPathManager = require('../download/tempPathManager');
const { JobVideoDownload } = require('../../models');

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
    JobVideoDownload.update.mockResolvedValue([0]);
    process.env.YOUTARR_JOB_ID = 'test-job-id';
    configModule.__setConfig({
      writeChannelPosters: false,
      writeVideoNfoFiles: true,
      ffmpegPath: '/usr/bin/ffmpeg'
    });

    // Reset tempPathManager mocks to default behavior
    tempPathManager.isEnabled.mockReturnValue(false);
    tempPathManager.isTempPath.mockReturnValue(false);
    tempPathManager.convertTempToFinal.mockImplementation((path) => path);
    tempPathManager.moveToFinal.mockResolvedValue({ success: true });

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
    delete process.env.YOUTARR_JOB_ID;
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
    expect(JobVideoDownload.update).toHaveBeenCalledWith(
      { status: 'completed', file_path: videoPath },
      {
        where: {
          job_id: 'test-job-id',
          youtube_id: 'abc123'
        }
      }
    );
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

  it('marks video as completed in JobVideoDownload when job ID is available', async () => {
    JobVideoDownload.update.mockResolvedValueOnce([1]);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await loadModule();
    await settleAsync();

    expect(JobVideoDownload.update).toHaveBeenCalledWith(
      { status: 'completed', file_path: videoPath },
      {
        where: {
          job_id: 'test-job-id',
          youtube_id: 'abc123'
        }
      }
    );
    expect(consoleSpy).toHaveBeenCalledWith('Marked video abc123 as completed in tracking for job test-job-id');
    consoleSpy.mockRestore();
  });

  it('logs warning when job ID is not available', async () => {
    delete process.env.YOUTARR_JOB_ID;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await loadModule();
    await settleAsync();

    expect(JobVideoDownload.update).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Job ID not available while marking abc123 as completed; skipping tracking update');
    consoleSpy.mockRestore();
  });

  it('handles JobVideoDownload update errors gracefully', async () => {
    const updateError = new Error('Database connection failed');
    JobVideoDownload.update.mockRejectedValueOnce(updateError);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await loadModule();
    await settleAsync();

    expect(JobVideoDownload.update).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Error updating JobVideoDownload status for abc123:', 'Database connection failed');
    expect(process.exit).not.toHaveBeenCalled(); // Should not fail entire post-processing
    consoleSpy.mockRestore();
  });

  describe('tempPathManager integration', () => {
    const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].mp4';
    const tempVideoDir = '/tmp/youtarr-downloads/Channel';
    const finalVideoPath = '/library/Channel/Video Title [abc123].mp4';
    const finalVideoDir = '/library/Channel';

    it('writes final path to _actual_filepath when temp downloads enabled', async () => {
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      tempPathManager.moveToFinal.mockResolvedValueOnce({ success: true, finalPath: finalVideoDir });

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify that _actual_filepath is set to FINAL path, not temp path
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        tempJsonPath,
        expect.stringContaining('"_actual_filepath": "/library/Channel/Video Title [abc123].mp4"')
      );
    });

    it('successfully moves files from temp to final location', async () => {
      process.argv = ['node', 'script', tempVideoPath];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      tempPathManager.moveToFinal.mockResolvedValueOnce({ success: true, finalPath: finalVideoDir });

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath || path === finalVideoPath);

      await loadModule();
      await settleAsync();

      // Verify moveToFinal was called with temp directory
      expect(tempPathManager.moveToFinal).toHaveBeenCalledWith(tempVideoDir);

      // Verify success log
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully moved to final location'));

      // Verify JobVideoDownload was updated with FINAL path
      expect(JobVideoDownload.update).toHaveBeenCalledWith(
        { status: 'completed', file_path: finalVideoPath },
        expect.objectContaining({
          where: {
            job_id: 'test-job-id',
            youtube_id: 'abc123'
          }
        })
      );

      consoleSpy.mockRestore();
    });

    it('exits with error when temp to final move fails', async () => {
      process.argv = ['node', 'script', tempVideoPath];
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      tempPathManager.moveToFinal.mockResolvedValueOnce({
        success: false,
        error: 'Disk full',
        finalPath: finalVideoDir
      });

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Post-Process] ERROR: Failed to move files to final location: Disk full')
      );

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it('exits with error when final file does not exist after move', async () => {
      process.argv = ['node', 'script', tempVideoPath];
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      tempPathManager.moveToFinal.mockResolvedValueOnce({ success: true, finalPath: finalVideoDir });

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      // Simulate final file NOT existing after move
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Post-Process] ERROR: Final video file doesn\'t exist after move')
      );

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it('exits with error when moveToFinal throws exception', async () => {
      process.argv = ['node', 'script', tempVideoPath];
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      tempPathManager.moveToFinal.mockRejectedValueOnce(new Error('Permission denied'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Post-Process] ERROR during move operation:',
        expect.any(Error)
      );

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
    });

    it('stores final path in JobVideoDownload when temp downloads enabled', async () => {
      process.argv = ['node', 'script', tempVideoPath];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      JobVideoDownload.update.mockResolvedValueOnce([1]);

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      tempPathManager.moveToFinal.mockResolvedValueOnce({ success: true, finalPath: finalVideoDir });

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath || path === finalVideoPath);

      await loadModule();
      await settleAsync();

      // Verify final path is stored, not temp path
      expect(JobVideoDownload.update).toHaveBeenCalledWith(
        { status: 'completed', file_path: finalVideoPath },
        expect.objectContaining({
          where: {
            job_id: 'test-job-id',
            youtube_id: 'abc123'
          }
        })
      );

      // Verify log message shows final path
      expect(consoleSpy).toHaveBeenCalledWith(`  Stored path in DB: ${finalVideoPath}`);

      consoleSpy.mockRestore();
    });
  });
});
