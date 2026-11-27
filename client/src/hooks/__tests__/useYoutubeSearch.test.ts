import { act, renderHook, waitFor } from '@testing-library/react';
import { YoutubeSearchSource, useYoutubeSearch } from '../useYoutubeSearch';

jest.mock('axios', () => ({
  post: jest.fn(),
  isCancel: jest.fn(() => false),
}));

const axios = require('axios');

interface Item {
  id: string;
  name: string;
}

const onResults = jest.fn();
const SOURCE: YoutubeSearchSource<Item> = {
  url: '/api/things/search',
  decode: (item) => ({ ...item, name: item.name.toUpperCase() }),
  onResults,
};

describe('useYoutubeSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('posts the query to the source and shows its decoded results', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [{ id: 'a', name: 'alpha' }] } });
    const { result } = renderHook(() => useYoutubeSearch('token', SOURCE));

    await act(async () => { await result.current.search('alpha', 25); });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/things/search',
      { query: 'alpha', count: 25 },
      expect.objectContaining({ headers: { 'x-access-token': 'token' } })
    );
    expect(result.current.results).toEqual([{ id: 'a', name: 'ALPHA' }]);
    expect(onResults).toHaveBeenCalledWith('alpha', 25, [{ id: 'a', name: 'ALPHA' }]);
  });

  test('shows the results it was given until the first search', () => {
    const { result } = renderHook(() => useYoutubeSearch('token', SOURCE, [{ id: 'kept', name: 'Kept' }]));

    expect(result.current.results).toEqual([{ id: 'kept', name: 'Kept' }]);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('reports a failed search', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { error: 'Quota exceeded' } } });
    const { result } = renderHook(() => useYoutubeSearch('token', SOURCE));

    await act(async () => { await result.current.search('alpha', 25); });

    await waitFor(() => expect(result.current.error).toBe('Quota exceeded'));
    expect(result.current.loading).toBe(false);
  });
});
