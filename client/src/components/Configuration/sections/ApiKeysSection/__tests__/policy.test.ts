import { increasesPrivilege, legacyRolePermissions, policyFromKey, roleForPolicy } from '../policy';
import type { ApiKey, NormalizedApiKeyPolicy } from '../useApiKeys';

const key: ApiKey = {
  id: 7,
  name: 'Client',
  key_prefix: 'abc12345',
  created_at: '2026-07-27T18:30:00.000Z',
  last_used_at: null,
  is_active: true,
  usage_count: 0,
  role: 'request',
  allow_video_requests: true,
  allow_channel_requests: false,
  allow_delete_video_requests: false,
  auto_approve_video_requests: false,
  auto_approve_channel_requests: false,
  auto_approve_delete_requests: false,
  max_rating_level: 2,
  allow_unrated: false,
  allowed_media_types: ['video'],
  max_active_jobs: 3,
  hourly_write_limit: 10,
  daily_write_limit: 50,
  revoked_at: null,
};

const samePolicy = (): NormalizedApiKeyPolicy => {
  const policy = policyFromKey(key);
  return {
    ...policy,
    maxActiveJobs: Number(policy.maxActiveJobs),
    hourlyWriteLimit: Number(policy.hourlyWriteLimit),
    dailyWriteLimit: Number(policy.dailyWriteLimit),
  };
};

describe('increasesPrivilege', () => {
  test('is false for an unchanged policy and grant set', () => {
    expect(increasesPrivilege(key, samePolicy(), [3], [3])).toBe(false);
  });

  test('is false when access only narrows', () => {
    const narrower = { ...samePolicy(), allowVideoRequests: false, maxRatingLevel: 1, dailyWriteLimit: 20 };
    expect(increasesPrivilege(key, narrower, [], [3])).toBe(false);
  });

  test.each([
    ['a new permission', { allowChannelRequests: true }],
    ['a new auto-approval', { autoApproveVideoRequests: true }],
    ['unrated content', { allowUnrated: true }],
    ['a higher rating ceiling', { maxRatingLevel: 3 }],
    ['a new media type', { allowedMediaTypes: ['video', 'short'] }],
    ['more active jobs', { maxActiveJobs: 4 }],
    ['a higher hourly limit', { hourlyWriteLimit: 11 }],
    ['a higher daily limit', { dailyWriteLimit: 51 }],
  ] as const)('is true for %s', (_label, change) => {
    expect(increasesPrivilege(key, { ...samePolicy(), ...change } as NormalizedApiKeyPolicy, [3], [3])).toBe(true);
  });

  test('is true when a channel is added', () => {
    expect(increasesPrivilege(key, samePolicy(), [3, 9], [3])).toBe(true);
  });
});

describe('policyFromKey', () => {
  test('falls back to the role and the workload ceilings for older keys', () => {
    const older = {
      ...key,
      role: 'delete' as const,
      allow_video_requests: undefined,
      allow_channel_requests: undefined,
      allow_delete_video_requests: undefined,
      max_active_jobs: undefined,
      hourly_write_limit: undefined,
      daily_write_limit: undefined,
    } as unknown as ApiKey;

    expect(policyFromKey(older)).toMatchObject({
      ...legacyRolePermissions('delete'),
      maxActiveJobs: 5,
      hourlyWriteLimit: 30,
      dailyWriteLimit: 200,
    });
  });
});

describe('roleForPolicy', () => {
  test('derives the narrowest role that covers the permissions', () => {
    const base = samePolicy();
    expect(roleForPolicy({ ...base, allowVideoRequests: false })).toBe('view');
    expect(roleForPolicy(base)).toBe('request');
    expect(roleForPolicy({ ...base, allowDeleteVideoRequests: true })).toBe('delete');
    expect(roleForPolicy({ ...base, role: 'admin' })).toBe('admin');
  });
});
