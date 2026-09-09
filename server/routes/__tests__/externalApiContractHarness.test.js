'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const {
  SYNTHETIC_API_KEY,
  createExternalApiContractApp,
} = require('../../testing/externalApiContractApp');

const contract = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../../fixtures/external-api-v1/contract.json'),
  'utf8'
));

describe('external API synthetic contract harness', () => {
  test('serves the complete Plinx read path through the real router', async () => {
    const { app, state } = createExternalApiContractApp({ contract });
    const auth = { 'x-api-key': SYNTHETIC_API_KEY };

    await request(app).get('/external-api/v1/capabilities').set(auth).expect(200)
      .expect((response) => expect(response.body).toEqual(contract.capabilities));
    await request(app).get('/external-api/v1/channels').set(auth).expect(200)
      .expect((response) => expect(response.body.data.length).toBeGreaterThan(0));
    await request(app).get('/external-api/v1/videos?status=requestable&pageSize=40').set(auth).expect(200)
      .expect((response) => expect(response.body.data.map((video) => video.mediaType))
        .toEqual(expect.arrayContaining(['video', 'short', 'livestream'])));
    await request(app)
      .get(`/external-api/v1/videos?cursor=${encodeURIComponent(contract.catalogPage.pagination.nextCursor)}`)
      .set(auth).expect(200)
      .expect((response) => expect(response.body).toEqual(contract.catalogNextPage));
    await request(app).get('/external-api/v1/videos?search=Fixture%20short%20%26%20more').set(auth)
      .expect(200);
    expect(state.lastVideoQuery.search).toBe('Fixture short & more');
    await request(app).get('/external-api/v1/videos?page=1&cursor=not-allowed').set(auth).expect(400);
    await request(app).get('/external-api/v1/videos/abcdefghijk').set(auth).expect(200)
      .expect((response) => expect(response.body.metadata).toBeTruthy());
    await request(app).get('/external-api/v1/requests?page=1&pageSize=10').set(auth).expect(200)
      .expect((response) => expect(response.body.pagination.total).toBe(contract.requests.length + 3));
    await request(app).get('/external-api/v1/assets/videos/abcdefghijk/thumbnail').set(auth).expect(200)
      .expect('Content-Type', /image\/png/);
    await request(app).get('/external-api/v1/assets/channels/8/thumbnail').set(auth).expect(200)
      .expect('Content-Type', /image\/png|image\/jpeg/);
    expect(state.artworkRequests).toEqual(expect.arrayContaining(['video:abcdefghijk', 'channel:8']));
  });

  test('records a deterministic request and rejects an invalid key', async () => {
    const { app } = createExternalApiContractApp({ contract });
    await request(app).get('/external-api/v1/capabilities').set('x-api-key', 'wrong').expect(401);

    const response = await request(app)
      .post('/external-api/v1/requests/videos')
      .set('x-api-key', SYNTHETIC_API_KEY)
      .send({
        youtubeId: 'abcdefghijk',
        channelId: 8,
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      })
      .expect(202);
    expect(response.body).toMatchObject({ outcome: 'created', request: { status: 'pending' } });

    await request(app).get('/__contract/state').set('x-api-key', SYNTHETIC_API_KEY).expect(200)
      .expect((state) => expect(state.body.lastVideoRequest).toMatchObject({
        youtubeId: 'abcdefghijk', channelId: 8,
      }));
  });
});
