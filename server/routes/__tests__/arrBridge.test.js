/* eslint-env jest */
const express = require('express');
const supertest = require('supertest');
const createArrBridgeRoutes = require('../arrBridge');

const KEY = 'k'.repeat(64);
const XML = 'application/xml; charset=utf-8';
const CAPS = '<?xml version="1.0" encoding="UTF-8"?>\n<caps></caps>\n';
const NZB = '<?xml version="1.0" encoding="UTF-8"?>\n<nzb></nzb>\n';
const TITLE = 'The.Office.US.S01E02.1080p.WEB-DL-NBC';

function makeApp({ enabled = true, newznab = {}, sabnzbd = {}, limiter } = {}) {
  const arrBridge = {
    isEnabled: jest.fn(() => enabled),
    isAuthorized: jest.fn((candidate) => candidate === KEY),
    newznab: {
      handleApi: jest.fn().mockResolvedValue({ status: 200, contentType: XML, body: CAPS }),
      handleNzb: jest.fn(() => ({ status: 200, contentType: 'application/x-nzb', filename: `${TITLE}.nzb`, body: NZB })),
      ...newznab,
    },
    sabnzbd: {
      handle: jest.fn().mockResolvedValue({ status: 200, json: { version: '4.3.0' } }),
      ...sabnzbd,
    },
  };
  const log = { error: jest.fn() };
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = log;
    next();
  });
  app.use(createArrBridgeRoutes({ arrBridgeLimiter: limiter || ((_req, _res, next) => next()), arrBridge }));
  // The real app serves the SPA for any path no route answers.
  app.get('*', (_req, res) => res.send('<html>spa</html>'));
  return { app, arrBridge, log };
}

// supertest does not buffer a content type it does not know.
function collectBody(response, callback) {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('the /arr namespace while the bridge is off', () => {
  test.each([
    ['get', '/arr/newznab/api?t=caps'],
    ['get', `/arr/newznab/nzb/${TITLE}.nzb?id=abcdefghijk`],
    ['get', '/arr/sabnzbd/api?mode=version'],
    ['post', '/arr/sabnzbd/api?mode=addfile'],
    ['get', '/arr/anything'],
  ])('%s %s answers 404', async (method, path) => {
    const { app, arrBridge } = makeApp({ enabled: false });

    const res = await supertest(app)[method](path);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(arrBridge.newznab.handleApi).not.toHaveBeenCalled();
    expect(arrBridge.sabnzbd.handle).not.toHaveBeenCalled();
  });
});

describe('GET /arr/newznab/api', () => {
  test('passes the query and the origin the client used, and returns the document as XML', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app).get(`/arr/newznab/api?t=caps&apikey=${KEY}`).set('Host', 'youtarr:3011');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(XML);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.text).toBe(CAPS);
    expect(arrBridge.newznab.handleApi).toHaveBeenCalledWith({ t: 'caps', apikey: KEY }, 'http://youtarr:3011');
  });

  test('uses the forwarded scheme behind a proxy', async () => {
    const { app, arrBridge } = makeApp();
    await supertest(app).get('/arr/newznab/api?t=caps').set('Host', 'youtarr.example.com').set('X-Forwarded-Proto', 'https');
    expect(arrBridge.newznab.handleApi.mock.calls[0][1]).toBe('https://youtarr.example.com');
  });

  test('does not need a login session', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/arr/newznab/api?t=caps');
    expect(res.status).toBe(200);
  });

  test('answers a Newznab error document, not a 500, when the handler throws', async () => {
    const { app, log } = makeApp({ newznab: { handleApi: jest.fn().mockRejectedValue(new Error('bug')) } });

    const res = await supertest(app).get(`/arr/newznab/api?t=tvsearch&apikey=${KEY}&q=secret-show`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(XML);
    expect(res.text).toContain('<error code="900"');
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain(KEY);
  });
});

