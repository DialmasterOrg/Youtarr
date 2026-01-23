import { renderHook, waitFor } from '@testing-library/react';
import { useChannelList } from '../useChannelList';
import axios from 'axios';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useChannelList', () => {
  const mockToken = 'test-token';
  const baseParams = {
    token: mockToken,
    page: 1,
    pageSize: 20,
    searchTerm: '',
    sortOrder: 'asc' as const,
    subFolder: undefined as string | undefined,
    append: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not fetch when token is null', () => {
    renderHook(() =>
      useChannelList({
        ...baseParams,
        token: null,
      })
    );

    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  test('handles payload with channels array', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        channels: [
          {
            url: 'https://youtube.com/@alpha',
            uploader: 'Alpha',
            channel_id: 'UC_ALPHA',
          },
        ],
        total: 1,
        totalPages: 1,
        subFolders: ['__default__'],
      },
    } as any);

    const { result } = renderHook(() => useChannelList(baseParams));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.channels).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.subFolders).toEqual(['__default__']);
    expect(result.current.error).toBeNull();
  });

  test('handles payload with channels.rows and count', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        channels: {
          rows: [
            {
              url: 'https://youtube.com/@beta',
              uploader: 'Beta',
              channel_id: 'UC_BETA',
            },
          ],
          count: 5,
          totalPages: 2,
        },
        subfolders: ['__default__', '__Kids'],
      },
    } as any);

    const { result } = renderHook(() => useChannelList(baseParams));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.channels).toHaveLength(1);
    expect(result.current.total).toBe(5);
    expect(result.current.totalPages).toBe(2);
    expect(result.current.subFolders).toEqual(['__default__', '__Kids']);
  });

  test('sets timeout error when request aborts', async () => {
    mockedAxios.get.mockRejectedValueOnce({ code: 'ECONNABORTED' });

    const { result } = renderHook(() => useChannelList(baseParams));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Channel sync timed out. Please try again.');
  });

  test('logs unexpected payload shape', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        channels: 'not-an-array',
      },
    } as any);

    const { result } = renderHook(() => useChannelList(baseParams));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(console.warn).toHaveBeenCalled();
    expect(result.current.channels).toEqual([]);
  });
});
