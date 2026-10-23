import { renderHook, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useMissingEpisodes } from '../useMissingEpisodes';

const MISSING = { showId: 3, name: 'Beyblade', seasons: [] };

describe('useMissingEpisodes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: MISSING });
  });

  test('loads a show\'s missing episodes', async () => {
    const { result } = renderHook(() => useMissingEpisodes('UC1', 3, 'token'));
    await waitFor(() => expect(result.current.data).toEqual(MISSING));
    expect(axios.get).toHaveBeenCalledWith('/api/channels/UC1/tv/shows/3/missing', { headers: { 'x-access-token': 'token' } });
  });

  test('loads nothing without a show', () => {
    renderHook(() => useMissingEpisodes('UC1', null, 'token'));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('reports a failed load', async () => {
    axios.get.mockRejectedValueOnce({ isAxiosError: true, response: { status: 404, data: { error: 'Show not found' } } });
    const { result } = renderHook(() => useMissingEpisodes('UC1', 3, 'token'));
    await waitFor(() => expect(result.current.error).toBe('Show not found'));
  });
});
