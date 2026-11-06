/* eslint-env jest */

jest.mock('ws', () => ({
  OPEN: 1
}));

describe('messageEmitter', () => {
  let MessageEmitter;
  let broadcastClients;

  const createClient = (overrides = {}) => ({
    id: overrides.id,
    readyState: overrides.readyState ?? 1,
    send: jest.fn(),
  });

  beforeEach(() => {
    jest.resetModules();
    broadcastClients = [createClient(), createClient()];
    global.wss = {
      clients: new Set(broadcastClients)
    };
    MessageEmitter = require('../messageEmitter');
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.wss;
  });

  test('broadcasts final summary updates and stores them for retrieval', () => {
    const payload = { finalSummary: { downloaded: 3, failed: 0 } };

    MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', payload);

    broadcastClients.forEach((client) => {
      expect(client.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(client.send.mock.calls[0][0]);
      expect(sent).toMatchObject({
        destination: 'broadcast',
        source: 'downloader',
        type: 'downloadProgress',
        payload: expect.objectContaining({
          finalSummary: payload.finalSummary,
          dateTimeStamp: expect.any(Number)
        })
      });
    });

    const lastMessages = MessageEmitter.getLastMessages();
    expect(lastMessages).toHaveLength(1);
    expect(lastMessages[0]).toMatchObject({
      destination: 'broadcast',
      type: 'downloadProgress',
      payload: expect.objectContaining({ finalSummary: payload.finalSummary })
    });
  });

  test('stores terminal progress updates and clears them when a new download starts', () => {
    const progressComplete = { progress: { state: 'complete', processed: 5 } };

    MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', progressComplete);

    expect(MessageEmitter.getLastMessages()).toHaveLength(1);

    MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', { clearPreviousSummary: true });
    expect(MessageEmitter.getLastMessages()).toEqual([]);

    MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', progressComplete);
    expect(MessageEmitter.getLastMessages()).toHaveLength(1);

    MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', { progress: { state: 'initiating' } });
    expect(MessageEmitter.getLastMessages()).toEqual([]);
  });

  test('sends direct messages only to matching open clients', () => {
    const targetClient = createClient({ id: 'client-1' });
    const otherClient = createClient({ id: 'client-2' });
    const closedClient = createClient({ id: 'client-3', readyState: 2 });

    global.wss.clients = new Set([targetClient, otherClient, closedClient]);

    MessageEmitter.emitMessage('client', 'client-1', 'server', 'status', { ok: true });

    expect(targetClient.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(targetClient.send.mock.calls[0][0]);
    expect(sent).toMatchObject({
      destination: 'client',
      clientId: 'client-1',
      payload: expect.objectContaining({ ok: true, dateTimeStamp: expect.any(Number) })
    });

    expect(otherClient.send).not.toHaveBeenCalled();
    expect(closedClient.send).not.toHaveBeenCalled();
  });

  describe('getLastFinalActivity', () => {
    test('returns null when no final state is stored', () => {
      expect(MessageEmitter.getLastFinalActivity()).toBeNull();
    });

    test('returns the stored final payload without the transport envelope', () => {
      const payload = { finalSummary: { downloaded: 3 } };

      MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', payload);

      const activity = MessageEmitter.getLastFinalActivity();
      expect(activity).toMatchObject({
        finalSummary: { downloaded: 3 },
        dateTimeStamp: expect.any(Number)
      });
      expect(activity.destination).toBeUndefined();
      expect(activity.type).toBeUndefined();
    });

    test('returns null again after a new download clears the stored state', () => {
      MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', {
        progress: { state: 'complete' }
      });
      expect(MessageEmitter.getLastFinalActivity()).not.toBeNull();

      MessageEmitter.emitMessage('broadcast', null, 'downloader', 'downloadProgress', {
        progress: { state: 'initiating' }
      });
      expect(MessageEmitter.getLastFinalActivity()).toBeNull();
    });
  });

  describe('keeping the last real result', () => {
    const emit = (payload) => MessageEmitter.emitMessage('broadcast', null, 'download', 'downloadProgress', payload);
    const lastBroadcastSummary = () => {
      const calls = broadcastClients[0].send.mock.calls;
      return JSON.parse(calls[calls.length - 1][0]).payload.finalSummary;
    };
    const realResult = () => ({
      totalDownloaded: 12,
      totalFailed: 1,
      totalSkipped: 0,
      jobType: 'Manually Added Urls',
      completedAt: '2026-10-31T19:42:00.000Z',
    });
    const quietCheck = () => ({
      totalDownloaded: 0,
      totalFailed: 0,
      totalSkipped: 9,
      jobType: 'Channel Downloads',
      completedAt: '2026-10-31T20:04:00.000Z',
    });

    test('a check that found nothing new shows the last real result and when it checked', () => {
      emit({ finalSummary: realResult() });
      emit({ clearPreviousSummary: true });
      emit({ finalSummary: quietCheck() });

      expect(lastBroadcastSummary()).toEqual({ ...realResult(), lastCheckedAt: '2026-10-31T20:04:00.000Z' });
    });

    test('replays the kept result to a client that connects after the check', () => {
      emit({ finalSummary: realResult() });
      emit({ clearPreviousSummary: true });
      emit({ finalSummary: quietCheck() });

      const expected = { totalDownloaded: 12, totalFailed: 1, lastCheckedAt: '2026-10-31T20:04:00.000Z' };
      expect(MessageEmitter.getLastFinalActivity().finalSummary).toMatchObject(expected);
      expect(MessageEmitter.getLastMessages()[0].payload.finalSummary).toMatchObject(expected);
    });

    test('a check with no earlier result is shown as it is', () => {
      emit({ finalSummary: quietCheck() });

      expect(lastBroadcastSummary()).toEqual(quietCheck());
    });

    test('a new real result replaces the kept one without a last checked time', () => {
      emit({ finalSummary: realResult() });
      emit({ finalSummary: quietCheck() });
      const newer = { ...realResult(), totalDownloaded: 2, totalFailed: 0, completedAt: '2026-10-31T21:04:00.000Z' };
      emit({ finalSummary: newer });

      expect(lastBroadcastSummary()).toEqual(newer);
    });

    test.each([
      ['totalDownloaded', 1],
      ['totalFailed', 1],
      ['totalAutoRetried', 1],
      ['totalMembersOnly', 1],
      ['totalTerminatedChannels', 1],
      ['totalTerminationFailures', 1],
      ['totalAlreadyDownloaded', 1],
      ['totalNotAvailable', 1],
      ['stoppedGroups', [{ group: 'Group 1/2', reason: 'bot check', terminated: false }]],
      ['jobIssues', [{ status: 'Failed', reason: 'no space', byUser: false }]],
    ])('%s counts as a real result that a later check keeps', (field, value) => {
      emit({ finalSummary: { ...realResult(), totalDownloaded: 0, totalFailed: 0, [field]: value } });
      emit({ finalSummary: quietCheck() });

      expect(lastBroadcastSummary()).toMatchObject({ [field]: value, jobType: 'Manually Added Urls' });
    });

    test.each([
      ['error', { error: true }],
      ['warning', { warning: true, terminationReason: 'User requested termination' }],
    ])('a job ending in %s with nothing to report is not treated as a finished check', (_name, flags) => {
      emit({ finalSummary: realResult() });
      emit({ finalSummary: quietCheck(), ...flags });

      expect(lastBroadcastSummary()).toEqual(quietCheck());
    });

    test('a job that stopped early does not lose the kept result for the next check', () => {
      emit({ finalSummary: realResult() });
      emit({ finalSummary: quietCheck(), error: true });
      emit({ finalSummary: { ...quietCheck(), completedAt: '2026-10-31T21:04:00.000Z' } });

      expect(lastBroadcastSummary()).toEqual({ ...realResult(), lastCheckedAt: '2026-10-31T21:04:00.000Z' });
    });

    test.each([
      ['job', { jobIssues: [{ status: 'Terminated', reason: 'User requested termination', byUser: true }] }],
      ['group', { stoppedGroups: [{ group: 'Group 1/2', reason: 'User requested termination', terminated: true }] }],
    ])('a %s the user stopped shows once, then a later check goes back to the earlier result', (_name, stop) => {
      emit({ finalSummary: realResult() });
      const stopped = { ...quietCheck(), ...stop };
      emit({ finalSummary: stopped, warning: true });
      expect(lastBroadcastSummary()).toEqual(stopped);

      emit({ finalSummary: quietCheck() });

      expect(lastBroadcastSummary()).toEqual({ ...realResult(), lastCheckedAt: '2026-10-31T20:04:00.000Z' });
    });

    test('a job the user stopped after it downloaded something is still a real result', () => {
      emit({ finalSummary: realResult() });
      const stopped = {
        ...quietCheck(),
        totalDownloaded: 3,
        jobIssues: [{ status: 'Terminated', reason: 'User requested termination', byUser: true }],
      };
      emit({ finalSummary: stopped, warning: true });
      emit({ finalSummary: quietCheck() });

      expect(lastBroadcastSummary()).toMatchObject({ totalDownloaded: 3, lastCheckedAt: '2026-10-31T20:04:00.000Z' });
    });

    test('leaves the caller\'s summary alone, because notifications read it afterward', () => {
      emit({ finalSummary: realResult() });
      const payload = { finalSummary: quietCheck() };
      emit(payload);

      expect(payload.finalSummary).toEqual(quietCheck());
    });
  });

  test('handles undefined payload by creating empty object with timestamp', () => {
    MessageEmitter.emitMessage('broadcast', null, 'server', 'ping');

    broadcastClients.forEach((client) => {
      expect(client.send).toHaveBeenCalledTimes(1);
      const sent = JSON.parse(client.send.mock.calls[0][0]);
      expect(sent).toMatchObject({
        destination: 'broadcast',
        source: 'server',
        type: 'ping',
        payload: { dateTimeStamp: expect.any(Number) }
      });
    });
  });
});
