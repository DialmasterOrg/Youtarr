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
  getDefaultSubfolder: jest.fn(() => null),
  ffmpegPath: '/usr/bin/ffmpeg',
  atomicParsleyPath: '/usr/bin/AtomicParsley',
  directoryPath: '/library',
  __setConfig: (cfg) => {
    Object.keys(mockConfig).forEach((key) => delete mockConfig[key]);
    Object.assign(mockConfig, cfg);
  }
}));

jest.mock('../nfoGenerator', () => ({
  writeVideoNfoFile: jest.fn(),
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

const mockChannel = {
  findOne: jest.fn(() => Promise.resolve(null)),
  findAll: jest.fn(() => Promise.resolve([])),
  update: jest.fn(() => Promise.resolve([1]))
};

const mockChannelVideo = {
  findAll: jest.fn(() => Promise.resolve([]))
};

jest.mock('../../models/channel', () => mockChannel);
jest.mock('../../models/channelvideo', () => mockChannelVideo);

jest.mock('../../models', () => ({
  JobVideoDownload: mockJobVideoDownload,
  Channel: mockChannel
}));

const mockVideoPersistence = {
  persistDownloadedVideoForJob: jest.fn(() => Promise.resolve(null))
};

jest.mock('../videoPersistence', () => mockVideoPersistence);

jest.mock('../../logger');

// downloadSettingsResolver is intentionally not mocked: it is a pure function, so these
// tests exercise the real subfolder precedence (override > channel > fallback > global).
jest.mock('../filesystem', () => ({
  ...jest.requireActual('../filesystem'),
  cleanupEmptyParents: jest.fn(() => Promise.resolve()),
  // Mock retry wrappers to delegate directly to fs mocks (avoids retry delays in tests)
  moveWithRetries: jest.fn(async (src, dest) => {
    const fs = require('fs-extra');
    await fs.move(src, dest);
  }),
  ensureDirWithRetries: jest.fn(async (dirPath) => {
    const fs = require('fs-extra');
    await fs.ensureDir(dirPath);
  }),
}));

const fs = require('fs-extra');
const logger = require('../../logger');
const childProcess = require('child_process');
const configModule = require('../configModule');
const nfoGenerator = require('../nfoGenerator');
const tempPathManager = require('../download/tempPathManager');
const { JobVideoDownload } = require('../../models');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');

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
  let setTimeoutSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
    JobVideoDownload.update.mockResolvedValue([0]);
    mockVideoPersistence.persistDownloadedVideoForJob.mockResolvedValue(null);
    Channel.findOne.mockResolvedValue(null);
    Channel.findAll.mockResolvedValue([]);
    ChannelVideo.findAll.mockResolvedValue([]);
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
    fs.pathExists.mockResolvedValue(false);
    fs.stat.mockImplementation(async (path) => {
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

  it('embeds metadata via AtomicParsley with correct arguments', async () => {
    await loadModule();
    await settleAsync();

    expect(fs.moveSync).toHaveBeenCalledWith(jsonPath, '/mock/jobs/info/abc123.info.json', { overwrite: true });
    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      '/usr/bin/AtomicParsley',
      expect.arrayContaining([
        videoPath,
        '--title', 'Channel - Video Title',
        '--genre', 'Education',
        '--TVNetwork', 'Channel',
        '--artist', 'Channel',
        '--album', 'Channel',
        '--stik', 'Movie',
        '--overWrite'
      ]),
      expect.any(Object)
    );
    expect(JobVideoDownload.update).toHaveBeenCalledWith(
      { status: 'completed', file_path: videoPath },
      {
        where: {
          job_id: 'test-job-id',
          youtube_id: 'abc123'
        }
      }
    );
    expect(nfoGenerator.writeVideoNfoFile).toHaveBeenCalledWith(videoPath, expect.any(Object));
    expect(configModule.stopWatchingConfig).toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('backfills title and uploader for a nameless seeded channel from the info json', async () => {
    Channel.findOne.mockResolvedValue({
      id: 7,
      sub_folder: '##USE_GLOBAL_DEFAULT##',
      title: null,
      uploader: null,
      folder_name: null,
      default_rating: null
    });
    fs.readFileSync.mockReturnValue(JSON.stringify({
      id: 'abc123',
      upload_date: '20240131',
      title: 'Video Title',
      uploader: 'Little Mix',
      channel_id: 'channel123',
      categories: ['Education'],
      tags: ['tag1']
    }));

    await loadModule();
    await settleAsync();

    expect(Channel.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Little Mix', uploader: 'Little Mix' }),
      { where: { id: 7 } }
    );
  });

  it('does not overwrite an existing channel title/uploader during post-process', async () => {
    Channel.findOne.mockResolvedValue({
      id: 7,
      sub_folder: null,
      title: 'Existing Name',
      uploader: 'Existing Name',
      folder_name: 'Existing Name',
      default_rating: null
    });
    fs.readFileSync.mockReturnValue(JSON.stringify({
      id: 'abc123',
      upload_date: '20240131',
      title: 'Video Title',
      uploader: 'Different Name',
      channel_id: 'channel123',
      categories: ['Education'],
      tags: ['tag1']
    }));

    await loadModule();
    await settleAsync();

    const titleClobbered = Channel.update.mock.calls.some(
      ([patch]) => patch && (patch.title !== undefined || patch.uploader !== undefined)
    );
    expect(titleClobbered).toBe(false);
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

  it('includes iTunEXTC atom when normalized_rating is set', async () => {
    Channel.findOne.mockResolvedValue({
      id: 1,
      sub_folder: null,
      uploader: 'Channel',
      folder_name: 'Channel',
      default_rating: 'PG-13',
      enabled: true
    });

    await loadModule();
    await settleAsync();

    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      '/usr/bin/AtomicParsley',
      expect.arrayContaining([
        '--rDNSatom', 'mpaa|PG-13|', 'name=iTunEXTC', 'domain=com.apple.iTunes'
      ]),
      expect.any(Object)
    );
  });

  it('skips iTunEXTC atom when no rating is set', async () => {
    await loadModule();
    await settleAsync();

    const spawnCalls = childProcess.spawnSync.mock.calls;
    const apCall = spawnCalls.find(c => c[0] === '/usr/bin/AtomicParsley');
    expect(apCall).toBeTruthy();
    const args = apCall[1];
    expect(args).not.toContain('--rDNSatom');
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

  it('logs warning when AtomicParsley fails', async () => {
    childProcess.spawnSync.mockReturnValueOnce({ status: 1, stderr: Buffer.from('error') });

    await loadModule();
    await settleAsync();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Could not embed metadata via AtomicParsley'
    );
    // Should not fail the entire post-processing
    expect(process.exit).not.toHaveBeenCalled();
  });

  it('includes --year when upload_date is present', async () => {
    await loadModule();
    await settleAsync();

    expect(childProcess.spawnSync).toHaveBeenCalledWith(
      '/usr/bin/AtomicParsley',
      expect.arrayContaining([
        '--year', '2024-01-31'
      ]),
      expect.any(Object)
    );
  });

  it('skips --year when upload_date is missing', async () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({
      id: 'abc123',
      title: 'Video Title',
      uploader: 'Channel',
      channel_id: 'channel123'
    }));

    await loadModule();
    await settleAsync();

    const spawnCalls = childProcess.spawnSync.mock.calls;
    const apCall = spawnCalls.find(c => c[0] === '/usr/bin/AtomicParsley');
    expect(apCall).toBeTruthy();
    const args = apCall[1];
    expect(args).not.toContain('--year');
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

  it('persists the downloaded video for mid-batch listing updates', async () => {
    await loadModule();
    await settleAsync();

    expect(mockVideoPersistence.persistDownloadedVideoForJob).toHaveBeenCalledWith({
      jobId: 'test-job-id',
      youtubeId: 'abc123'
    });
  });

  it('emits the persisted control marker on stdout after a successful persist', async () => {
    mockVideoPersistence.persistDownloadedVideoForJob.mockResolvedValue({ id: 7 });
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      await loadModule();
      await settleAsync();

      expect(stdoutSpy).toHaveBeenCalledWith('[Youtarr:videoPersisted] abc123\n');
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('does not emit the control marker when the persist was skipped', async () => {
    mockVideoPersistence.persistDownloadedVideoForJob.mockResolvedValue(null);
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      await loadModule();
      await settleAsync();

      expect(stdoutSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[Youtarr:videoPersisted]')
      );
    } finally {
      stdoutSpy.mockRestore();
    }
  });

  it('skips mid-batch persistence when job ID is not available', async () => {
    delete process.env.YOUTARR_JOB_ID;

    await loadModule();
    await settleAsync();

    expect(mockVideoPersistence.persistDownloadedVideoForJob).not.toHaveBeenCalled();
  });

  it('does not fail post-processing when mid-batch persistence throws', async () => {
    mockVideoPersistence.persistDownloadedVideoForJob.mockRejectedValueOnce(
      new Error('db down')
    );
    JobVideoDownload.update.mockResolvedValueOnce([1]);

    await loadModule();
    await settleAsync();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'abc123' }),
      'Error persisting downloaded video during post-processing'
    );
    expect(JobVideoDownload.update).toHaveBeenCalledWith(
      { status: 'completed', file_path: videoPath },
      {
        where: {
          job_id: 'test-job-id',
          youtube_id: 'abc123'
        }
      }
    );
    expect(process.exit).not.toHaveBeenCalled();
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
      fs.pathExists.mockResolvedValue(false);

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

      // Verify error was logged with diagnostic info
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ src: tempVideoDir }),
        '[Post-Process] ERROR during move operation (all retries exhausted)'
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

      // Verify error was logged with diagnostic info
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ src: tempVideoDir }),
        '[Post-Process] ERROR during move operation (all retries exhausted)'
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

  describe('playlist soft fallback routing', () => {
    afterEach(() => {
      delete process.env.YOUTARR_SUBFOLDER_FALLBACK;
      delete process.env.YOUTARR_RATING_FALLBACK;
      delete process.env.YOUTARR_SUBFOLDER_OVERRIDE;
      delete process.env.YOUTARR_OVERRIDE_RATING;
    });

    it('routes untracked channel video into playlist soft fallback subfolder', async () => {
      // Channel not tracked in DB (findOne returns null); soft fallback env set; no hard override
      Channel.findOne.mockResolvedValue(null);
      process.env.YOUTARR_SUBFOLDER_FALLBACK = 'PLFolder';
      delete process.env.YOUTARR_SUBFOLDER_OVERRIDE;

      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      const tempVideoDir = '/tmp/youtarr-downloads/Channel/Video Title [abc123]';
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((p) => p.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((p) => {
        return p === tempJsonPath || p.includes('/library/__PLFolder/Channel');
      });
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      // Should move into __PLFolder subfolder (buildChannelPath adds __ prefix)
      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('/library/__PLFolder/Channel/Video Title [abc123]')
      );
    });

    it('tracked channel with its own sub_folder beats the soft fallback subfolder', async () => {
      Channel.findOne.mockResolvedValue({
        id: 1,
        sub_folder: 'Kids',
        uploader: 'Channel',
        folder_name: 'Channel',
        default_rating: null,
        enabled: true
      });
      process.env.YOUTARR_SUBFOLDER_FALLBACK = 'PLFolder';
      delete process.env.YOUTARR_SUBFOLDER_OVERRIDE;

      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      const tempVideoDir = '/tmp/youtarr-downloads/Channel/Video Title [abc123]';
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((p) => p.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((p) => {
        return p === tempJsonPath || p.includes('/library/__Kids/Channel');
      });
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      // Should route to Kids, not PLFolder
      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('/library/__Kids/Channel/Video Title [abc123]')
      );
      expect(fs.move).not.toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('PLFolder')
      );
    });

    it('applies rating soft fallback when channel has no default rating', async () => {
      // Untracked channel; rating fallback env set; no hard rating override
      Channel.findOne.mockResolvedValue(null);
      process.env.YOUTARR_RATING_FALLBACK = 'PG';
      delete process.env.YOUTARR_OVERRIDE_RATING;

      await loadModule();
      await settleAsync();

      // The soft fallback rating PG should be embedded via iTunEXTC
      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        '/usr/bin/AtomicParsley',
        expect.arrayContaining([
          '--rDNSatom', 'mpaa|PG|', 'name=iTunEXTC', 'domain=com.apple.iTunes'
        ]),
        expect.any(Object)
      );
    });

    it('disabled channel sub_folder falls through to the playlist soft fallback', async () => {
      // Disabled channel settings shouldn't override the playlist.
      Channel.findOne.mockResolvedValue({
        id: 1,
        sub_folder: 'Kids',
        uploader: 'Channel',
        folder_name: 'Channel',
        default_rating: null,
        enabled: false
      });
      process.env.YOUTARR_SUBFOLDER_FALLBACK = 'PLFolder';
      delete process.env.YOUTARR_SUBFOLDER_OVERRIDE;

      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      const tempVideoDir = '/tmp/youtarr-downloads/Channel/Video Title [abc123]';
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((p) => p.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((p) => {
        return p === tempJsonPath || p.includes('/library/__PLFolder/Channel');
      });
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      // Routes to PLFolder (playlist fallback), not Kids (disabled channel setting)
      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('/library/__PLFolder/Channel/Video Title [abc123]')
      );
      expect(fs.move).not.toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('Kids')
      );
    });

    it('disabled channel default_rating falls through to the rating soft fallback', async () => {
      Channel.findOne.mockResolvedValue({
        id: 1,
        sub_folder: null,
        uploader: 'Channel',
        folder_name: 'Channel',
        default_rating: 'R',
        enabled: false
      });
      process.env.YOUTARR_RATING_FALLBACK = 'PG';
      delete process.env.YOUTARR_OVERRIDE_RATING;

      await loadModule();
      await settleAsync();

      // The playlist fallback PG is used, not the disabled channel's R rating
      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        '/usr/bin/AtomicParsley',
        expect.arrayContaining([
          '--rDNSatom', 'mpaa|PG|', 'name=iTunEXTC', 'domain=com.apple.iTunes'
        ]),
        expect.any(Object)
      );
      const ratingArgs = childProcess.spawnSync.mock.calls
        .filter((c) => c[0] === '/usr/bin/AtomicParsley')
        .flatMap((c) => c[1]);
      expect(ratingArgs).not.toContain('mpaa|R|');
    });
  });

  describe('owner channel id resolution (VEVO/Topic channel fix)', () => {
    afterEach(() => {
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      delete process.env.YOUTARR_OWNER_CHANNEL_MAP;
      delete process.env.YOUTARR_SUBFOLDER_FALLBACK;
      delete process.env.YOUTARR_SUBFOLDER_OVERRIDE;
    });

    it('looks up the channel by the owner id, not the video info.json channel_id', async () => {
      // info.json channel_id is 'channel123' (set in beforeEach); the owner id is
      // the subscription the user actually downloaded from.
      process.env.YOUTARR_OWNER_CHANNEL_ID = 'UC-subscription';
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: 'Library2', uploader: 'Channel', folder_name: 'Channel', default_rating: null, enabled: true
      });

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'UC-subscription' } })
      );
    });

    it('routes the video into the owner channel subfolder even when info.json channel_id differs', async () => {
      process.env.YOUTARR_OWNER_CHANNEL_ID = 'UC-subscription';
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: 'Library2', uploader: 'Channel', folder_name: 'Channel', default_rating: null, enabled: true
      });

      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      const tempVideoDir = '/tmp/youtarr-downloads/Channel/Video Title [abc123]';
      process.argv = ['node', 'script', tempVideoPath];

      tempPathManager.isEnabled.mockReturnValue(true);
      tempPathManager.isTempPath.mockReturnValue(true);
      tempPathManager.convertTempToFinal.mockImplementation((p) => p.replace('/tmp/youtarr-downloads', '/library'));

      const tempJsonPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].info.json';
      fs.existsSync.mockImplementation((p) => p === tempJsonPath || p.includes('/library/__Library2/Channel'));
      fs.pathExists.mockResolvedValue(false);

      await loadModule();
      await settleAsync();

      expect(fs.move).toHaveBeenCalledWith(
        tempVideoDir,
        expect.stringContaining('/library/__Library2/Channel/Video Title [abc123]')
      );
    });

    it('falls back to the video info.json channel_id when no owner id is provided', async () => {
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      Channel.findOne.mockResolvedValue(null);

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'channel123' } })
      );
    });

    it('uses the owner-channel map (by youtube id) over the info.json channel_id (playlist download)', async () => {
      // VEVO video: info.json reports channel123, but the playlist passed the
      // artist channel for this youtube id.
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      process.env.YOUTARR_OWNER_CHANNEL_MAP = JSON.stringify({ abc123: 'UC-artist' });
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: 'Library2', uploader: 'Channel', folder_name: 'Channel', default_rating: null, enabled: true
      });

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'UC-artist' } })
      );
    });

    it('falls back to info.json channel_id when the map has no entry for this video', async () => {
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      process.env.YOUTARR_OWNER_CHANNEL_MAP = JSON.stringify({ otherVideo: 'UC-artist' });
      Channel.findOne.mockResolvedValue(null);

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'channel123' } })
      );
    });

    it('prefers the explicit owner env over the owner-channel map', async () => {
      process.env.YOUTARR_OWNER_CHANNEL_ID = 'UC-explicit';
      process.env.YOUTARR_OWNER_CHANNEL_MAP = JSON.stringify({ abc123: 'UC-mapped' });
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: 'Library2', uploader: 'Channel', folder_name: 'Channel', default_rating: null, enabled: true
      });

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'UC-explicit' } })
      );
    });

    it('ignores a malformed owner-channel map and falls back to info.json channel_id', async () => {
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      process.env.YOUTARR_OWNER_CHANNEL_MAP = 'not-json{';
      Channel.findOne.mockResolvedValue(null);

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'channel123' } })
      );
    });

    it('resolves the tracked channel that listed the video when info.json id is an untracked VEVO channel (manual paste)', async () => {
      // No explicit owner (pasted URL). info.json channel_id is the VEVO auto-channel
      // (channel123 here, untracked). channelvideos links the video to both the VEVO
      // id and the tracked artist channel UC-artist.
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      delete process.env.YOUTARR_OWNER_CHANNEL_MAP;
      ChannelVideo.findAll.mockResolvedValue([
        { channel_id: 'channel123' },
        { channel_id: 'UC-artist' },
      ]);
      // Of the candidates, only UC-artist is a tracked channel.
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC-artist' }]);
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: 'Library2', uploader: 'Channel', folder_name: 'Channel', default_rating: null, enabled: true
      });

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'UC-artist' } })
      );
    });

    it('never routes via an untracked channelvideos id (e.g. the VEVO auto-channel)', async () => {
      // channelvideos only has the untracked VEVO id; none of the candidates are tracked,
      // so we must fall back to the info.json id rather than use the untracked id.
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      delete process.env.YOUTARR_OWNER_CHANNEL_MAP;
      ChannelVideo.findAll.mockResolvedValue([{ channel_id: 'UC-vevo' }]);
      Channel.findAll.mockResolvedValue([]); // nothing tracked
      Channel.findOne.mockResolvedValue(null);

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'channel123' } })
      );
    });

    it('prefers the explicit owner map over the channelvideos tracked lookup', async () => {
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      process.env.YOUTARR_OWNER_CHANNEL_MAP = JSON.stringify({ abc123: 'UC-mapped' });
      // channelvideos would resolve to a different tracked channel, but the explicit
      // map must win and the tracked lookup must be skipped.
      ChannelVideo.findAll.mockResolvedValue([{ channel_id: 'UC-other' }]);
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC-other' }]);
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: 'Library2', uploader: 'Channel', folder_name: 'Channel', default_rating: null, enabled: true
      });

      await loadModule();
      await settleAsync();

      expect(Channel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { channel_id: 'UC-mapped' } })
      );
      expect(ChannelVideo.findAll).not.toHaveBeenCalled();
    });

    it('does not backfill folder_name/title onto an owner-resolved channel', async () => {
      // The on-disk folder is named after the video's uploader (the VEVO
      // auto-channel), so an owner-resolved record must never receive it.
      process.env.YOUTARR_OWNER_CHANNEL_ID = 'UC-subscription';
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: null, title: null, uploader: 'Artist', folder_name: 'Artist', default_rating: null
      });

      await loadModule();
      await settleAsync();

      expect(Channel.update).not.toHaveBeenCalled();
    });

    it('does not backfill channel metadata when resolved via the owner-channel map', async () => {
      delete process.env.YOUTARR_OWNER_CHANNEL_ID;
      process.env.YOUTARR_OWNER_CHANNEL_MAP = JSON.stringify({ abc123: 'UC-artist' });
      Channel.findOne.mockResolvedValue({
        id: 1, sub_folder: null, title: null, uploader: 'Artist', folder_name: 'Artist', default_rating: null
      });

      await loadModule();
      await settleAsync();

      expect(Channel.update).not.toHaveBeenCalled();
    });
  });

  describe('subfolder support', () => {
    it('moves video directory directly to subfolder when using temp downloads', async () => {
      const tempVideoPath = '/tmp/youtarr-downloads/Channel/Video Title [abc123]/Video Title [abc123].mp4';
      const tempVideoDir = '/tmp/youtarr-downloads/Channel/Video Title [abc123]';
      process.argv = ['node', 'script', tempVideoPath];

      Channel.findOne.mockResolvedValue({
        sub_folder: 'Entertainment',
        uploader: 'Channel',
        enabled: true
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
        uploader: 'Channel',
        enabled: true
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
        uploader: rawChannelName,
        enabled: true
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
        uploader: rawChannelName,
        enabled: true
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
        expect.objectContaining({ src: expect.anything() }),
        '[Post-Process] ERROR during move operation (all retries exhausted)'
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
        uploader: channelName,
        enabled: true
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

  describe('writeVideoFanart', () => {
    const imagePath = '/library/Channel/Video Title [abc123].jpg';
    const fanartPath = '/library/Channel/Video Title [abc123]-fanart.jpg';

    it('creates fanart file when writeVideoFanart is true and image exists', async () => {
      configModule.__setConfig({
        writeChannelPosters: false,
        writeVideoNfoFiles: true,
        writeVideoFanart: true,
      });
      fs.existsSync.mockImplementation((p) => p === jsonPath || p === imagePath);

      await loadModule();
      await settleAsync();

      expect(fs.copySync).toHaveBeenCalledWith(imagePath, fanartPath);
      expect(logger.info).toHaveBeenCalledWith(
        { fanartPath },
        '[Post-Process] Created video fanart file'
      );
    });

    it('does not create fanart file when writeVideoFanart is false', async () => {
      configModule.__setConfig({
        writeChannelPosters: false,
        writeVideoNfoFiles: true,
        writeVideoFanart: false,
      });
      fs.existsSync.mockImplementation((p) => p === jsonPath || p === imagePath);

      await loadModule();
      await settleAsync();

      const fanartCopied = fs.copySync.mock.calls.some(([, dest]) => dest === fanartPath);
      expect(fanartCopied).toBe(false);
    });

    it('does not create fanart file when writeVideoFanart is absent from config', async () => {
      configModule.__setConfig({
        writeChannelPosters: false,
        writeVideoNfoFiles: true,
      });
      fs.existsSync.mockImplementation((p) => p === jsonPath || p === imagePath);

      await loadModule();
      await settleAsync();

      const fanartCopied = fs.copySync.mock.calls.some(([, dest]) => dest === fanartPath);
      expect(fanartCopied).toBe(false);
    });

    it('skips fanart copy when image file does not exist', async () => {
      configModule.__setConfig({
        writeChannelPosters: false,
        writeVideoNfoFiles: true,
        writeVideoFanart: true,
      });
      // Only json exists, not the image
      fs.existsSync.mockImplementation((p) => p === jsonPath);

      await loadModule();
      await settleAsync();

      const fanartCopied = fs.copySync.mock.calls.some(([, dest]) => dest === fanartPath);
      expect(fanartCopied).toBe(false);
    });

    it('logs warning and does not exit when fanart copy throws', async () => {
      configModule.__setConfig({
        writeChannelPosters: false,
        writeVideoNfoFiles: true,
        writeVideoFanart: true,
      });
      fs.existsSync.mockImplementation((p) => p === jsonPath || p === imagePath);
      fs.copySync.mockImplementation((src, dest) => {
        if (dest === fanartPath) throw new Error('disk full');
      });

      await loadModule();
      await settleAsync();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        '[Post-Process] Error creating video fanart'
      );
      expect(process.exit).not.toHaveBeenCalled();
    });
  });
});
