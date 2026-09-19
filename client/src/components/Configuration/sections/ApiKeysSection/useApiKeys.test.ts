import { act, renderHook } from '@testing-library/react';
import axios from 'axios';
import { normalizePolicy, ApiKeyPolicy, useApiKeys } from './useApiKeys';
import type { ChannelListResponse } from '../../../Subscriptions/hooks/useChannelList';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

const basePolicy: ApiKeyPolicy = {
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

describe('normalizePolicy', () => {
  test.each([
    ['maxActiveJobs', '0'],
    ['hourlyWriteLimit', '31'],
    ['dailyWriteLimit', '1.5'],
    ['maxActiveJobs', ''],
  ] as const)('rejects invalid %s value %s', (field, value) => {
    const result = normalizePolicy({ ...basePolicy, [field]: value });
    expect(result.policy).toBeUndefined();
    expect(result.error).toBeTruthy();
  });

  it('keeps draft strings editable and normalizes valid integer values', () => {
    const result = normalizePolicy({
      ...basePolicy,
      maxActiveJobs: '4',
      hourlyWriteLimit: '12',
      dailyWriteLimit: '180',
    });
    expect(result.error).toBeUndefined();
    expect(result.policy).toMatchObject({ maxActiveJobs: 4, hourlyWriteLimit: 12, dailyWriteLimit: 180 });
  });
});

describe('useApiKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads every channel page and preserves the canonical database_id response shape', async () => {
    const firstPage: ChannelListResponse = {
      channels: [{
        database_id: 41,
        url: 'https://www.youtube.com/channel/UCALPHA',
        uploader: 'Alpha',
        terminated_at: null,
      }],
      total: 2,
      totalPages: 2,
    };
    const secondPage: ChannelListResponse = {
      channels: [{
        database_id: 42,
        url: 'https://www.youtube.com/channel/UCBETA',
        uploader: 'Beta',
        terminated_at: null,
      }],
      total: 2,
      totalPages: 2,
    };
    mockedAxios.get
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: secondPage });

    const { result } = renderHook(() => useApiKeys('token'));
    let channels;
    await act(async () => {
      channels = await result.current.fetchAvailableChannels();
    });

    expect(channels).toEqual([
      firstPage.channels[0],
      secondPage.channels[0],
    ]);
    expect(mockedAxios.get).toHaveBeenNthCalledWith(1, '/getchannels', expect.objectContaining({
      params: { page: 1, pageSize: 100, sortOrder: 'asc' },
    }));
    expect(mockedAxios.get).toHaveBeenNthCalledWith(2, '/getchannels', expect.objectContaining({
      params: { page: 2, pageSize: 100, sortOrder: 'asc' },
    }));
  });
});
