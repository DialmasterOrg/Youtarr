import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  put: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useVideoEpisode } from '../useVideoEpisode';
import { ReorganizeRequiredError } from '../../Reorganize/reorganizeErrors';

const HEADERS = { headers: { 'x-access-token': 'token' } };
const EPISODE = { channelId: 'UC1', assignable: true, classification: null, shows: [{ id: 3, name: 'Beyblade', seasonNames: {} }] };

describe('useVideoEpisode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: EPISODE });
  });

  test('loads the video\'s episode', async () => {
    const { result } = renderHook(() => useVideoEpisode('abcdefghijk', 'token'));
    await waitFor(() => expect(result.current.data).toEqual(EPISODE));
    expect(axios.get).toHaveBeenCalledWith('/api/videos/abcdefghijk/episode', HEADERS);
  });

  test('loads nothing without a video', () => {
    renderHook(() => useVideoEpisode(null, 'token'));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('assigns an episode and keeps the answer', async () => {
    const after = { ...EPISODE, classification: { showId: 3, code: 'S01E20' } };
    axios.put.mockResolvedValueOnce({ data: after });
    const { result } = renderHook(() => useVideoEpisode('abcdefghijk', 'token'));
    await waitFor(() => expect(result.current.data).toEqual(EPISODE));
    await act(async () => { await result.current.assign({ showId: 3, season: 1, episode: 20 }); });
    expect(axios.put).toHaveBeenCalledWith('/api/videos/abcdefghijk/episode', { showId: 3, season: 1, episode: 20 }, HEADERS);
    expect(result.current.data).toEqual(after);
  });

  test('throws a reorganize request when the file has to move', async () => {
    const change = { type: 'titleShows', channelId: 'UC1', shows: [], overrides: [] };
    axios.put.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409, data: { error: 'Review', reorganizeRequired: true, change } } });
    const { result } = renderHook(() => useVideoEpisode('abcdefghijk', 'token'));
    await waitFor(() => expect(result.current.data).toEqual(EPISODE));
    let thrown: unknown;
    await act(async () => { try { await result.current.assign({ notAnEpisode: true }); } catch (err) { thrown = err; } });
    expect(thrown).toBeInstanceOf(ReorganizeRequiredError);
  });

  test('reports a failed load', async () => {
    axios.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 500, data: { error: 'Failed to load the episode' } } });
    const { result } = renderHook(() => useVideoEpisode('abcdefghijk', 'token'));
    await waitFor(() => expect(result.current.error).toBe('Failed to load the episode'));
  });
});
