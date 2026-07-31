'use strict';

const { ApiKey, ApiKeyChannelGrant, ExternalRequest, ExternalApiUsageBucket } = require('..');

describe('external API persistence models', () => {
  test('expose safe defaults and constrained policy values', () => {
    expect(ApiKey.rawAttributes.role.defaultValue).toBe('legacy_download');
    expect(ApiKey.rawAttributes.role.validate.isIn[0]).toContain('full_access');
    expect(ApiKey.rawAttributes.allowed_media_types.defaultValue).toEqual(['video']);
    expect(ApiKeyChannelGrant.options.indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({ unique: true, fields: ['api_key_id', 'channel_id'] }),
    ]));
    expect(ExternalRequest.rawAttributes.status.validate.isIn[0]).toContain('pending');
    expect(ExternalApiUsageBucket.rawAttributes.window_type.validate.isIn[0]).toEqual(['hour', 'day']);
    expect(ExternalRequest.options.indexes.map((index) => index.name)).toEqual(expect.arrayContaining([
      'external_requests_key_created_idx', 'external_requests_key_status_idx',
    ]));
  });

  test('register associations for grants, requests, jobs, and quota buckets', () => {
    expect(ApiKey.associations.channelGrants).toBeDefined();
    expect(ApiKey.associations.externalRequests).toBeDefined();
    expect(ApiKey.associations.usageBuckets).toBeDefined();
    expect(ExternalRequest.associations.channel).toBeDefined();
    expect(ExternalRequest.associations.job).toBeDefined();
  });
});
