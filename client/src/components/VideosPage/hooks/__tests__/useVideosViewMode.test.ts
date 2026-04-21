import { renderHook, act } from '@testing-library/react';
import { useVideosViewMode } from '../useVideosViewMode';

describe('useVideosViewMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('defaults to grid on desktop when nothing is stored', () => {
    const { result } = renderHook(() => useVideosViewMode(false));
    expect(result.current[0]).toBe('grid');
  });

  test('defaults to table on mobile when nothing is stored', () => {
    const { result } = renderHook(() => useVideosViewMode(true));
    expect(result.current[0]).toBe('table');
  });

  test('reads a valid stored value from localStorage', () => {
    window.localStorage.setItem('youtarr:videosPageViewMode', 'table');
    const { result } = renderHook(() => useVideosViewMode(false));
    expect(result.current[0]).toBe('table');
  });

  test('ignores an invalid stored value and falls back to viewport default', () => {
    window.localStorage.setItem('youtarr:videosPageViewMode', 'bogus');
    const { result } = renderHook(() => useVideosViewMode(false));
    expect(result.current[0]).toBe('grid');
  });

  test('setViewMode persists to localStorage', () => {
    const { result } = renderHook(() => useVideosViewMode(false));
    act(() => {
      result.current[1]('table');
    });
    expect(result.current[0]).toBe('table');
    expect(window.localStorage.getItem('youtarr:videosPageViewMode')).toBe('table');
  });
});
