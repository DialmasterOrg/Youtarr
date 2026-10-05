import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useTitleShows, ShowFolderTakenError } from '../useTitleShows';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../../hooks/useLibraryFolders';
import { ReorganizeRequiredError } from '../../../shared/Reorganize/reorganizeErrors';

const HEADERS = { headers: { 'x-access-token': 'token' } };
const STATE = { shows: [], conflicts: [], showOnlyDownloads: false, tvFolders: ['TV'], defaultLibraryFolder: 'TV' };
const AFTER = { ...STATE, shows: [{ id: 3, name: 'Beyblade' }] };
const DRAFT = { name: 'Beyblade', patterns: [] };

function refusal(status: number, data: Record<string, unknown>) {
  return { isAxiosError: true, response: { status, data } };
}

describe('useTitleShows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: STATE });
  });

  async function loaded() {
    const { result } = renderHook(() => useTitleShows('UC1', 'token'));
    await waitFor(() => expect(result.current.data).toEqual(STATE));
    return { result };
  }

  test('loads the channel\'s title shows', async () => {
    await loaded();
    expect(axios.get).toHaveBeenCalledWith('/api/channels/UC1/tv/shows', HEADERS);
  });

  test('loads again when library folders change (a new TV folder)', async () => {
    await loaded();
    act(() => { window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT)); });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('does not load while disabled', () => {
    renderHook(() => useTitleShows('UC1', 'token', false));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('reports a failed load', async () => {
    axios.get.mockRejectedValueOnce(refusal(500, { error: 'Failed to load the channel\'s shows' }));
    const { result } = renderHook(() => useTitleShows('UC1', 'token'));
    await waitFor(() => expect(result.current.error).toBe('Failed to load the channel\'s shows'));
  });

  test('adds a show and keeps the returned state', async () => {
    axios.post.mockResolvedValueOnce({ data: AFTER });
    const { result } = await loaded();
    await act(async () => { await result.current.createShow(DRAFT); });
    expect(axios.post).toHaveBeenCalledWith('/api/channels/UC1/tv/shows', DRAFT, HEADERS);
    expect(result.current.data).toEqual(AFTER);
  });

  test('edits a show', async () => {
    axios.put.mockResolvedValueOnce({ data: AFTER });
    const { result } = await loaded();
    await act(async () => { await result.current.updateShow(3, DRAFT); });
    expect(axios.put).toHaveBeenCalledWith('/api/channels/UC1/tv/shows/3', DRAFT, HEADERS);
  });

  test('removes a show', async () => {
    axios.delete.mockResolvedValueOnce({ data: STATE });
    const { result } = await loaded();
    await act(async () => { await result.current.retireShow(3); });
    expect(axios.delete).toHaveBeenCalledWith('/api/channels/UC1/tv/shows/3', HEADERS);
  });

  test('restores a show', async () => {
    axios.post.mockResolvedValueOnce({ data: AFTER });
    const { result } = await loaded();
    await act(async () => { await result.current.restoreShow(3); });
    expect(axios.post).toHaveBeenCalledWith('/api/channels/UC1/tv/shows/3/restore', {}, HEADERS);
  });

  test('reorders the shows', async () => {
    axios.put.mockResolvedValueOnce({ data: AFTER });
    const { result } = await loaded();
    await act(async () => { await result.current.reorderShows([4, 3]); });
    expect(axios.put).toHaveBeenCalledWith('/api/channels/UC1/tv/shows/order', { showIds: [4, 3] }, HEADERS);
  });

  test('sets the show-only switch', async () => {
    axios.put.mockResolvedValueOnce({ data: { showOnlyDownloads: true } });
    const { result } = await loaded();
    await act(async () => { await result.current.setShowOnly(true); });
    expect(axios.put).toHaveBeenCalledWith('/api/channels/UC1/tv/show-only', { enabled: true }, HEADERS);
    expect(result.current.data?.showOnlyDownloads).toBe(true);
  });

  test('uses a duplicate\'s copy', async () => {
    axios.post.mockResolvedValueOnce({ data: AFTER });
    const { result } = await loaded();
    await act(async () => { await result.current.takeDuplicateCopy('abcdefghijk'); });
    expect(axios.post).toHaveBeenCalledWith('/api/channels/UC1/tv/conflicts/abcdefghijk/use-copy', {}, HEADERS);
  });

  test('checks the titles again', async () => {
    axios.post.mockResolvedValueOnce({ data: AFTER });
    const { result } = await loaded();
    await act(async () => { await result.current.recheck(); });
    expect(axios.post).toHaveBeenCalledWith('/api/channels/UC1/tv/recheck', {}, HEADERS);
  });

  test('throws a reorganize request when downloaded videos would move', async () => {
    const change = { type: 'titleShows', channelId: 'UC1', shows: [DRAFT] };
    axios.post.mockRejectedValueOnce(refusal(409, { error: 'Review the move first.', reorganizeRequired: true, change }));
    const { result } = await loaded();
    let thrown: unknown;
    await act(async () => { try { await result.current.createShow(DRAFT); } catch (err) { thrown = err; } });
    expect(thrown).toBeInstanceOf(ReorganizeRequiredError);
    expect((thrown as ReorganizeRequiredError).change).toEqual(change);
  });

  test('throws a taken folder with its suggestion and the show to restore', async () => {
    axios.post.mockRejectedValueOnce(refusal(409, { error: 'taken', suggestion: 'Beyblade (Chan)', retiredShowId: 5 }));
    const { result } = await loaded();
    let thrown: unknown;
    await act(async () => { try { await result.current.createShow(DRAFT); } catch (err) { thrown = err; } });
    expect(thrown).toBeInstanceOf(ShowFolderTakenError);
    expect([(thrown as ShowFolderTakenError).suggestion, (thrown as ShowFolderTakenError).retiredShowId]).toEqual(['Beyblade (Chan)', 5]);
  });

  test('throws the server\'s message for any other refusal', async () => {
    axios.post.mockRejectedValueOnce(refusal(400, { error: 'Beyblade, pattern 1: Unknown placeholder {ep}' }));
    const { result } = await loaded();
    await act(async () => {
      await expect(result.current.createShow(DRAFT)).rejects.toThrow('Unknown placeholder {ep}');
    });
  });
});
