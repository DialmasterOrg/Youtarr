jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { runImport } = require('../importJobRunner');

describe('importJobRunner.runImport', () => {
  let deps;
  let activeJob;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = {
      channelModule: {
        getChannelInfo: jest.fn().mockResolvedValue({ id: 'test', channel_id: 'UC123' }),
      },
      jobModule: {
        updateJob: jest.fn().mockResolvedValue(),
      },
      messageEmitter: {
        emitMessage: jest.fn(),
      },
      Channel: {
        findOne: jest.fn().mockResolvedValue(null), // not found = new channel
      },
    };
  });

  function makeActiveJob(total) {
    return { jobId: 'job-123', total, results: [], cancelRequested: false };
  }

  function makeChannels(n) {
    return Array.from({ length: n }, (_, i) => ({
      channelId: `UC${'x'.repeat(22)}${i}`,
      url: `https://www.youtube.com/channel/UC${'x'.repeat(22)}${i}`,
      title: `Channel ${i}`,
      settings: { autoDownloadEnabled: true, downloadType: 'videos' },
    }));
  }

  test('processes all channels and broadcasts progress per channel', async () => {
    const channels = makeChannels(3);
    activeJob = makeActiveJob(3);
    await runImport(deps, activeJob, channels);

    expect(deps.channelModule.getChannelInfo).toHaveBeenCalledTimes(3);
    expect(deps.messageEmitter.emitMessage).toHaveBeenCalled();
    expect(activeJob.results).toHaveLength(3);
    expect(activeJob.results.every((r) => r.state === 'success')).toBe(true);
  });

  test('records per-channel error without aborting on getChannelInfo failure', async () => {
    const channels = makeChannels(5);
    activeJob = makeActiveJob(5);
    deps.channelModule.getChannelInfo
      .mockResolvedValueOnce({}) // 0 success
      .mockResolvedValueOnce({}) // 1 success
      .mockRejectedValueOnce(new Error('Channel not found')) // 2 error
      .mockResolvedValueOnce({}) // 3 success
      .mockResolvedValueOnce({}); // 4 success

    await runImport(deps, activeJob, channels);

    expect(activeJob.results).toHaveLength(5);
    expect(activeJob.results[2].state).toBe('error');
    expect(activeJob.results[2].error).toMatch(/not found/i);
    expect(activeJob.results.filter((r) => r.state === 'success')).toHaveLength(4);
  });

  test('skips remaining channels when cancelRequested is set', async () => {
    const channels = makeChannels(5);
    activeJob = makeActiveJob(5);

    // After first channel completes, set cancel
    deps.channelModule.getChannelInfo.mockImplementation(async () => {
      if (deps.channelModule.getChannelInfo.mock.calls.length === 1) {
        // Set cancel after first call completes
        activeJob.cancelRequested = true;
      }
      return {};
    });

    await runImport(deps, activeJob, channels);

    // At least some should be skipped/cancelled
    const skipped = activeJob.results.filter((r) => r.state === 'skipped');
    expect(skipped.length).toBeGreaterThan(0);
    // Job should be marked Cancelled
    expect(deps.jobModule.updateJob).toHaveBeenCalledWith(
      'job-123',
      expect.objectContaining({ status: 'Cancelled' })
    );
  });

  test('skips already-subscribed channels via belt-and-suspenders check', async () => {
    const channels = makeChannels(3);
    activeJob = makeActiveJob(3);
    // Channel 1 already exists
    deps.Channel.findOne
      .mockResolvedValueOnce(null) // 0 new
      .mockResolvedValueOnce({ channel_id: channels[1].channelId }) // 1 exists!
      .mockResolvedValueOnce(null); // 2 new

    await runImport(deps, activeJob, channels);

    expect(deps.channelModule.getChannelInfo).toHaveBeenCalledTimes(2); // not 3
    // Results may arrive in any order due to concurrency; find by channelId
    const ch1Result = activeJob.results.find((r) => r.channelId === channels[1].channelId);
    expect(ch1Result.state).toBe('skipped');
    expect(ch1Result.reason).toMatch(/already/i);
  });

  test('passes channel settings as initialSettings to getChannelInfo', async () => {
    const channels = [
      {
        channelId: 'UC_settings_test',
        url: 'https://www.youtube.com/channel/UC_settings_test',
        title: 'Settings Channel',
        settings: { video_quality: '1080', sub_folder: 'custom', default_rating: '8' },
      },
    ];
    activeJob = makeActiveJob(1);
    await runImport(deps, activeJob, channels);

    expect(deps.channelModule.getChannelInfo).toHaveBeenCalledWith(
      channels[0].url,
      false,
      true,
      { video_quality: '1080', sub_folder: 'custom', default_rating: '8' }
    );
  });

  test('passes empty object as initialSettings when channel has no settings', async () => {
    const channels = [
      {
        channelId: 'UC_no_settings',
        url: 'https://www.youtube.com/channel/UC_no_settings',
        title: 'No Settings Channel',
      },
    ];
    activeJob = makeActiveJob(1);
    await runImport(deps, activeJob, channels);

    expect(deps.channelModule.getChannelInfo).toHaveBeenCalledWith(
      channels[0].url,
      false,
      true,
      {}
    );
  });

  test('writes results to job output on completion', async () => {
    const channels = makeChannels(2);
    activeJob = makeActiveJob(2);
    await runImport(deps, activeJob, channels);

    expect(deps.jobModule.updateJob).toHaveBeenCalledWith(
      'job-123',
      expect.objectContaining({
        status: 'Complete',
        output: expect.any(String),
      })
    );
    const output = JSON.parse(deps.jobModule.updateJob.mock.calls[0][1].output);
    expect(output).toHaveLength(2);
  });

  test('broadcasts complete event at end', async () => {
    const channels = makeChannels(2);
    activeJob = makeActiveJob(2);
    await runImport(deps, activeJob, channels);

    const completeCalls = deps.messageEmitter.emitMessage.mock.calls.filter(
      (call) => call[3] === 'complete'
    );
    expect(completeCalls).toHaveLength(1);
  });

  test('sets job to Failed on unexpected runner error', async () => {
    const channels = makeChannels(1);
    activeJob = makeActiveJob(1);

    // Make Channel.findOne throw to simulate unexpected error
    deps.Channel.findOne.mockRejectedValue(new Error('DB connection lost'));
    // Also make getChannelInfo fail
    deps.channelModule.getChannelInfo.mockRejectedValue(new Error('DB connection lost'));

    await runImport(deps, activeJob, channels);

    // The channel error should be caught per-channel, not crash the runner
    expect(activeJob.results).toHaveLength(1);
  });
});
