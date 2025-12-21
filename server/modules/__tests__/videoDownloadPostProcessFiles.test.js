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
    ensureDir: jest.fn(),
    readdir: jest.fn(),
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
  directoryPath: '/library',
  __setConfig: (cfg) => {
    Object.keys(mockConfig).forEach((key) => delete mockConfig[key]);
    Object.assign(mockConfig, cfg);
  }
}));

jest.mock('../nfoGenerator', () => ({
  writeVideoNfoFile: jest.fn(),
}));

jest.mock('../channelSettingsModule', () => ({
  getGlobalDefaultSentinel: jest.fn(() => '##USE_GLOBAL_DEFAULT##'),
  resolveEffectiveSubfolder: jest.fn((subFolder) => {
    // Simulate the real logic: GLOBAL_DEFAULT_SENTINEL uses global default, null/empty -> root
    if (subFolder === '##USE_GLOBAL_DEFAULT##') return null; // Mock: assume no global default
    if (subFolder && subFolder.trim() !== '') return subFolder.trim();
    return null; // null/empty = root (backwards compatible)
  }),
}));

const mockTempPathManager = {
  isEnabled: jest.fn(() => true),
  isTempPath: jest.fn(() => true),
  convertTempToFinal: jest.fn((path) => path),
  getTempBasePath: jest.fn(() => '/tmp/youtarr-downloads')
};

jest.mock('../download/tempPathManager', () => mockTempPathManager);

const mockJobVideoDownload = {
  update: jest.fn(() => Promise.resolve([0]))
};

jest.mock('../../models', () => ({
  JobVideoDownload: mockJobVideoDownload
}));

const mockChannel = {
  findOne: jest.fn(() => Promise.resolve(null))
};

jest.mock('../../models/channel', () => mockChannel);

jest.mock('../../logger');

jest.mock('../filesystem', () => ({
  ...jest.requireActual('../filesystem'),
  cleanupEmptyParents: jest.fn(() => Promise.resolve())
}));

