const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { externalErrorBody } = require('../externalApiResponse');
const { dto } = require('../externalRequestService');
const configModule = require('../configModule');

const fixtureDirectory = path.join(
  __dirname,
  '../../../fixtures/external-api-v1'
);
const fixtureBytes = fs.readFileSync(path.join(fixtureDirectory, 'contract.json'));
const canonicalFixtureBytes = Buffer.from(fixtureBytes.toString('utf8').replace(/\r\n/g, '\n'));
const fixture = JSON.parse(fixtureBytes.toString('utf8'));

describe('external API shared contract fixture', () => {
  afterAll(() => {
    configModule.stopWatchingConfig();
  });

  test('covers the complete Plinx-consumed v1 surface', () => {
    expect(fixture.fixtureVersion).toBe(4);
    expect(fixture.capabilities).toEqual(expect.objectContaining({
      apiVersion: '1',
      policy: expect.objectContaining({
        allowedMediaTypes: expect.arrayContaining(['video', 'short', 'livestream']),
      }),
      quota: expect.any(Object),
      features: expect.objectContaining({ videoDetails: true }),
    }));
    expect(fixture.channelsPage.data).toHaveLength(4);
    expect(fixture.catalogPage.pagination.nextCursor).toEqual(expect.any(String));
    expect(fixture.catalogNextPage.pagination.nextCursor).toBeNull();
    expect(new Set(fixture.catalogPage.data.map((video) => video.mediaType)))
      .toEqual(new Set(['video', 'short', 'livestream']));
    expect(fixture.videoDetail.metadata).toEqual(expect.any(Object));
    expect(fixture.sparseVideoDetail.metadata).toBeNull();
    expect(fixture.videoRequestResponses.map((response) => response.outcome))
      .toEqual(['created', 'duplicate', 'already_downloaded']);
    expect(new Set(fixture.requests.map((request) => request.status)))
      .toEqual(new Set([
        'pending', 'approved', 'processing', 'completed',
        'rejected', 'failed', 'cancelled',
      ]));
  });

  test('keeps the ordinary catalog representative of sanitized live shapes', () => {
    const profile = fixture.representativeProfile;
    const catalog = fixture.catalogPage.data;
    const countBy = (field) => catalog.reduce((counts, row) => ({
      ...counts,
      [row[field]]: (counts[row[field]] || 0) + 1,
    }), {});

    expect(profile).toEqual(expect.objectContaining({
      basis: 'sanitized-live-shape',
      channelCount: fixture.channelsPage.data.length,
      catalogFirstPageCount: catalog.length,
      commonRatings: ['TV-Y', 'TV-Y7'],
      artworkUsesAuthenticatedSameOriginPaths: true,
    }));
    expect(countBy('mediaType')).toEqual(profile.mediaTypeCounts);
    expect(new Set(catalog.map((video) => video.rating)))
      .toEqual(new Set(profile.commonRatings));
    expect(catalog.every((video) => video.description === null)).toBe(true);
    expect(catalog.every((video) => video.requestStatus === null)).toBe(true);
    expect(catalog.every((video) => Number.isFinite(video.duration))).toBe(true);
    expect(catalog.filter((video) => video.mediaType === 'short')
      .every((video) => video.publishedAt === null)).toBe(true);
    expect(catalog.every((video) => video.thumbnailUrl ===
      `/external-api/v1/assets/videos/${video.youtubeId}/thumbnail`)).toBe(true);
    expect(fixture.channelsPage.data.every((channel) => channel.thumbnailUrl ===
      `/external-api/v1/assets/channels/${channel.id}/thumbnail`)).toBe(true);
  });

  test('contains no credential-shaped fixture fields', () => {
    const serialized = JSON.stringify(fixture);
    expect(serialized).not.toMatch(/x-api-key|x-access-token|key_hash|session-token/i);
  });

  test('matches the published cross-repository checksum', () => {
    const expected = fs.readFileSync(
      path.join(fixtureDirectory, 'SHA256SUMS'),
      'utf8'
    ).trim().split(/\s+/)[0];
    const actual = crypto.createHash('sha256').update(canonicalFixtureBytes).digest('hex');
    expect(actual).toBe(expected);
  });

  test('matches the versioned external error envelope', () => {
    expect(externalErrorBody(
      404,
      'External API route not found',
      { requestId: '00000000-0000-4000-8000-000000000001' }
    )).toEqual(fixture.error);
  });

  test.each(fixture.requests)('matches the $type request DTO', (expected) => {
    const record = {
      id: expected.id,
      request_type: expected.type,
      status: expected.status,
      youtube_id: expected.target.youtubeId,
      channel_id: expected.target.channelId,
      channel_url: expected.target.channelUrl,
      created_at: expected.createdAt,
      updated_at: expected.updatedAt,
      decided_at: expected.decidedAt,
      completed_at: expected.completedAt,
      message: expected.message,
      grant_to_requesting_key: expected.grantToRequestingKey,
    };
    expect(dto(record)).toEqual(expected);
  });
});
