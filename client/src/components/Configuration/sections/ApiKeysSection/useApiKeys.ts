import { useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  ChannelListEntry,
  ChannelListResponse,
} from '../../../Subscriptions/hooks/useChannelList';

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  usage_count: number;
  channel_grant_count?: number;
  role: ApiKeyRole;
  auto_approve_video_requests: boolean;
  auto_approve_channel_requests: boolean;
  auto_approve_delete_requests: boolean;
  allow_video_requests: boolean;
  allow_channel_requests: boolean;
  allow_delete_video_requests: boolean;
  max_rating_level: number;
  allow_unrated: boolean;
  allowed_media_types: MediaType[];
  max_active_jobs?: number;
  hourly_write_limit?: number;
  daily_write_limit?: number;
  revoked_at: string | null;
}

export type ApiKeyRole = 'legacy_download' | 'view' | 'request' | 'delete' | 'admin';
export type MediaType = 'video' | 'short' | 'livestream';

export interface ApiKeyPolicy {
  role: ApiKeyRole;
  allowVideoRequests: boolean;
  allowChannelRequests: boolean;
  allowDeleteVideoRequests: boolean;
  autoApproveVideoRequests: boolean;
  autoApproveChannelRequests: boolean;
  autoApproveDeleteRequests: boolean;
  maxRatingLevel: number;
  allowUnrated: boolean;
  allowedMediaTypes: MediaType[];
  maxActiveJobs: number | string;
  hourlyWriteLimit: number | string;
  dailyWriteLimit: number | string;
}

export type NormalizedApiKeyPolicy = Omit<
  ApiKeyPolicy,
  'maxActiveJobs' | 'hourlyWriteLimit' | 'dailyWriteLimit'
> & {
  maxActiveJobs: number;
  hourlyWriteLimit: number;
  dailyWriteLimit: number;
};

export interface ApiKeyCreatedResponse {
  success: boolean;
  message: string;
  id: number;
  name: string;
  key: string;
  prefix: string;
}

interface ApiKeyListResponse { keys: ApiKey[] }
interface ChannelGrantsResponse { keyId: number; channelIds: number[] }
interface ApiKeyRequest { policy: NormalizedApiKeyPolicy; channelIds: number[] }

export interface NormalizedPolicyResult {
  policy?: NormalizedApiKeyPolicy;
  error?: string;
}

export const normalizePolicy = (policy: ApiKeyPolicy): NormalizedPolicyResult => {
  const fields: Array<[keyof Pick<ApiKeyPolicy, 'maxActiveJobs' | 'hourlyWriteLimit' | 'dailyWriteLimit'>, string, number, number]> = [
    ['maxActiveJobs', 'Active jobs', 1, 5],
    ['hourlyWriteLimit', 'Writes per hour', 1, 30],
    ['dailyWriteLimit', 'Writes per day', 1, 200],
  ];
  const normalized = { ...policy };
  for (const [field, label, min, max] of fields) {
    const value = String(policy[field]).trim();
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
      return { error: `${label} must be an integer from ${min} to ${max}.` };
    }
    normalized[field] = Number(value);
  }
  return { policy: normalized as NormalizedApiKeyPolicy };
};



export const useApiKeys = (token: string | null) => {
  const headers = useMemo(() => (token ? { 'x-access-token': token } : undefined), [token]);
  const fetchApiKeys = useCallback(async () => {
    if (!token) return [];
    const { data } = await axios.get<ApiKeyListResponse>('/api/keys', { headers });
    return data.keys || [];
  }, [headers, token]);

  const fetchAvailableChannels = useCallback(async () => {
    if (!token) return [];
    const channels: ChannelListEntry[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const { data } = await axios.get<ChannelListResponse>('/getchannels', {
        headers,
        params: { page, pageSize: 100, sortOrder: 'asc' },
      });
      channels.push(...(data.channels || []));
      totalPages = Number.isInteger(Number(data.totalPages)) && Number(data.totalPages) > 0
        ? Number(data.totalPages) : 1;
      page += 1;
    } while (page <= totalPages);
    return channels;
  }, [headers, token]);

  const fetchChannelGrants = useCallback(async (keyId: number) => {
    const { data } = await axios.get<ChannelGrantsResponse>(`/api/keys/${keyId}/channels`, { headers });
    return data.channelIds || [];
  }, [headers]);

  const createApiKey = useCallback(async (name: string, policy?: NormalizedApiKeyPolicy, channelIds?: number[]) => {
    const { data } = await axios.post<ApiKeyCreatedResponse>('/api/keys', {
      name,
      ...(policy ? { policy, channelIds: channelIds || [] } : {}),
    }, { headers });
    return data;
  }, [headers]);

  const updateExternalAccess = useCallback(async (keyId: number, request: ApiKeyRequest) => {
    const { data } = await axios.put(`/api/keys/${keyId}/external-access`, request, { headers });
    return data;
  }, [headers]);

  const revokeApiKey = useCallback(async (keyId: number) => {
    const { data } = await axios.delete(`/api/keys/${keyId}`, { headers });
    return data;
  }, [headers]);

  const regenerateApiKey = useCallback(async (keyId: number) => {
    const { data } = await axios.post<ApiKeyCreatedResponse>(`/api/keys/${keyId}/regenerate`, undefined, { headers });
    return data;
  }, [headers]);

  return useMemo(() => ({
    fetchApiKeys,
    fetchAvailableChannels,
    fetchChannelGrants,
    createApiKey,
    updateExternalAccess,
    revokeApiKey,
    regenerateApiKey,
  }), [
    createApiKey,
    fetchApiKeys,
    fetchAvailableChannels,
    fetchChannelGrants,
    regenerateApiKey,
    revokeApiKey,
    updateExternalAccess,
  ]);
};
