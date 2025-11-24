import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useChannelMutations } from '../useChannelMutations';
import { Channel } from '../../../../types/Channel';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');
const mockedAxios = axios as {
  get: jest.Mock;
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
    mockedAxios.get.mockResolvedValue({ data: { channels: [] } });
  });

  test('initializes with default state', () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    expect(result.current.pendingAdditions).toEqual([]);
    expect(result.current.deletedChannels).toEqual([]);
    expect(result.current.isAddingChannel).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('requires authentication to add a channel', async () => {
    const { result } = renderHook(() => useChannelMutations({ token: null, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.addChannel(validUrl);
    });

    expect(response).toEqual({ success: false, message: 'Authentication required' });
    expect(result.current.pendingAdditions).toHaveLength(0);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('rejects invalid channel input', async () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.addChannel('https://google.com/not-valid');
    });

    expect(response).toEqual({
      success: false,
      message: 'Invalid channel URL or handle. Please double-check the format.',
    });
    expect(result.current.pendingAdditions).toHaveLength(0);
    expect(result.current.isAddingChannel).toBe(false);
  });

  test('prevents adding the same channel twice while pending', async () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [] } });
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    await act(async () => {
      await result.current.addChannel(validUrl);
    });

    let duplicateResponse;
    await act(async () => {
      duplicateResponse = await result.current.addChannel(validUrl);
    });

    expect(duplicateResponse).toEqual({ success: false, message: 'Channel already added and pending save' });
    expect(result.current.pendingAdditions).toHaveLength(1);
  });

  test('restores a channel that was queued for deletion', async () => {
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    const channel: Channel = { url: validUrl, uploader: 'Example' };

    act(() => {
      result.current.queueChannelForDeletion(channel);
    });

    let response;
    await act(async () => {
      response = await result.current.addChannel(validUrl);
    });

    expect(response).toEqual({ success: true, message: 'Channel restored from pending removal' });
    expect(result.current.deletedChannels).toHaveLength(0);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  test('skips adding when the channel already exists on the server', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [{ url: validUrl }] } });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.addChannel(validUrl);
    });

    expect(mockedAxios.get).toHaveBeenCalledWith('/getchannels', {
      headers: { 'x-access-token': token },
      params: { page: 1, pageSize: 16, search: validUrl },
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(response).toEqual({ success: false, message: 'Channel already exists' });
    expect(result.current.pendingAdditions).toHaveLength(0);
    expect(result.current.isAddingChannel).toBe(false);
  });

  test('adds a channel successfully and formats channel info', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [] } });
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.addChannel(validUrl);
    });

    expect(response).toEqual({ success: true });
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith('/addchannelinfo', { url: validUrl }, {
      headers: { 'x-access-token': token },
    });
    expect(result.current.pendingAdditions).toHaveLength(1);
    expect(result.current.pendingAdditions[0]).toMatchObject({
      url: validUrl,
      uploader: 'Example Uploader',
      channel_id: 'chan-123',
      auto_download_enabled_tabs: 'videos',
      available_tabs: 'videos,streams',
      sub_folder: 'folder',
      video_quality: '1080',
      min_duration: 10,
      max_duration: 20,
      title_filter_regex: '.*',
    });
    expect(result.current.isAddingChannel).toBe(false);
    expect(result.current.hasPendingChanges).toBe(true);
  });

  test('returns specific error messages based on API errors when adding a channel', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [] } });
    mockedAxios.post.mockRejectedValueOnce({ response: { status: 503 } });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    let response;
    await act(async () => {
      response = await result.current.addChannel(validUrl);
    });

    expect(response).toEqual({
      success: false,
      message: 'Channel not found. Please check the URL or channel name and try again.',
    });
    expect(result.current.pendingAdditions).toHaveLength(0);
    expect(result.current.isAddingChannel).toBe(false);
  });

  test('queueChannelForDeletion removes pending additions instead of marking deleted', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [] } });
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    await act(async () => {
      await result.current.addChannel(validUrl);
    });

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
    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [] } });
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const onRefresh = jest.fn();
    const { result } = renderHook(() => useChannelMutations({ token, onRefresh }));

    await act(async () => {
      await result.current.addChannel(validUrl);
    });

    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    let response;
    await act(async () => {
      response = await result.current.saveChanges();
    });

    expect(mockedAxios.post).toHaveBeenLastCalledWith('/updatechannels', {
      add: [{ url: validUrl, channel_id: 'chan-123' }],
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
    mockedAxios.get.mockResolvedValueOnce({ data: { channels: [] } });
    mockedAxios.post.mockResolvedValueOnce({
      data: { status: 'success', channelInfo: mockChannelInfo },
    });

    const { result } = renderHook(() => useChannelMutations({ token, onRefresh: jest.fn() }));

    await act(async () => {
      await result.current.addChannel(validUrl);
    });

    mockedAxios.post.mockRejectedValueOnce({ response: { data: { message: 'update failed' } } });

    let response;
    await act(async () => {
      response = await result.current.saveChanges();
    });

    expect(response).toEqual({ success: false, message: 'update failed' });
    expect(result.current.pendingAdditions).toHaveLength(1);
    expect(result.current.deletedChannels).toHaveLength(0);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.hasPendingChanges).toBe(true);
  });
});
