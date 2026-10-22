/* eslint-env jest */
const net = require('net');
const dns = require('dns');

jest.mock('../../logger');

const DB_HOST = 'db.test';

describe('databaseSocket', () => {
  let databaseSocket;
  let server;
  let port;
  let lookupSpy;

  const listen = () => new Promise((resolve) => {
    server = net.createServer((socket) => socket.end());
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

  const closeServer = () => new Promise((resolve) => server.close(resolve));

  // Resolves once the socket closes, reporting whether it ever connected.
  const openAndClose = () => new Promise((resolve) => {
    const socket = databaseSocket.connect({ config: { host: DB_HOST, port } });
    let connected = false;
    socket.on('error', () => {});
    socket.on('connect', () => {
      connected = true;
      socket.end();
    });
    socket.on('close', () => resolve(connected));
  });

  beforeEach(async () => {
    jest.resetModules();
    const realLookup = dns.lookup;
    lookupSpy = jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
      if (hostname !== DB_HOST) {
        return realLookup(hostname, options, callback);
      }
      if (options && options.all) {
        callback(null, [{ address: '127.0.0.1', family: 4 }]);
      } else {
        callback(null, '127.0.0.1', 4);
      }
    });
    databaseSocket = require('../databaseSocket');
    port = await listen();
  });

  afterEach(async () => {
    lookupSpy.mockRestore();
    if (server.listening) {
      await closeServer();
    }
  });

  test('looks the host up for the first connection', async () => {
    await expect(openAndClose()).resolves.toBe(true);
    expect(lookupSpy).toHaveBeenCalledWith(DB_HOST, expect.anything(), expect.any(Function));
  });

  test('reuses the address a connection reached instead of looking it up again', async () => {
    await openAndClose();
    lookupSpy.mockClear();

    await expect(openAndClose()).resolves.toBe(true);
    expect(lookupSpy).not.toHaveBeenCalled();
  });

  test('looks the host up again after a connection fails at the saved address', async () => {
    await openAndClose();
    await closeServer();
    await expect(openAndClose()).resolves.toBe(false);
    port = await listen();
    lookupSpy.mockClear();

    await expect(openAndClose()).resolves.toBe(true);
    expect(lookupSpy).toHaveBeenCalled();
  });

  test('keeps the saved address when an established connection closes', async () => {
    await openAndClose();
    await openAndClose();
    lookupSpy.mockClear();

    await openAndClose();
    expect(lookupSpy).not.toHaveBeenCalled();
  });

  test('answers with every saved address when asked for all of them', async () => {
    await openAndClose();

    const addresses = await new Promise((resolve) => {
      databaseSocket.lookup(DB_HOST, { all: true }, (err, result) => resolve(result));
    });

    expect(addresses).toEqual([{ address: '127.0.0.1', family: 4 }]);
  });

  test('turns on keep-alive once connected, like the sockets mysql2 opens itself', async () => {
    const setKeepAlive = jest.spyOn(net.Socket.prototype, 'setKeepAlive');
    await new Promise((resolve) => {
      const socket = databaseSocket.connect({
        config: { host: DB_HOST, port, enableKeepAlive: true, keepAliveInitialDelay: 5000 },
      });
      socket.on('connect', () => socket.end());
      socket.on('close', resolve);
    });

    expect(setKeepAlive).toHaveBeenCalledWith(true, 5000);
    setKeepAlive.mockRestore();
  });

  test('leaves keep-alive off when mysql2 has it disabled', async () => {
    const setKeepAlive = jest.spyOn(net.Socket.prototype, 'setKeepAlive');
    await new Promise((resolve) => {
      const socket = databaseSocket.connect({ config: { host: DB_HOST, port, enableKeepAlive: false } });
      socket.on('connect', () => socket.end());
      socket.on('close', resolve);
    });

    expect(setKeepAlive).not.toHaveBeenCalled();
    setKeepAlive.mockRestore();
  });

  test('turns off Nagle like the sockets mysql2 opens itself', () => {
    const setNoDelay = jest.spyOn(net.Socket.prototype, 'setNoDelay');
    const socket = databaseSocket.connect({ config: { host: DB_HOST, port } });
    socket.on('error', () => {});
    socket.destroy();

    expect(setNoDelay).toHaveBeenCalledWith(true);
    setNoDelay.mockRestore();
  });
});
