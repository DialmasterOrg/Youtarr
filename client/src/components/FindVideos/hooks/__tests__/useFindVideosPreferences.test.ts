import { act, renderHook } from '@testing-library/react';
import { useFindVideosPreferences } from '../useFindVideosPreferences';

describe('useFindVideosPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('defaults to the table view, relevance order, and no minimum duration', () => {
    const { result } = renderHook(() => useFindVideosPreferences());
    expect(result.current.viewMode).toBe('table');
    expect(result.current.sort).toEqual({ key: 'relevance', direction: 'desc' });
    expect(result.current.minDuration).toBe(0);
  });

  test('restores stored choices', () => {
    window.localStorage.setItem('findVideos.viewMode', 'grid');
    window.localStorage.setItem('findVideos.sort', JSON.stringify({ key: 'views', direction: 'asc' }));
    window.localStorage.setItem('findVideos.minDuration', '300');
    const { result } = renderHook(() => useFindVideosPreferences());
    expect(result.current.viewMode).toBe('grid');
    expect(result.current.sort).toEqual({ key: 'views', direction: 'asc' });
    expect(result.current.minDuration).toBe(300);
  });

  test('falls back to defaults for values it does not recognise', () => {
    window.localStorage.setItem('findVideos.viewMode', 'carousel');
    window.localStorage.setItem('findVideos.sort', '{"key":"colour","direction":"up"}');
    window.localStorage.setItem('findVideos.minDuration', '42');
    const { result } = renderHook(() => useFindVideosPreferences());
    expect(result.current.viewMode).toBe('table');
    expect(result.current.sort).toEqual({ key: 'relevance', direction: 'desc' });
    expect(result.current.minDuration).toBe(0);
  });

  test('persists each change', () => {
    const { result } = renderHook(() => useFindVideosPreferences());
    act(() => {
      result.current.setViewMode('grid');
      result.current.setSort({ key: 'published', direction: 'desc' });
      result.current.setMinDuration(600);
    });
    expect(window.localStorage.getItem('findVideos.viewMode')).toBe('grid');
    expect(JSON.parse(window.localStorage.getItem('findVideos.sort') ?? '')).toEqual({ key: 'published', direction: 'desc' });
    expect(window.localStorage.getItem('findVideos.minDuration')).toBe('600');
  });
});
