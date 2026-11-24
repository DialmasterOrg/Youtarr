import { act, renderHook, waitFor } from '@testing-library/react';
import { useExternalAccessEditor } from '../useExternalAccessEditor';
import type { ApiKey, useApiKeys } from '../useApiKeys';

const key: ApiKey = {
  id: 7,
  name: 'Client',
  key_prefix: 'abc12345',
  created_at: '2026-07-27T18:30:00.000Z',
  last_used_at: null,
  is_active: true,
  usage_count: 0,
  role: 'view',
  allow_video_requests: false,
  allow_channel_requests: false,
  allow_delete_video_requests: false,
  auto_approve_video_requests: false,
  auto_approve_channel_requests: false,
  auto_approve_delete_requests: false,
  max_rating_level: 2,
  allow_unrated: false,
  allowed_media_types: ['video'],
  max_active_jobs: 5,
  hourly_write_limit: 30,
  daily_write_limit: 200,
  revoked_at: null,
};

const channel = (id: number, terminated = false) => ({
  database_id: id,
  url: `https://www.youtube.com/channel/UC${id}`,
  uploader: `Channel ${id}`,
  terminated_at: terminated ? '2026-07-01T00:00:00.000Z' : null,
});

type Api = ReturnType<typeof useApiKeys>;

const makeApi = (overrides: Partial<Api> = {}): Api => ({
  fetchApiKeys: jest.fn(),
  fetchAvailableChannels: jest.fn().mockResolvedValue([channel(3), channel(4, true), channel(9)]),
  fetchChannelGrants: jest.fn().mockResolvedValue([3]),
  createApiKey: jest.fn(),
  updateExternalAccess: jest.fn().mockResolvedValue({ success: true }),
  revokeApiKey: jest.fn(),
  regenerateApiKey: jest.fn(),
  ...overrides,
});

const renderEditor = (api: Api) => {
  const onSaved = jest.fn();
  const onClose = jest.fn();
  const view = renderHook(() => useExternalAccessEditor({ apiKey: key, api, onClose, onSaved }));
  return { ...view, onSaved, onClose };
};

describe('useExternalAccessEditor', () => {
  test('loads the current grants and hides terminated channels', async () => {
    const { result } = renderEditor(makeApi());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.selectedChannelIds).toEqual([3]);
    expect(result.current.channelOptions.map((option) => option.database_id)).toEqual([3, 9]);
  });

  test('saves a change that narrows access without asking first', async () => {
    const api = makeApi();
    const { result, onSaved } = renderEditor(api);
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedChannelIds([]));
    await act(async () => { await result.current.saveExternalAccess(); });

    expect(api.updateExternalAccess).toHaveBeenCalledWith(7, expect.objectContaining({ channelIds: [] }));
    expect(onSaved).toHaveBeenCalled();
    expect(result.current.pendingExternalUpdate).toBeNull();
  });

  test('asks before saving a change that widens access', async () => {
    const api = makeApi();
    const { result, onSaved } = renderEditor(api);
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSelectedChannelIds([3, 9]));
    await act(async () => { await result.current.saveExternalAccess(); });

    expect(api.updateExternalAccess).not.toHaveBeenCalled();
    expect(result.current.pendingExternalUpdate).toMatchObject({ keyId: 7, channelIds: [3, 9] });

    await act(async () => { await result.current.confirmPrivilegeIncrease(); });
    expect(api.updateExternalAccess).toHaveBeenCalledWith(7, expect.objectContaining({ channelIds: [3, 9] }));
    expect(onSaved).toHaveBeenCalled();
  });

  test('keeps the dialog open with the error when saving fails', async () => {
    const api = makeApi({ updateExternalAccess: jest.fn().mockRejectedValue(new Error('Save failed')) });
    const { result, onSaved } = renderEditor(api);
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.saveExternalAccess(); });

    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.editSubmitError).toBe('Save failed');
    expect(result.current.savingPolicy).toBe(false);
  });

  test('blocks saving until a failed load is retried', async () => {
    const fetchChannelGrants = jest.fn()
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([3]);
    const api = makeApi({ fetchChannelGrants });
    const { result } = renderEditor(api);
    await waitFor(() => expect(result.current.editLoadError).toBe('Network down'));

    await act(async () => { await result.current.saveExternalAccess(); });
    expect(api.updateExternalAccess).not.toHaveBeenCalled();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.editLoadError).toBeNull();
    expect(result.current.selectedChannelIds).toEqual([3]);
  });
});
