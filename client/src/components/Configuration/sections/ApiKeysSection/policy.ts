import { ApiKey, ApiKeyPolicy, ApiKeyRole, NormalizedApiKeyPolicy } from './useApiKeys';

export const defaultPolicy: ApiKeyPolicy = {
  role: 'view',
  allowVideoRequests: false,
  allowChannelRequests: false,
  allowDeleteVideoRequests: false,
  autoApproveVideoRequests: false,
  autoApproveChannelRequests: false,
  autoApproveDeleteRequests: false,
  maxRatingLevel: 3,
  allowUnrated: false,
  allowedMediaTypes: ['video'],
  maxActiveJobs: 5,
  hourlyWriteLimit: 30,
  dailyWriteLimit: 200,
};

export const legacyRolePermissions = (role: ApiKeyRole) => ({
  allowVideoRequests: ['request', 'delete', 'admin'].includes(role),
  allowChannelRequests: ['request', 'delete', 'admin'].includes(role),
  allowDeleteVideoRequests: ['delete', 'admin'].includes(role),
});

export const permissionsFromKey = (key: ApiKey) => {
  const fallback = legacyRolePermissions(key.role);
  return {
    allowVideoRequests: key.allow_video_requests ?? fallback.allowVideoRequests,
    allowChannelRequests: key.allow_channel_requests ?? fallback.allowChannelRequests,
    allowDeleteVideoRequests:
      key.allow_delete_video_requests ?? fallback.allowDeleteVideoRequests,
  };
};

export const roleForPolicy = (policy: ApiKeyPolicy): ApiKeyRole => {
  if (policy.role === 'admin') return 'admin';
  if (policy.allowDeleteVideoRequests) return 'delete';
  if (policy.allowVideoRequests || policy.allowChannelRequests) return 'request';
  return 'view';
};

export const policyFromKey = (key: ApiKey): ApiKeyPolicy => ({
  role: key.role,
  ...permissionsFromKey(key),
  autoApproveVideoRequests: key.auto_approve_video_requests,
  autoApproveChannelRequests: key.auto_approve_channel_requests,
  autoApproveDeleteRequests: key.auto_approve_delete_requests,
  maxRatingLevel: key.max_rating_level,
  allowUnrated: key.allow_unrated,
  allowedMediaTypes: key.allowed_media_types,
  maxActiveJobs: key.max_active_jobs ?? 5,
  hourlyWriteLimit: key.hourly_write_limit ?? 30,
  dailyWriteLimit: key.daily_write_limit ?? 200,
});

export function increasesPrivilege(key: ApiKey, policy: NormalizedApiKeyPolicy, channelIds: number[], originalIds: number[]) {
  const previous = policyFromKey(key);
  const permissions = ['allowVideoRequests', 'allowChannelRequests', 'allowDeleteVideoRequests',
    'autoApproveVideoRequests', 'autoApproveChannelRequests', 'autoApproveDeleteRequests', 'allowUnrated'] as const;
  return permissions.some(field => policy[field] && !previous[field]) ||
    policy.maxRatingLevel > previous.maxRatingLevel ||
    policy.allowedMediaTypes.some(type => !previous.allowedMediaTypes.includes(type)) ||
    policy.maxActiveJobs > Number(previous.maxActiveJobs) ||
    policy.hourlyWriteLimit > Number(previous.hourlyWriteLimit) ||
    policy.dailyWriteLimit > Number(previous.dailyWriteLimit) ||
    channelIds.some(id => !originalIds.includes(id));
}
