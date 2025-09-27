/* eslint-env jest */

const mockServerInstance = {
  on: jest.fn()
};

const mockServerConstructor = jest.fn(() => mockServerInstance);
const mockGetLastMessages = jest.fn();

jest.mock('ws', () => ({
  Server: mockServerConstructor,
  OPEN: 1
}));

jest.mock('../messageEmitter.js', () => ({
  getLastMessages: mockGetLastMessages
}));

const initializeWebSocketServer = require('../webSocketServer');

describe('webSocketServer', () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    delete global.wss;
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    delete global.wss;
  });

  test('initializes WebSocket server and stores instance globally', () => {
    const httpServer = {};

    initializeWebSocketServer(httpServer);

    expect(mockServerConstructor).toHaveBeenCalledWith({ server: httpServer });
    expect(mockServerInstance.on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(global.wss).toBe(mockServerInstance);
  });

  test('sends cached messages to new clients when the connection is open', () => {
    const cachedMessages = [{ id: 1 }, { id: 2 }];
    mockGetLastMessages.mockReturnValue(cachedMessages);

    initializeWebSocketServer({});

    const connectionCall = mockServerInstance.on.mock.calls.find(([eventName]) => eventName === 'connection');
    expect(connectionCall).toBeDefined();

    const [, connectionHandler] = connectionCall;
    const wsClient = {
      readyState: 1,
      send: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(wsClient);

    expect(mockGetLastMessages).toHaveBeenCalledTimes(1);
    expect(wsClient.send).toHaveBeenCalledTimes(2);
    expect(wsClient.send).toHaveBeenNthCalledWith(1, JSON.stringify(cachedMessages[0]));
    expect(wsClient.send).toHaveBeenNthCalledWith(2, JSON.stringify(cachedMessages[1]));
    expect(wsClient.on).toHaveBeenCalledWith('close', expect.any(Function));
  });

  test('does not send cached messages when the client connection is not open', () => {
    const cachedMessages = [{ id: 99 }];
    mockGetLastMessages.mockReturnValue(cachedMessages);

    initializeWebSocketServer({});

    const connectionCall = mockServerInstance.on.mock.calls.find(([eventName]) => eventName === 'connection');
    expect(connectionCall).toBeDefined();

    const [, connectionHandler] = connectionCall;
    const wsClient = {
      readyState: 0,
      send: jest.fn(),
      on: jest.fn()
    };

    connectionHandler(wsClient);

    expect(mockGetLastMessages).toHaveBeenCalledTimes(1);
    expect(wsClient.send).not.toHaveBeenCalled();
    expect(wsClient.on).toHaveBeenCalledWith('close', expect.any(Function));
  });
});