const fs = require('fs-extra');
const logger = require('../../logger');
const childProcess = require('child_process');
const configModule = require('../configModule');
const nfoGenerator = require('../nfoGenerator');
const tempPathManager = require('../download/tempPathManager');
const { JobVideoDownload } = require('../../models');
const Channel = require('../../models/channel');

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
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    JobVideoDownload.update.mockResolvedValue([0]);
    Channel.findOne.mockResolvedValue(null);
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
    fs.ensureDir.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
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

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: tempPath }),
      'Error deleting file'
    );
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
    expect(logger.info).toHaveBeenCalledWith(
      { id: 'abc123', activeJobId: 'test-job-id', finalVideoPath: videoPath },
      'Marked video as completed in tracking'
    );
  });

  it('logs warning when job ID is not available', async () => {
    delete process.env.YOUTARR_JOB_ID;

    await loadModule();
    await settleAsync();

    expect(JobVideoDownload.update).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { id: 'abc123' },
      'Job ID not available while marking video as completed; skipping tracking update'
    );
  });

  it('handles JobVideoDownload update errors gracefully', async () => {
    const updateError = new Error('Database connection failed');
    JobVideoDownload.update.mockRejectedValueOnce(updateError);

    await loadModule();
    await settleAsync();

    expect(JobVideoDownload.update).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'abc123' }),
      'Error updating JobVideoDownload status'
    );
    expect(process.exit).not.toHaveBeenCalled(); // Should not fail entire post-processing
  });

  describe('tempPathManager integration', () => {
    const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].mp4';
    const tempVideoDir = '/tmp/youtarr-downloads/Channel';
    const finalVideoPath = '/library/Channel/Video Title [abc123].mp4';

    it('writes final path to _actual_filepath when temp downloads enabled', async () => {
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath || path === finalVideoPath);

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

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath || path === finalVideoPath);
      fs.pathExists.mockImplementation(async (path) => path === tempPath);

      await loadModule();
      await settleAsync();

      // Verify fs.move was called to move directory
      expect(fs.move).toHaveBeenCalledWith(tempVideoDir, expect.stringContaining('/library/Channel'));

      // Verify success log
      expect(logger.info).toHaveBeenCalledWith(
        { targetVideoDirectory: expect.stringContaining('/library/Channel') },
        '[Post-Process] Successfully moved to final location'
      );

      // Verify JobVideoDownload was updated with FINAL path
      expect(JobVideoDownload.update).toHaveBeenCalledWith(
        { status: 'completed', file_path: expect.stringContaining('/library/Channel') },
        expect.objectContaining({
          where: {
            job_id: 'test-job-id',
            youtube_id: 'abc123'
          }
        })
      );
    });

    it('exits with error when temp to final move fails', async () => {
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      fs.move.mockRejectedValueOnce(new Error('Disk full'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoDirectory: tempVideoDir }),
        '[Post-Process] ERROR during move operation'
      );

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error when final file does not exist after move', async () => {
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      // Simulate final file NOT existing after move
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ finalVideoPath: expect.stringContaining('/library/Channel') }),
        '[Post-Process] Final video file doesn\'t exist after move'
      );

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits with error when fs.move throws exception', async () => {
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));
      fs.move.mockRejectedValueOnce(new Error('Permission denied'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath);

      await loadModule();
      await settleAsync();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ videoDirectory: tempVideoDir }),
        '[Post-Process] ERROR during move operation'
      );

      // Verify process.exit was called with error code
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('stores final path in JobVideoDownload when temp downloads enabled', async () => {
      process.argv = ['node', 'script', tempVideoPath];
      JobVideoDownload.update.mockResolvedValueOnce([1]);

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => path === tempJsonPath || path.includes('/library/Channel'));

      await loadModule();
      await settleAsync();

      // Verify final path is stored, not temp path
      expect(JobVideoDownload.update).toHaveBeenCalledWith(
        { status: 'completed', file_path: expect.stringContaining('/library/Channel') },
        expect.objectContaining({
          where: {
            job_id: 'test-job-id',
            youtube_id: 'abc123'
          }
        })
      );

      // Verify log message shows final path
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'abc123',
          activeJobId: 'test-job-id',
          finalVideoPath: expect.stringContaining('/library/Channel')
        }),
        'Marked video as completed in tracking'
      );
    });
  });

  describe('subfolder support', () => {
    it('moves video directory directly to subfolder when using temp downloads', async () => {
      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      const tempVideoDir = '/tmp/youtarr-downloads/Channel/Video Title [abc123]';
      process.argv = ['node', 'script', tempVideoPath];

      Channel.findOne.mockResolvedValue({
        sub_folder: 'Entertainment',
        uploader: 'Channel'
      });

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => {
        return path === tempJsonPath || path.includes('/library/__Entertainment/Channel');
      });
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      // Verify fs.move was called to move video directory directly to subfolder location with __ prefix (atomic move)
      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('/library/__Entertainment/Channel/Video Title [abc123]')
      );

      // Verify log message shows subfolder
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ from: tempVideoDir }),
        '[Post-Process] Moving video directory'
      );

      // Verify the final path includes the subfolder with __ prefix
      expect(JobVideoDownload.update).toHaveBeenCalledWith(
        { status: 'completed', file_path: expect.stringContaining('/library/__Entertainment/Channel/Video Title [abc123]') },
        expect.any(Object)
      );
    });

    it('writes correct final path in JSON when channel has subfolder and temp downloads enabled', async () => {
      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      process.argv = ['node', 'script', tempVideoPath];

      Channel.findOne.mockResolvedValue({
        sub_folder: 'Entertainment',
        uploader: 'Channel'
      });

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((path) => path.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((path) => {
        return path === tempJsonPath || path.includes('/library/__Entertainment/Channel');
      });

      await loadModule();
      await settleAsync();

      // Verify that _actual_filepath includes the subfolder path with __ prefix
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        tempJsonPath,
        expect.stringContaining('"_actual_filepath": "/library/__Entertainment/Channel/Video Title [abc123]/Video Title [abc123].mp4"')
      );
    });

  });

  describe('special character handling in channel names', () => {
    it('uses filesystem path for channel with # character (temp downloads + subfolder)', async () => {
      // Scenario: Channel name in metadata is "Fred again . #" but yt-dlp sanitizes to "Fred again . ."
      const sanitizedChannelName = 'Fred again . .';
      const rawChannelName = 'Fred again . #';
      const tempVideoPath = `/tmp/youtarr-downloads/${sanitizedChannelName}/Fred again . . - Video Title [abc123]/Video Title [abc123].mp4`;
      const tempVideoDir = `/tmp/youtarr-downloads/${sanitizedChannelName}/Fred again . . - Video Title [abc123]`;
      process.argv = ['node', 'script', tempVideoPath];

      Channel.findOne.mockResolvedValue({
        sub_folder: 'Music',
        uploader: rawChannelName
      });

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);

      fs.readFileSync.mockReturnValue(JSON.stringify({
        id: 'abc123',
        title: 'Video Title',
        uploader: rawChannelName, // Raw name with #
        channel_id: 'channel123'
      }));

      const tempJsonPath = `${tempVideoDir}/Video Title [abc123].info.json`;
      fs.existsSync.mockImplementation((path) => {
        return path === tempJsonPath || path.includes('/library/__Music/Fred again');
      });
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      // Verify fs.move uses the SANITIZED channel name from filesystem, not raw metadata
      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining(`/library/__Music/${sanitizedChannelName}/Fred again`)
      );

      // Verify ensureDir was called with sanitized name
      expect(fs.ensureDir).toHaveBeenCalledWith(
        expect.stringContaining(`/library/__Music/${sanitizedChannelName}`)
      );

      // Verify _actual_filepath uses sanitized name
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        tempJsonPath,
        expect.stringContaining(`"_actual_filepath": "/library/__Music/${sanitizedChannelName}/Fred again`)
      );
    });

    it('uses filesystem path for channel with colon character', async () => {
      // Scenario: Channel name with : which gets sanitized by yt-dlp
      const sanitizedChannelName = 'Test Channel';
      const rawChannelName = 'Test: Channel';
      const tempVideoPath = `/tmp/youtarr-downloads/${sanitizedChannelName}/Video Title [abc123]/Video Title [abc123].mp4`;
      const tempVideoDir = `/tmp/youtarr-downloads/${sanitizedChannelName}/Video Title [abc123]`;
      process.argv = ['node', 'script', tempVideoPath];

      Channel.findOne.mockResolvedValue({
        sub_folder: 'Education',
        uploader: rawChannelName
      });

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);

      fs.readFileSync.mockReturnValue(JSON.stringify({
        id: 'abc123',
        title: 'Video Title',
        uploader: rawChannelName, // Raw name with :
        channel_id: 'channel123'
      }));

      const tempJsonPath = `${tempVideoDir}/Video Title [abc123].info.json`;
      fs.existsSync.mockImplementation((path) => {
        return path === tempJsonPath || path.includes('/library/__Education/Test Channel');
      });
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      // Verify fs.move uses the SANITIZED channel name from filesystem
      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining(`/library/__Education/${sanitizedChannelName}/Video Title`)
      );

      // Verify no errors logged (ensureDir should succeed)
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.anything() }),
        '[Post-Process] ERROR during move operation'
      );
    });

    it('handles channel name with multiple special characters', async () => {
      // Scenario: Channel name with multiple special chars: #<>:|?*
      const sanitizedChannelName = 'Channel Name';
      const rawChannelName = 'Channel #<>:|?* Name';
      const videoPath = `/library/${sanitizedChannelName}/Video Title [abc123]/Video Title [abc123].mp4`;
      process.argv = ['node', 'script', videoPath];

      fs.readFileSync.mockReturnValue(JSON.stringify({
        id: 'abc123',
        title: 'Video Title',
        uploader: rawChannelName, // Raw name with special chars
        channel_id: 'channel123'
      }));

      fs.existsSync.mockImplementation((path) => {
        return path === `/library/${sanitizedChannelName}/Video Title [abc123]/Video Title [abc123].info.json` ||
               path === videoPath;
      });

      await loadModule();
      await settleAsync();

      // Verify basic post-processing succeeds without errors
      expect(fs.moveSync).toHaveBeenCalledWith(
        expect.stringContaining('/library/Channel Name/Video Title [abc123]/Video Title [abc123].info.json'),
        '/mock/jobs/info/abc123.info.json',
        { overwrite: true }
      );

      // Verify no critical errors
      expect(process.exit).not.toHaveBeenCalledWith(1);
    });

    it('writes _actual_filepath with __ prefix when channel has subfolder (non-temp)', async () => {
      // This test verifies the fix for line 240 (missing __ prefix)
      const channelName = 'Test Channel';
      const videoPath = `/library/${channelName}/Video Title [abc123]/Video Title [abc123].mp4`;
      process.argv = ['node', 'script', videoPath];

      Channel.findOne.mockResolvedValue({
        sub_folder: 'Music',
        uploader: channelName
      });

      fs.readFileSync.mockReturnValue(JSON.stringify({
        id: 'abc123',
        title: 'Video Title',
        uploader: channelName,
        channel_id: 'channel123'
      }));

      fs.existsSync.mockImplementation((path) => {
        return path === `/library/${channelName}/Video Title [abc123]/Video Title [abc123].info.json` ||
               path === videoPath;
      });

      await loadModule();
      await settleAsync();

      // Verify that _actual_filepath includes the __ prefix for subfolder
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('/library/Test Channel/Video Title [abc123]/Video Title [abc123].info.json'),
        expect.stringContaining('"_actual_filepath": "/library/__Music/Test Channel/Video Title [abc123]/Video Title [abc123].mp4"')
      );
    });
  });
});