describe('GET /arr/newznab/nzb/:file', () => {
  test('serves the NZB as a download named like the release', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app)
      .get(`/arr/newznab/nzb/${TITLE}.nzb?id=abcdefghijk&apikey=${KEY}`)
      .buffer(true)
      .parse(collectBody);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/x-nzb');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="${TITLE}.nzb"`);
    expect(res.body.toString()).toBe(NZB);
    expect(arrBridge.newznab.handleNzb).toHaveBeenCalledWith(`${TITLE}.nzb`, { id: 'abcdefghijk', apikey: KEY });
  });

  test('decodes a title with non-Latin letters', async () => {
    const { app, arrBridge } = makeApp();
    await supertest(app).get(`/arr/newznab/nzb/${encodeURIComponent('進撃.S01E01.1080p.WEB-DL-X')}.nzb?id=abcdefghijk`);
    expect(arrBridge.newznab.handleNzb.mock.calls[0][0]).toBe('進撃.S01E01.1080p.WEB-DL-X.nzb');
  });

  test('answers 404 when the module refuses the link', async () => {
    const { app } = makeApp({ newznab: { handleNzb: jest.fn(() => ({ status: 404 })) } });
    const res = await supertest(app).get(`/arr/newznab/nzb/${TITLE}.nzb?id=placeholder`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('/arr/sabnzbd/api', () => {
  test('GET passes the query and returns the JSON answer', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app).get(`/arr/sabnzbd/api?mode=version&apikey=${KEY}&output=json`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ version: '4.3.0' });
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(arrBridge.sabnzbd.handle).toHaveBeenCalledWith({
      query: { mode: 'version', apikey: KEY, output: 'json' }, body: {}, file: undefined,
    });
  });

  test('POST addfile passes the uploaded NZB, as Sonarr sends it', async () => {
    const { app, arrBridge } = makeApp({
      sabnzbd: { handle: jest.fn().mockResolvedValue({ status: 200, json: { status: true, nzo_ids: ['id-1'] } }) },
    });

    const res = await supertest(app)
      .post(`/arr/sabnzbd/api?mode=addfile&cat=tv&priority=-100&apikey=${KEY}&output=json`)
      .attach('name', Buffer.from(NZB), { filename: `${TITLE}.nzb`, contentType: 'application/x-nzb' });

    expect(res.body).toEqual({ status: true, nzo_ids: ['id-1'] });
    const request = arrBridge.sabnzbd.handle.mock.calls[0][0];
    expect(request.query).toMatchObject({ mode: 'addfile', cat: 'tv' });
    expect(request.file.buffer.toString()).toBe(NZB);
  });

  test('POST with a file in an unexpected field answers status false with HTTP 200', async () => {
    const { app, arrBridge } = makeApp();
    const res = await supertest(app).post(`/arr/sabnzbd/api?mode=addfile&apikey=${KEY}`)
      .attach('other', Buffer.from(NZB), { filename: 'x.nzb' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: false, error: 'Upload rejected' });
    expect(arrBridge.sabnzbd.handle).not.toHaveBeenCalled();
  });

  test('POST passes multipart text fields as the body', async () => {
    const { app, arrBridge } = makeApp();
    await supertest(app).post(`/arr/sabnzbd/api?apikey=${KEY}`).field('mode', 'addfile').field('cat', 'tv')
      .attach('name', Buffer.from(NZB), { filename: 'x.nzb' });
    expect(arrBridge.sabnzbd.handle.mock.calls[0][0].body).toMatchObject({ mode: 'addfile', cat: 'tv' });
  });

  test('an upload over 64 KB answers status false with HTTP 200', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app).post(`/arr/sabnzbd/api?mode=addfile&cat=tv&apikey=${KEY}`)
      .attach('name', Buffer.alloc(100 * 1024, 'x'), { filename: 'big.nzb' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: false, error: 'Upload rejected' });
    expect(arrBridge.sabnzbd.handle).not.toHaveBeenCalled();
  });

  test('a POST with a wrong or missing key is refused before any of the upload is read', async () => {
    const { app, arrBridge } = makeApp();

    const wrong = await supertest(app).post('/arr/sabnzbd/api?mode=addfile&cat=tv&apikey=wrong')
      .attach('name', Buffer.alloc(100 * 1024, 'x'), { filename: 'big.nzb' });
    const missing = await supertest(app).post('/arr/sabnzbd/api?mode=addfile&cat=tv')
      .field('apikey', KEY).attach('name', Buffer.from(NZB), { filename: 'x.nzb' });

    expect(wrong.status).toBe(200);
    expect(wrong.body).toEqual({ status: false, error: 'API Key Incorrect' });
    expect(missing.body).toEqual({ status: false, error: 'API Key Incorrect' });
    expect(arrBridge.sabnzbd.handle).not.toHaveBeenCalled();
  });

  test('a form field over 1 KB answers status false with HTTP 200', async () => {
    const { app, arrBridge } = makeApp();

    const res = await supertest(app).post(`/arr/sabnzbd/api?mode=addfile&apikey=${KEY}`)
      .field('cat', 'x'.repeat(5000)).attach('name', Buffer.from(NZB), { filename: 'x.nzb' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: false, error: 'Upload rejected' });
    expect(arrBridge.sabnzbd.handle).not.toHaveBeenCalled();
  });

  test('answers status false with HTTP 200 when the handler throws', async () => {
    const { app, log } = makeApp({ sabnzbd: { handle: jest.fn().mockRejectedValue(new Error('db down')) } });

    const res = await supertest(app).get(`/arr/sabnzbd/api?mode=queue&apikey=${KEY}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: false, error: 'Youtarr could not answer the request' });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain(KEY);
  });
});

describe('the /arr namespace', () => {
  test('answers 404 for an unknown path instead of the SPA', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/arr/other');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  test('runs every request through the rate limiter', async () => {
    const limiter = jest.fn((_req, res) => res.status(429).json({ error: 'slow down' }));
    const { app, arrBridge } = makeApp({ limiter });

    const res = await supertest(app).get('/arr/sabnzbd/api?mode=queue');

    expect(res.status).toBe(429);
    expect(arrBridge.sabnzbd.handle).not.toHaveBeenCalled();
  });

  test('leaves other paths to the rest of the app', async () => {
    const { app } = makeApp();
    const res = await supertest(app).get('/arrangements');
    expect(res.text).toBe('<html>spa</html>');
  });
});
