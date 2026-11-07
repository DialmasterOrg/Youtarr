/* eslint-env jest */
const { EventEmitter } = require('events');

jest.mock('../../logger');
jest.mock('https', () => ({ request: jest.fn() }));
jest.mock('dns', () => {
  const mockResolve4 = jest.fn();
  const mockResolve6 = jest.fn();
  return {
    NOTFOUND: 'ENOTFOUND',
    mockResolve4,
    mockResolve6,
    Resolver: jest.fn().mockImplementation(() => ({ resolve4: mockResolve4, resolve6: mockResolve6 })),
  };
});

describe('youtubeExistenceCheck', () => {
  let youtubeExistenceCheck;
  let EXISTENCE;
  let OFFLINE_COOLDOWN_MS;
  let https;
  let dns;
  let logger;
  let now;

  // Each request answers on the next tick with the given status or error,
  // unless `hold` is set, in which case the test settles it.
  const mockRequests = ({ status = 200, error = null, hold = false } = {}) => {
    const requests = [];
    https.request.mockImplementation((options, onResponse) => {
      const req = new EventEmitter();
      req.options = options;
      req.respond = (statusCode) => onResponse({ statusCode, resume: jest.fn() });
      req.destroy = jest.fn((err) => {
        if (err) process.nextTick(() => req.emit('error', err));
      });
      req.end = jest.fn(() => {
        if (hold) return;
        process.nextTick(() => (error ? req.emit('error', error) : req.respond(status)));
      });
      requests.push(req);
      return req;
    });
    return requests;
  };

  const goOffline = async () => {
    mockRequests({ error: Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }) });
    await youtubeExistenceCheck.check('offline1234');
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    https = require('https');
    dns = require('dns');
    logger = require('../../logger');
    youtubeExistenceCheck = require('../youtubeExistenceCheck');
    ({ EXISTENCE, OFFLINE_COOLDOWN_MS } = youtubeExistenceCheck);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('check', () => {
    test('reports a video YouTube answers 200 for as existing', async () => {
      mockRequests({ status: 200 });
      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.EXISTS);
    });

    test('reports a 404 as removed', async () => {
      mockRequests({ status: 404 });
      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.REMOVED);
    });

    test('reports a 403 (private video) as removed', async () => {
      mockRequests({ status: 403 });
      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.REMOVED);
    });

    test('reports a redirect as existing', async () => {
      mockRequests({ status: 302 });
      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.EXISTS);
    });

    test('asks oEmbed with a HEAD request through the c-ares lookup', async () => {
      const requests = mockRequests({ status: 200 });
      await youtubeExistenceCheck.check('abc12345678');

      expect(requests[0].options).toEqual(expect.objectContaining({
        host: 'www.youtube.com',
        method: 'HEAD',
        path: '/oembed?url=https://www.youtube.com/watch?v=abc12345678&format=json',
        lookup: youtubeExistenceCheck.lookup,
      }));
    });

    test('reports unknown when the request fails', async () => {
      mockRequests({ error: Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }) });
      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.UNKNOWN);
    });

    test('reports unknown when YouTube does not answer in time', async () => {
      const requests = mockRequests({ hold: true });
      const result = youtubeExistenceCheck.check('abc12345678');
      requests[0].emit('timeout');

      await expect(result).resolves.toBe(EXISTENCE.UNKNOWN);
      expect(requests[0].destroy).toHaveBeenCalledWith(expect.any(Error));
    });

    test('warns once when YouTube stops answering', async () => {
      await goOffline();
      mockRequests({ error: new Error('still down') });
      now += OFFLINE_COOLDOWN_MS;
      await youtubeExistenceCheck.check('second12345');

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('after YouTube stops answering', () => {
    test('skips requests during the pause', async () => {
      await goOffline();
      https.request.mockClear();
      now += OFFLINE_COOLDOWN_MS - 1;

      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.UNKNOWN);
      expect(https.request).not.toHaveBeenCalled();
    });

    test('lets a single request through once the pause ends', async () => {
      await goOffline();
      now += OFFLINE_COOLDOWN_MS;
      const requests = mockRequests({ hold: true });

      const probe = youtubeExistenceCheck.check('probe123456');
      const other = await youtubeExistenceCheck.check('other123456');
      requests[0].respond(200);

      expect(other).toBe(EXISTENCE.UNKNOWN);
      await expect(probe).resolves.toBe(EXISTENCE.EXISTS);
      expect(requests).toHaveLength(1);
    });

    test('resumes all checks after a request succeeds', async () => {
      await goOffline();
      now += OFFLINE_COOLDOWN_MS;
      mockRequests({ status: 200 });
      await youtubeExistenceCheck.check('probe123456');

      const results = await Promise.all([
        youtubeExistenceCheck.check('first123456'),
        youtubeExistenceCheck.check('second12345'),
      ]);

      expect(results).toEqual([EXISTENCE.EXISTS, EXISTENCE.EXISTS]);
      expect(logger.info).toHaveBeenCalledWith('YouTube is reachable again, resuming video existence checks');
    });

    test('pauses again when the test request fails', async () => {
      await goOffline();
      now += OFFLINE_COOLDOWN_MS;
      mockRequests({ error: new Error('still down') });
      await youtubeExistenceCheck.check('probe123456');
      https.request.mockClear();
      now += 1;

      await expect(youtubeExistenceCheck.check('abc12345678')).resolves.toBe(EXISTENCE.UNKNOWN);
      expect(https.request).not.toHaveBeenCalled();
    });
  });

  describe('lookup', () => {
    const noData = (type) => Object.assign(new Error(`query${type} ENODATA www.youtube.com`), { code: 'ENODATA' });
    const answerA = (...addresses) => dns.mockResolve4.mockImplementation((host, cb) => cb(null, addresses));
    const answerAAAA = (...addresses) => dns.mockResolve6.mockImplementation((host, cb) => cb(null, addresses));

    test('answers with the first IPv4 address', (done) => {
      answerA('142.250.1.1', '142.250.1.2');
      answerAAAA('2607:f8b0::1');

      youtubeExistenceCheck.lookup('www.youtube.com', {}, (err, address, family) => {
        expect([err, address, family]).toEqual([null, '142.250.1.1', 4]);
        done();
      });
    });

    test('answers with every address, IPv4 first, when asked for all of them', (done) => {
      answerA('142.250.1.1', '142.250.1.2');
      answerAAAA('2607:f8b0::1');

      youtubeExistenceCheck.lookup('www.youtube.com', { all: true }, (err, addresses) => {
        expect(addresses).toEqual([
          { address: '142.250.1.1', family: 4 },
          { address: '142.250.1.2', family: 4 },
          { address: '2607:f8b0::1', family: 6 },
        ]);
        done();
      });
    });

    test('answers with IPv6 when the host has no IPv4 address', (done) => {
      dns.mockResolve4.mockImplementation((host, cb) => cb(noData('A')));
      answerAAAA('2607:f8b0::1');

      youtubeExistenceCheck.lookup('www.youtube.com', {}, (err, address, family) => {
        expect([err, address, family]).toEqual([null, '2607:f8b0::1', 6]);
        done();
      });
    });

    test('looks up only the family net asks for', (done) => {
      answerAAAA('2607:f8b0::1');

      youtubeExistenceCheck.lookup('www.youtube.com', { family: 6, all: true }, (err, addresses) => {
        expect(dns.mockResolve4).not.toHaveBeenCalled();
        expect(addresses).toEqual([{ address: '2607:f8b0::1', family: 6 }]);
        done();
      });
    });

    test('passes the IPv4 error on when neither family resolves', (done) => {
      const timeout = Object.assign(new Error('queryA ETIMEOUT www.youtube.com'), { code: 'ETIMEOUT' });
      dns.mockResolve4.mockImplementation((host, cb) => cb(timeout));
      dns.mockResolve6.mockImplementation((host, cb) => cb(noData('AAAA')));

      youtubeExistenceCheck.lookup('www.youtube.com', {}, (err) => {
        expect(err).toBe(timeout);
        done();
      });
    });
  });
});
