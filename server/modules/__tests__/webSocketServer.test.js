/* eslint-env jest */

const http = require('http');

const mockAuthorize = jest.fn();
const mockIsSessionActive = jest.fn();

jest.mock('../webSocketAuth', () => ({
  WEBSOCKET_PROTOCOL: 'youtarr',
  authorize: (...args) => mockAuthorize(...args),
  isSessionActive: (...args) => mockIsSessionActive(...args),
}));

jest.mock('../../logger');

const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const SESSION_RECHECK_INTERVAL_MS = 5 * 60 * 1000;
const CLIENT_PROTOCOLS = ['youtarr', 'youtarr.auth.session-token'];

let WebSocket;
let initializeWebSocketServer;
let messageEmitter;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  delete global.wss;
  WebSocket = require('ws');
  messageEmitter = require('../messageEmitter');
  initializeWebSocketServer = require('../webSocketServer');
  mockAuthorize.mockResolvedValue({ ok: true, sessionToken: 'session-token' });
  mockIsSessionActive.mockResolvedValue(true);
});

afterEach(() => {
  delete global.wss;
});

describe('webSocketServer handshake', () => {
  let server;
  let port;
  const openClients = [];

  const connect = (path = '/ws', protocols = CLIENT_PROTOCOLS) => {
    const client = new WebSocket(`ws://127.0.0.1:${port}${path}`, protocols);
    openClients.push(client);
    return client;
  };

  // Resolves with how the handshake ended: an open socket or the HTTP status
  // of the rejected upgrade.
  const handshakeResult = (client) => new Promise((resolve) => {
    client.once('open', () => resolve({ opened: true, protocol: client.protocol }));
    client.once('unexpected-response', (req, res) => resolve({ opened: false, status: res.statusCode }));
    client.once('error', (err) => resolve({ opened: false, error: err.message }));
  });

  const nextMessage = (client) => new Promise((resolve) => {
    client.once('message', (data) => resolve(JSON.parse(data.toString())));
  });

  const closeEvent = (client) => new Promise((resolve) => {
    client.once('close', (code) => resolve(code));
  });

  beforeEach(async () => {
    server = http.createServer();
    initializeWebSocketServer(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  afterEach(async () => {
    openClients.splice(0).forEach((client) => client.terminate());
    global.wss.clients.forEach((ws) => ws.terminate());
    global.wss.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  test('stores the server instance globally for broadcasts', () => {
    expect(global.wss).toBeInstanceOf(WebSocket.Server);
  });

  test('rejects the upgrade when the session is not authorized', async () => {
    mockAuthorize.mockResolvedValue({ ok: false, status: 401 });

    await expect(handshakeResult(connect())).resolves.toEqual({ opened: false, status: 401 });
  });

  test('rejects the upgrade with 503 before initial setup is complete', async () => {
    mockAuthorize.mockResolvedValue({ ok: false, status: 503 });

    await expect(handshakeResult(connect())).resolves.toEqual({ opened: false, status: 503 });
  });

  test('rejects the upgrade with 500 when authorization throws', async () => {
    mockAuthorize.mockRejectedValue(new Error('boom'));

    await expect(handshakeResult(connect())).resolves.toEqual({ opened: false, status: 500 });
  });

  test('rejects upgrades on any path other than /ws without checking auth', async () => {
    await expect(handshakeResult(connect('/somewhere-else'))).resolves.toEqual({
      opened: false,
      status: 404,
    });
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  test('accepts an authorized client on /ws with a query string', async () => {
    await expect(handshakeResult(connect('/ws?reconnect=1'))).resolves.toEqual({
      opened: true,
      protocol: 'youtarr',
    });
  });

  test('accepts an authorized client and selects the youtarr subprotocol', async () => {
    await expect(handshakeResult(connect())).resolves.toEqual({
      opened: true,
      protocol: 'youtarr',
    });
  });

  test('accepts a client without subprotocols when authentication is disabled', async () => {
    mockAuthorize.mockResolvedValue({ ok: true, sessionToken: null });

    await expect(handshakeResult(connect('/ws', []))).resolves.toEqual({
      opened: true,
      protocol: '',
    });
  });

  test('replays the last final download state to a newly authorized client', async () => {
    messageEmitter.emitMessage('broadcast', null, 'download', 'downloadProgress', {
      finalSummary: { totalDownloaded: 3 },
    });

    const client = connect();
    const message = nextMessage(client);
    await handshakeResult(client);

    await expect(message).resolves.toMatchObject({
      type: 'downloadProgress',
      payload: { finalSummary: { totalDownloaded: 3 } },
    });
  });

  test('delivers broadcasts to authorized clients', async () => {
    const client = connect();
    await handshakeResult(client);
    const message = nextMessage(client);

    messageEmitter.emitMessage('broadcast', null, 'scheduler', 'scheduledTaskStatus', { key: 'rescan' });

    await expect(message).resolves.toMatchObject({
      type: 'scheduledTaskStatus',
      payload: { key: 'rescan' },
    });
  });

  test('survives a malformed frame from a client', async () => {
    const client = connect();
    await handshakeResult(client);
    const closed = closeEvent(client);

    // Text frame with RSV1 set although no extension was negotiated
    client._socket.write(Buffer.from([0xc1, 0x81, 0x00, 0x00, 0x00, 0x00, 0x41]));

    await expect(closed).resolves.toBe(1002);
    await expect(handshakeResult(connect())).resolves.toMatchObject({ opened: true });
  });

  test('drops a connection that fails after the handshake without writing HTTP into it', async () => {
    global.wss.on('connection', () => {
      throw new Error('listener failed');
    });
    const client = connect();
    const clientError = jest.fn();
    client.on('error', clientError);

    await expect(closeEvent(client)).resolves.toBe(1006);
    expect(clientError).not.toHaveBeenCalled();
  });

  test('closes a client that sends an oversized message', async () => {
    const client = connect();
    await handshakeResult(client);
    const closed = closeEvent(client);

    client.send('x'.repeat(64 * 1024));

    await expect(closed).resolves.toBe(1009);
  });
});

describe('webSocketServer connections', () => {
  const createClient = () => ({
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    on: jest.fn(),
    ping: jest.fn(),
    terminate: jest.fn(),
    close: jest.fn(),
  });

  const connectClient = (wsClient, sessionToken = 'session-token') => {
    global.wss.clients.add(wsClient);
    global.wss.emit('connection', wsClient, {}, { ok: true, sessionToken });
  };

  const handlerFor = (wsClient, eventName) => {
    const call = wsClient.on.mock.calls.find(([name]) => name === eventName);
    return call && call[1];
  };

  beforeEach(() => {
    jest.useFakeTimers();
    initializeWebSocketServer(http.createServer());
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('does not send a replay when the client is no longer open', () => {
    messageEmitter.emitMessage('broadcast', null, 'download', 'downloadProgress', {
      finalSummary: { totalDownloaded: 1 },
    });
    const wsClient = { ...createClient(), readyState: WebSocket.CLOSED };

    connectClient(wsClient);

    expect(wsClient.send).not.toHaveBeenCalled();
  });

  test('handles client errors instead of letting them crash the process', () => {
    const wsClient = createClient();
    connectClient(wsClient);

    expect(handlerFor(wsClient, 'error')).toEqual(expect.any(Function));
    expect(() => handlerFor(wsClient, 'error')(new Error('Invalid frame'))).not.toThrow();
  });

  describe('heartbeat', () => {
    test('pings connected clients on the heartbeat interval', () => {
      const wsClient = createClient();
      connectClient(wsClient);

      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

      expect(wsClient.ping).toHaveBeenCalledTimes(1);
      expect(wsClient.terminate).not.toHaveBeenCalled();
    });

    test('terminates clients that never answer a ping', () => {
      const wsClient = createClient();
      connectClient(wsClient);

      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

      expect(wsClient.terminate).toHaveBeenCalledTimes(1);
    });

    test('keeps clients that answer pings alive', () => {
      const wsClient = createClient();
      connectClient(wsClient);

      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
      handlerFor(wsClient, 'pong')();
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

      expect(wsClient.terminate).not.toHaveBeenCalled();
      expect(wsClient.ping).toHaveBeenCalledTimes(2);
    });

    test('stops the heartbeat when the server closes', () => {
      const wsClient = createClient();
      connectClient(wsClient);

      global.wss.emit('close');
      jest.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);

      expect(wsClient.ping).not.toHaveBeenCalled();
    });
  });

  describe('session re-check', () => {
    test('closes a client whose session has ended', async () => {
      mockIsSessionActive.mockResolvedValue(false);
      const wsClient = createClient();
      connectClient(wsClient, 'ended-token');

      await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS);

      expect(mockIsSessionActive).toHaveBeenCalledWith('ended-token');
      expect(wsClient.close).toHaveBeenCalledWith(1008, 'Session ended');
    });

    test('looks up a session shared by several clients once and closes all of them', async () => {
      mockIsSessionActive.mockResolvedValue(false);
      const firstTab = createClient();
      const secondTab = createClient();
      connectClient(firstTab, 'shared-token');
      connectClient(secondTab, 'shared-token');

      await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS);

      expect(mockIsSessionActive).toHaveBeenCalledTimes(1);
      expect(firstTab.close).toHaveBeenCalledWith(1008, 'Session ended');
      expect(secondTab.close).toHaveBeenCalledWith(1008, 'Session ended');
    });

    test('keeps a client whose session is still active', async () => {
      const wsClient = createClient();
      connectClient(wsClient);

      await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS);

      expect(mockIsSessionActive).toHaveBeenCalledTimes(1);
      expect(wsClient.close).not.toHaveBeenCalled();
    });

    test('keeps a client when its session cannot be checked', async () => {
      mockIsSessionActive.mockRejectedValue(new Error('db down'));
      const wsClient = createClient();
      connectClient(wsClient);

      await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS);

      expect(wsClient.close).not.toHaveBeenCalled();
    });

    test('skips clients connected while authentication is disabled', async () => {
      const wsClient = createClient();
      connectClient(wsClient, null);

      await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS);

      expect(mockIsSessionActive).not.toHaveBeenCalled();
    });

    test('stops re-checking when the server closes', async () => {
      const wsClient = createClient();
      connectClient(wsClient);

      global.wss.emit('close');
      await jest.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS * 2);

      expect(mockIsSessionActive).not.toHaveBeenCalled();
    });
  });
});
