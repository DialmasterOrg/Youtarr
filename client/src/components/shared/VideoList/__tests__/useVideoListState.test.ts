import { act, renderHook } from '@testing-library/react';
import { useVideoListState } from '../hooks/useVideoListState';

describe('useVideoListState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('initial view mode comes from options when nothing stored', () => {
    const { result } = renderHook(() =>
      useVideoListState({ initialViewMode: 'grid', viewModeStorageKey: 'test:vm' })
    );
    expect(result.current.viewMode).toBe('grid');
  });

  test('reads stored view mode on mount', () => {
    window.localStorage.setItem('test:vm', 'table');
    const { result } = renderHook(() =>
      useVideoListState({ initialViewMode: 'grid', viewModeStorageKey: 'test:vm' })
    );
    expect(result.current.viewMode).toBe('table');
  });

  test('setViewMode persists to storage', () => {
    const { result } = renderHook(() =>
      useVideoListState({ initialViewMode: 'grid', viewModeStorageKey: 'test:vm' })
    );
    act(() => result.current.setViewMode('list'));
    expect(result.current.viewMode).toBe('list');
    expect(window.localStorage.getItem('test:vm')).toBe('list');
  });

  test('setSearchInput updates immediately and commits search after debounce', () => {
    const { result } = renderHook(() =>
      useVideoListState({ initialViewMode: 'grid', searchDebounceMs: 100 })
    );
    expect(result.current.search).toBe('');

    act(() => result.current.setSearchInput('hello'));
    expect(result.current.searchInput).toBe('hello');
    expect(result.current.search).toBe('');

    act(() => {
      jest.advanceTimersByTime(110);
    });
    expect(result.current.search).toBe('hello');
  });

  test('clearSearch resets both input and committed search', () => {
    const { result } = renderHook(() =>
      useVideoListState({ initialViewMode: 'grid', searchDebounceMs: 100 })
    );
    act(() => result.current.setSearchInput('hello'));
    act(() => {
      jest.advanceTimersByTime(110);
    });

    act(() => result.current.clearSearch());
    expect(result.current.searchInput).toBe('');
    expect(result.current.search).toBe('');
  });

  test('filter panel and mobile drawer have independent state', () => {
    const { result } = renderHook(() => useVideoListState({ initialViewMode: 'grid' }));
    act(() => result.current.setFilterPanelOpen(true));
    expect(result.current.filterPanelOpen).toBe(true);
    expect(result.current.mobileFilterDrawerOpen).toBe(false);

    act(() => result.current.setMobileFilterDrawerOpen(true));
    expect(result.current.mobileFilterDrawerOpen).toBe(true);
  });
});
