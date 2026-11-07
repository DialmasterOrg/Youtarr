const express = require('express');
const request = require('supertest');

function appWithTrust(subnet) {
  const app = express();
  app.set('trust proxy', subnet);
  app.get('/', (req, res) => res.json({ ip: req.ip }));
  return app;
}

test('an IPv4-mapped IPv6 subnet with a short prefix cannot trust an unrelated client', async () => {
  // GHSA-jqcg-44mw-7w3h: proxy-addr 2.0.7 treated this as trusting every IPv4
  // client, allowing a forged forwarded address to bypass ingress rate limits.
  const response = await request(appWithTrust('::ffff:10.0.0.0/8'))
    .get('/').set('X-Forwarded-For', '198.51.100.23').expect(200);
  expect(response.body.ip).not.toBe('198.51.100.23');
});

test('an explicitly trusted loopback proxy still forwards the client address', async () => {
  const response = await request(appWithTrust('loopback'))
    .get('/').set('X-Forwarded-For', '198.51.100.23').expect(200);
  expect(response.body.ip).toBe('198.51.100.23');
});
