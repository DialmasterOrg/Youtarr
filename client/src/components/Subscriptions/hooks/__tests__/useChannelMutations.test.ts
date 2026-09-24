import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useChannelMutations } from '../useChannelMutations';
import { Channel } from '../../../../types/Channel';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');
const mockedAxios = axios as {
  post: jest.Mock;
};

describe('useChannelMutations', () => {
  const token = 'test-token';
  const validUrl = 'https://www.youtube.com/@example';

  const mockChannelInfo = {
    uploader: 'Example Uploader',
    channel_id: 'chan-123',
    auto_download_enabled_tabs: 'videos',
    available_tabs: 'videos,streams',
    sub_folder: 'folder',
    video_quality: '1080',
    min_duration: 10,
    max_duration: 20,
    title_filter_regex: '.*',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('initializes with default state', () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    expect(result.current.pendingAdditions).toEqual([]);
    expect(result.current.deletedChannels).toEqual([]);
    expect(result.current.isAddingChannel).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  const lookupAndAdd = async (result: { current: ReturnType<typeof useChannelMutations> }) => {
    let lookup: Awaited<ReturnType<ReturnType<typeof useChannelMutations>['lookupChannel']>> | undefined;
    await act(async () => {
      lookup = await result.current.lookupChannel(validUrl);
    });
    act(() => {
      result.current.addPendingChannel(lookup!.channel!);
    });
  };

  test('requires authentication to look up a channel', async () => {
    const { result } = renderHook(() => useChannelMutations({ token: null, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.lookupChannel(validUrl);
    });

    expect(response).toEqual({ success: false, message: 'Authentication required' });
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('rejects invalid channel input', async () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.lookupChannel('https://google.com/not-valid');
    });

    expect(response).toEqual({
      success: false,
      message: 'Invalid channel URL or handle. Please double-check the format.',
    });
    expect(result.current.isAddingChannel).toBe(false);
  });

  test('returns the looked-up channel without adding it to pending', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response: Awaited<ReturnType<typeof result.current.lookupChannel>> | undefined;
    await act(async () => {
      response = await result.current.lookupChannel(validUrl);
    });

    expect(mockedAxios.post).toHaveBeenCalledWith('/addchannelinfo', { url: validUrl }, {
      headers: { 'x-access-token': token },
    });
    expect(response?.channel).toMatchObject({
      url: validUrl,
      uploader: 'Example Uploader',
      channel_id: 'chan-123',
      auto_download_enabled_tabs: 'videos',
      available_tabs: 'videos,streams',
      sub_folder: 'folder',
      video_quality: '1080',
      restored: false,
    });
    expect(result.current.pendingAdditions).toHaveLength(0);
  });

  test('marks a soft-deleted channel as restored with its previous settings', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        status: 'success',
        channelInfo: { ...mockChannelInfo, audio_format: 'mp3_only', existing: true, enabled: false },
      },
    });
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response: Awaited<ReturnType<typeof result.current.lookupChannel>> | undefined;
    await act(async () => {
      response = await result.current.lookupChannel(validUrl);
    });

    expect(response?.channel).toMatchObject({ restored: true, audio_format: 'mp3_only', sub_folder: 'folder' });
  });

  test('returns the pending entry when the channel is already pending', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));
    await lookupAndAdd(result);

    let duplicate: Awaited<ReturnType<typeof result.current.lookupChannel>> | undefined;
    await act(async () => {
      duplicate = await result.current.lookupChannel(validUrl);
    });

    expect(duplicate).toMatchObject({ success: true, alreadyPending: true, channel: { url: validUrl } });
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  test('restores a channel that was queued for deletion', async () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    const channel: Channel = { url: validUrl, uploader: 'Example' };

    act(() => {
      result.current.queueChannelForDeletion(channel);
    });

    let response;
    await act(async () => {
      response = await result.current.lookupChannel(validUrl);
    });

    expect(response).toEqual({ success: true, message: 'Channel restored from pending removal' });
    expect(result.current.deletedChannels).toHaveLength(0);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('skips adding when the channel is already an active subscription', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        status: 'success',
        channelInfo: { ...mockChannelInfo, existing: true, enabled: true },
      },
    });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.lookupChannel(validUrl);
    });

    expect(response).toEqual({ success: false, message: 'Channel already exists' });
    expect(result.current.isAddingChannel).toBe(false);
  });

  test('returns specific error messages based on API errors when looking up a channel', async () => {
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 503 } });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.lookupChannel(validUrl);
    });

    expect(response).toEqual({
      success: false,
      message: 'Channel not found. Please check the URL or channel name and try again.',
    });
    expect(result.current.isAddingChannel).toBe(false);
  });

  test('addPendingChannel adds the channel to pending changes', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    await lookupAndAdd(result);

    expect(result.current.pendingAdditions).toHaveLength(1);
    expect(result.current.hasPendingChanges).toBe(true);
  });

  test('updatePendingChannel replaces the settings of a pending channel', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));
    await lookupAndAdd(result);

    act(() => {
      result.current.updatePendingChannel(validUrl, {
        auto_download_enabled_tabs: 'livestream',
        video_quality: '720',
        audio_format: 'video_mp3',
        sub_folder: 'Kids',
      });
    });

    expect(result.current.pendingAdditions[0]).toMatchObject({
      auto_download_enabled_tabs: 'livestream',
      video_quality: '720',
      audio_format: 'video_mp3',
      sub_folder: 'Kids',
    });
  });

  test('queueChannelForDeletion removes pending additions instead of marking deleted', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    await lookupAndAdd(result);

    act(() => {
      result.current.queueChannelForDeletion(result.current.pendingAdditions[0]);
    });

    expect(result.current.pendingAdditions).toHaveLength(0);
    expect(result.current.deletedChannels).toHaveLength(0);
  });

  test('queueChannelForDeletion adds unique deletions', () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    const channel: Channel = { url: validUrl, uploader: 'Example' };

    act(() => {
      result.current.queueChannelForDeletion(channel);
    });

    act(() => {
      result.current.queueChannelForDeletion(channel);
    });

    expect(result.current.deletedChannels).toEqual([validUrl]);
    expect(result.current.hasPendingChanges).toBe(true);
  });

  test('undoChanges clears pending state and triggers refresh', () => {
    const onRefresh = jest.fn();
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh }));

    const channel: Channel = { url: validUrl, uploader: 'Example' };

    act(() => {
      result.current.queueChannelForDeletion(channel);
    });

    act(() => {
      result.current.undoChanges();
    });

    expect(result.current.pendingAdditions).toEqual([]);
    expect(result.current.deletedChannels).toEqual([]);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('saveChanges requires authentication', async () => {
    const { result } = renderHook(() => useChannelMutations({ token: null, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.saveChanges();
    });

    expect(response).toEqual({ success: false, message: 'Authentication required' });
    expect(result.current.isSaving).toBe(false);
  });

  test('saveChanges returns message when there is nothing to save', async () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.saveChanges();
    });

    expect(response).toEqual({ success: false, message: 'No pending changes to save' });
    expect(result.current.isSaving).toBe(false);
  });

  test('saveChanges persists queued additions and clears state', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const onRefresh = jest.fn();
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh }));

    await lookupAndAdd(result);

    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    let response;
    await act(async () => {
      response = await result.current.saveChanges();
    });

    expect(mockedAxios.post).toHaveBeenLastCalledWith('/updatechannels', {
      add: [{
        url: validUrl,
        channel_id: 'chan-123',
        settings: {
          auto_download_enabled_tabs: 'videos',
          video_quality: '1080',
          audio_format: null,
          sub_folder: 'folder',
        },
      }],
      remove: [],
    }, {
      headers: { 'x-access-token': token },
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, message: 'Channels updated successfully' });
    expect(result.current.pendingAdditions).toHaveLength(0);
    expect(result.current.deletedChannels).toHaveLength(0);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('saveChanges surfaces API errors and retains pending changes', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    await lookupAndAdd(result);

    mockedAxios.post.mockRejectedValueOnce({ response: { data: { error: 'Invalid video quality' } } });

    let response;
    await act(async () => {
      response = await result.current.saveChanges();
    });

    expect(response).toEqual({ success: false, message: 'Invalid video quality' });
    expect(result.current.pendingAdditions).toHaveLength(1);
    expect(result.current.deletedChannels).toHaveLength(0);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasPendingChanges).toBe(true);
  });

  test('saveChanges omits auto-download tabs when no tabs were detected', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: { ...mockChannelInfo, available_tabs: null } },
    });
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));
    await lookupAndAdd(result);

    mockedAxios.post.mockResolvedValueOnce({ data: { status: 'success' } });
    await act(async () => {
      await result.current.saveChanges();
    });

    const payload = mockedAxios.post.mock.calls[1][1];
    expect(payload.add[0].settings).not.toHaveProperty('auto_download_enabled_tabs');
  });
});
