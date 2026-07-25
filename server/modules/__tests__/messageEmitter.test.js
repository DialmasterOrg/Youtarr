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
