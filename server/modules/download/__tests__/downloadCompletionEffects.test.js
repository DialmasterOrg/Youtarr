/* eslint-env jest */

const mockFsPromises = {
  unlink: jest.fn(),
};
jest.mock('fs', () => {
  const mockActualFs = jest.requireActual('fs');
  return {
    ...mockActualFs,
    promises: mockFsPromises,
  };
});

jest.mock('../../../logger');

jest.mock('../../configModule', () => ({
  directoryPath: '/mock/output'
}));

jest.mock('../../plexModule', () => ({
  refreshLibrariesForSubfolders: jest.fn().mockResolvedValue(),
}));

jest.mock('../../jobModule', () => ({
  startNextJob: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../filesystem', () => {
  const actualPathBuilder = jest.requireActual('../../filesystem/pathBuilder');
  return {
    extractSubfolderFromAbsPath: jest.fn(actualPathBuilder.extractSubfolderFromAbsPath),
  };
});

jest.mock('../../../models', () => ({
  JobVideoDownload: {
    destroy: jest.fn().mockResolvedValue(0)
  }
}));

jest.mock('../../../models/channel', () => ({
  findAll: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../channelModule', () => ({
  backfillChannelPosters: jest.fn().mockResolvedValue(),
}));

jest.mock('../../downloadModule', () => ({
  afterDownloadHook: jest.fn().mockResolvedValue(),
}));

const plexModule = require('../../plexModule');
const jobModule = require('../../jobModule');
const channelModule = require('../../channelModule');
const downloadModule = require('../../downloadModule');
const { JobVideoDownload } = require('../../../models');
const Channel = require('../../../models/channel');
const logger = require('../../../logger');
const { runCompletionSideEffects } = require('../downloadCompletionEffects');

// The function is fire-and-forget for everything except poster backfill;
// let the dangling promise chains settle before asserting on them.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('downloadCompletionEffects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFsPromises.unlink.mockResolvedValue();
    JobVideoDownload.destroy.mockResolvedValue(0);
    Channel.findAll.mockResolvedValue([]);
  });

  describe('temp channels file cleanup', () => {
    it('unlinks the file and invokes onTempChannelsFileCleaned on success', async () => {
      const onCleaned = jest.fn();

      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [],
        skipJobTransition: true,
        tempChannelsFile: '/tmp/channels-abc.txt',
        onTempChannelsFileCleaned: onCleaned,
      });
      await flushPromises();

      expect(mockFsPromises.unlink).toHaveBeenCalledWith('/tmp/channels-abc.txt');
      expect(onCleaned).toHaveBeenCalled();
    });

    it('does not invoke onTempChannelsFileCleaned when unlink fails', async () => {
      mockFsPromises.unlink.mockRejectedValue(new Error('EACCES'));
      const onCleaned = jest.fn();

      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [],
        skipJobTransition: true,
        tempChannelsFile: '/tmp/channels-abc.txt',
        onTempChannelsFileCleaned: onCleaned,
      });
      await flushPromises();

      expect(onCleaned).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Failed to clean up temp channels file'
      );
    });

    it('skips unlink when no tempChannelsFile is set', async () => {
      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [],
        skipJobTransition: true,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      });
      await flushPromises();

      expect(mockFsPromises.unlink).not.toHaveBeenCalled();
    });
  });

  it('destroys JobVideoDownload tracking entries for the job', async () => {
    await runCompletionSideEffects({
      jobId: 'job-42',
      videoData: [],
      skipJobTransition: true,
      tempChannelsFile: null,
      onTempChannelsFileCleaned: jest.fn(),
    });
    await flushPromises();

    expect(JobVideoDownload.destroy).toHaveBeenCalledWith({
      where: { job_id: 'job-42' }
    });
  });

  describe('channel poster backfill', () => {
    it('backfills posters for distinct channel ids', async () => {
      const channels = [{ channel_id: 'UC1' }];
      Channel.findAll.mockResolvedValue(channels);

      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [
          { youtubeId: 'vid1', channel_id: 'UC1', filePath: '/mock/output/Chan/video.mp4' },
          { youtubeId: 'vid2', channel_id: 'UC1', filePath: '/mock/output/Chan/video2.mp4' },
        ],
        skipJobTransition: true,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      });

      expect(Channel.findAll).toHaveBeenCalledWith({
        where: { channel_id: ['UC1'] }
      });
      expect(channelModule.backfillChannelPosters).toHaveBeenCalledWith(channels);
    });

    it('swallows backfill errors without throwing', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC1' }]);
      channelModule.backfillChannelPosters.mockRejectedValue(new Error('poster fail'));

      await expect(runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [{ youtubeId: 'vid1', channel_id: 'UC1' }],
        skipJobTransition: true,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      })).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Error backfilling channel posters'
      );
    });

    it('skips backfill when no videos were downloaded', async () => {
      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [],
        skipJobTransition: true,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      });

      expect(Channel.findAll).not.toHaveBeenCalled();
    });
  });

  it('calls afterDownloadHook with the downloaded youtube ids', async () => {
    await runCompletionSideEffects({
      jobId: 'job-1',
      videoData: [
        { youtubeId: 'vid1', channel_id: 'UC1' },
        { youtubeId: 'vid2', channel_id: 'UC1' },
      ],
      skipJobTransition: true,
      tempChannelsFile: null,
      onTempChannelsFileCleaned: jest.fn(),
    });
    await flushPromises();

    expect(downloadModule.afterDownloadHook).toHaveBeenCalledWith(['vid1', 'vid2']);
  });

  describe('job transition', () => {
    it('refreshes each distinct subfolder once and starts the next job', async () => {
      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [
          { youtubeId: 'vid1', filePath: '/mock/output/__SubA/Chan/video1.mp4' },
          { youtubeId: 'vid2', filePath: '/mock/output/__SubA/Chan/video2.mp4' },
          { youtubeId: 'vid3', filePath: '/mock/output/__SubB/Chan/video3.mp4' },
        ],
        skipJobTransition: false,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      });
      await flushPromises();

      expect(plexModule.refreshLibrariesForSubfolders).toHaveBeenCalledTimes(1);
      const [subfolders] = plexModule.refreshLibrariesForSubfolders.mock.calls[0];
      expect(subfolders.sort()).toEqual(['SubA', 'SubB']);
      expect(jobModule.startNextJob).toHaveBeenCalled();
    });

    it('skips Plex refresh when no videos were downloaded but still starts next job', async () => {
      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [],
        skipJobTransition: false,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      });
      await flushPromises();

      expect(plexModule.refreshLibrariesForSubfolders).not.toHaveBeenCalled();
      expect(jobModule.startNextJob).toHaveBeenCalled();
    });

    it('skips Plex refresh and next job when skipJobTransition is true', async () => {
      await runCompletionSideEffects({
        jobId: 'job-1',
        videoData: [{ youtubeId: 'vid1', filePath: '/mock/output/Chan/video.mp4' }],
        skipJobTransition: true,
        tempChannelsFile: null,
        onTempChannelsFileCleaned: jest.fn(),
      });
      await flushPromises();

      expect(plexModule.refreshLibrariesForSubfolders).not.toHaveBeenCalled();
      expect(jobModule.startNextJob).not.toHaveBeenCalled();
    });
  });
});
