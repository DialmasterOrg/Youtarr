/* eslint-env jest */

jest.mock('../configModule', () => ({ getConfig: jest.fn() }));
jest.mock('../sessionAuth', () => ({ findActiveSession: jest.fn() }));
jest.mock('../../logger');

const CONFIGURED_AUTH = { username: 'admin', passwordHash: 'hash' };

const upgradeRequest = (protocolHeader) => ({
  headers: protocolHeader === undefined ? {} : { 'sec-websocket-protocol': protocolHeader },
});

describe('webSocketAuth', () => {
  let webSocketAuth;
  let configModule;
  let sessionAuth;
  const originalAuthEnabled = process.env.AUTH_ENABLED;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.AUTH_ENABLED;
    configModule = require('../configModule');
    sessionAuth = require('../sessionAuth');
    webSocketAuth = require('../webSocketAuth');
    configModule.getConfig.mockReturnValue(CONFIGURED_AUTH);
  });

  afterAll(() => {
    if (originalAuthEnabled === undefined) {
      delete process.env.AUTH_ENABLED;
    } else {
      process.env.AUTH_ENABLED = originalAuthEnabled;
    }
  });

  describe('authorize', () => {
    test('allows any connection when authentication is disabled', async () => {
      process.env.AUTH_ENABLED = 'false';

      await expect(webSocketAuth.authorize(upgradeRequest())).resolves.toEqual({
        ok: true,
        sessionToken: null,
      });
      expect(sessionAuth.findActiveSession).not.toHaveBeenCalled();
    });

    test('rejects with 503 before initial setup is complete', async () => {
      configModule.getConfig.mockReturnValue({});

      await expect(
        webSocketAuth.authorize(upgradeRequest('youtarr, youtarr.auth.abc'))
      ).resolves.toEqual({ ok: false, status: 503 });
    });

    test('rejects with 401 when no session token is offered', async () => {
      await expect(webSocketAuth.authorize(upgradeRequest('youtarr'))).resolves.toEqual({
        ok: false,
        status: 401,
      });
      expect(sessionAuth.findActiveSession).not.toHaveBeenCalled();
    });

    test('rejects with 401 when the protocol header is missing', async () => {
      await expect(webSocketAuth.authorize(upgradeRequest())).resolves.toEqual({
        ok: false,
        status: 401,
      });
    });

    test('rejects with 401 when the auth protocol carries an empty token', async () => {
      await expect(
        webSocketAuth.authorize(upgradeRequest('youtarr, youtarr.auth.'))
      ).resolves.toEqual({ ok: false, status: 401 });
      expect(sessionAuth.findActiveSession).not.toHaveBeenCalled();
    });

    test('rejects with 401 when the session is unknown, expired, or revoked', async () => {
      sessionAuth.findActiveSession.mockResolvedValue(null);

      await expect(
        webSocketAuth.authorize(upgradeRequest('youtarr, youtarr.auth.abc'))
      ).resolves.toEqual({ ok: false, status: 401 });
    });

    test('accepts an active session token offered as a subprotocol', async () => {
      sessionAuth.findActiveSession.mockResolvedValue({ id: 1 });

      await expect(
        webSocketAuth.authorize(upgradeRequest('youtarr,youtarr.auth.abc-123'))
      ).resolves.toEqual({ ok: true, sessionToken: 'abc-123' });
      expect(sessionAuth.findActiveSession).toHaveBeenCalledWith('abc-123');
    });

    test('rejects with 500 when the session lookup fails', async () => {
      sessionAuth.findActiveSession.mockRejectedValue(new Error('db down'));

      await expect(
        webSocketAuth.authorize(upgradeRequest('youtarr, youtarr.auth.abc'))
      ).resolves.toEqual({ ok: false, status: 500 });
    });
  });

  describe('isSessionActive', () => {
    test('is true while the session is active', async () => {
      sessionAuth.findActiveSession.mockResolvedValue({ id: 1 });

      await expect(webSocketAuth.isSessionActive('abc')).resolves.toBe(true);
    });

    test('is false once the session is gone', async () => {
      sessionAuth.findActiveSession.mockResolvedValue(null);

      await expect(webSocketAuth.isSessionActive('abc')).resolves.toBe(false);
    });

    test('propagates lookup errors', async () => {
      sessionAuth.findActiveSession.mockRejectedValue(new Error('db down'));

      await expect(webSocketAuth.isSessionActive('abc')).rejects.toThrow('db down');
    });
  });
});
