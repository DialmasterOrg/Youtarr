import { renderHook, act } from '@testing-library/react';
import { useChannelDownloadAll } from '../useChannelDownloadAll';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

const CHANNEL_ID = 'UC123';
const TOKEN = 'token-1';
const PREVIEW = { count: 42, totalDurationSeconds: 3600, missingDurations: 2 };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('fetchPreview', () => {
  test('fetches and stores the preview for a tab', async () => {
    axios.get.mockResolvedValue({ data: PREVIEW });

    const { result } = renderHook(() => useChannelDownloadAll(CHANNEL_ID, TOKEN));

    let returned: typeof PREVIEW | null = null;
    await act(async () => {
      returned = await result.current.fetchPreview('videos');
    });

    expect(axios.get).toHaveBeenCalledWith(
      `/api/channels/${CHANNEL_ID}/download-all/preview`,
      { params: { tabType: 'videos' }, headers: { 'x-access-token': TOKEN } }
    );
    expect(returned).toEqual(PREVIEW);
    expect(result.current.preview).toEqual(PREVIEW);
    expect(result.current.error).toBeNull();
  });

  test('returns null without fetching when there is no token', async () => {
    const { result } = renderHook(() => useChannelDownloadAll(CHANNEL_ID, null));

    let returned: typeof PREVIEW | null = PREVIEW;
    await act(async () => {
      returned = await result.current.fetchPreview('videos');
    });

    expect(returned).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('sets an error and returns null when the request fails', async () => {
    axios.get.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useChannelDownloadAll(CHANNEL_ID, TOKEN));

    let returned: typeof PREVIEW | null = PREVIEW;
    await act(async () => {
      returned = await result.current.fetchPreview('videos');
    });

    expect(returned).toBeNull();
    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBe('Failed to load the download preview');
  });
});

describe('startDownloadAll', () => {
  test('posts the tab and settings and returns the queued count', async () => {
    axios.post.mockResolvedValue({ data: { status: 'accepted', queued: 42 } });

    const { result } = renderHook(() => useChannelDownloadAll(CHANNEL_ID, TOKEN));

    let queued: number | null = null;
    await act(async () => {
      queued = await result.current.startDownloadAll('videos', { resolution: '720' });
    });

    expect(axios.post).toHaveBeenCalledWith(
      `/api/channels/${CHANNEL_ID}/download-all`,
      { tabType: 'videos', overrideSettings: { resolution: '720' } },
      { headers: { 'x-access-token': TOKEN } }
    );
    expect(queued).toBe(42);
  });

  test('sets an error and returns null when the request fails', async () => {
    axios.post.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useChannelDownloadAll(CHANNEL_ID, TOKEN));

    let queued: number | null = 0;
    await act(async () => {
      queued = await result.current.startDownloadAll('videos');
    });

    expect(queued).toBeNull();
    expect(result.current.error).toBe('Failed to start the download');
  });
});

describe('resetPreview', () => {
  test('clears the stored preview and error', async () => {
    axios.get.mockResolvedValue({ data: PREVIEW });

    const { result } = renderHook(() => useChannelDownloadAll(CHANNEL_ID, TOKEN));

    await act(async () => {
      await result.current.fetchPreview('videos');
    });
    expect(result.current.preview).toEqual(PREVIEW);

    act(() => {
      result.current.resetPreview();
    });

    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
