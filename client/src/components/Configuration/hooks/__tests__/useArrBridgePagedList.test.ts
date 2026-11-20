import { act, renderHook, waitFor } from '@testing-library/react';
import { ARR_LIST_PAGE_SIZE, useArrBridgePagedList } from '../useArrBridgePagedList';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

interface Row {
  id: string;
}

const SOURCE = { url: '/api/arr-bridge/things', itemsKey: 'things', errorMessage: 'Could not load the things.' };
const HEADERS = { 'x-access-token': 'session' };
const rows = (count: number): Row[] => Array.from({ length: count }, (_, index) => ({ id: `row-${index}` }));
const answer = (things: Row[], total = things.length) => ({ data: { things, total, page: 1, pageSize: ARR_LIST_PAGE_SIZE } });

const useList = (token: string | null = 'session', enabled = true) => useArrBridgePagedList<Row>(SOURCE, token, enabled);
const paramsOfCall = (index: number) => axios.get.mock.calls[index][1].params;

describe('useArrBridgePagedList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue(answer(rows(2), 2));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('loads the first page with the session token', async () => {
    const { result } = renderHook(() => useList());

    await waitFor(() => expect(result.current.items).toEqual(rows(2)));

    expect(axios.get).toHaveBeenCalledWith('/api/arr-bridge/things', {
      headers: HEADERS,
      params: { page: 1, pageSize: ARR_LIST_PAGE_SIZE },
    });
    expect(result.current).toMatchObject({ total: 2, page: 1, pageSize: ARR_LIST_PAGE_SIZE, loading: false, error: null });
  });

  test('does not load while it is switched off or without a session', () => {
    renderHook(() => useList('session', false));
    renderHook(() => useList(null, true));

    expect(axios.get).not.toHaveBeenCalled();
  });

  test('loads when it is switched on later', async () => {
    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useList('session', enabled), {
      initialProps: { enabled: false },
    });

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
  });

  test('refresh loads the same page again', async () => {
    const { result } = renderHook(() => useList());
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    axios.get.mockResolvedValue(answer(rows(3), 3));

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('setPage loads that page and keeps the total', async () => {
    axios.get.mockResolvedValue(answer(rows(10), 25));
    const { result } = renderHook(() => useList());
    await waitFor(() => expect(result.current.total).toBe(25));

    act(() => result.current.setPage(3));

    await waitFor(() => expect(paramsOfCall(1)).toEqual({ page: 3, pageSize: ARR_LIST_PAGE_SIZE }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(3);
  });

  test('steps back to the last page when the list has shrunk under the page shown', async () => {
    axios.get.mockResolvedValue(answer(rows(10), 30));
    const { result } = renderHook(() => useList());
    await waitFor(() => expect(result.current.total).toBe(30));
    axios.get.mockResolvedValueOnce(answer([], 12)).mockResolvedValue(answer(rows(2), 12));

    act(() => result.current.setPage(3));

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(paramsOfCall(2)).toEqual({ page: 2, pageSize: ARR_LIST_PAGE_SIZE });
  });

  test('reports a list that cannot be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useList());

    await waitFor(() => expect(result.current.error).toBe('Could not load the things.'));
    expect(result.current.items).toEqual([]);
  });

  test('an answer without a list reads as empty', async () => {
    axios.get.mockResolvedValue({ data: {} });

    const { result } = renderHook(() => useList());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ items: [], total: 0 });
  });

  test('ignores an answer that arrives after unmounting', async () => {
    let respond: (value: unknown) => void = () => {};
    axios.get.mockReturnValue(new Promise((resolve) => { respond = resolve; }));
    const { result, unmount } = renderHook(() => useList());

    unmount();
    await act(async () => {
      respond(answer(rows(2)));
    });

    expect(result.current.items).toEqual([]);
  });

  describe('the search text', () => {
    async function loadedOnPage(page: number) {
      axios.get.mockResolvedValue(answer(rows(10), 50));
      const { result, unmount } = renderHook(() => useList());
      await waitFor(() => expect(result.current.total).toBe(50));
      act(() => result.current.setPage(page));
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(result.current.loading).toBe(false));
      jest.useFakeTimers();
      return { result, unmount };
    }

    test('shows what is typed at once and searches once typing pauses, from the first page', async () => {
      const { result } = await loadedOnPage(4);

      act(() => result.current.setQuery('bey'));
      act(() => result.current.setQuery('beyblade '));

      expect(result.current.query).toBe('beyblade ');
      expect(axios.get).toHaveBeenCalledTimes(2);

      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(axios.get).toHaveBeenCalledTimes(3);
      expect(paramsOfCall(2)).toEqual({ page: 1, pageSize: ARR_LIST_PAGE_SIZE, q: 'beyblade' });
      expect(result.current.page).toBe(1);
    });

    test('clearing it lists everything again', async () => {
      const { result } = await loadedOnPage(2);
      act(() => result.current.setQuery('bluey'));
      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      act(() => result.current.setQuery(''));
      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(paramsOfCall(3)).toEqual({ page: 1, pageSize: ARR_LIST_PAGE_SIZE });
    });

    test('typing only spaces does not search or leave the page', async () => {
      const { result } = await loadedOnPage(3);

      act(() => result.current.setQuery('   '));
      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result.current.page).toBe(3);
    });

    test('searches nothing after unmounting', async () => {
      const { result, unmount } = await loadedOnPage(2);
      act(() => result.current.setQuery('bluey'));

      unmount();
      act(() => {
        jest.runOnlyPendingTimers();
      });

      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
});
