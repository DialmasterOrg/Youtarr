import { act, renderHook } from '@testing-library/react';
import { useGuideOpen } from '../useGuideOpen';

describe('useGuideOpen', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  test('follows the default until toggled, then remembers the choice', () => {
    const { result } = renderHook(() => useGuideOpen(true));
    expect(result.current[0]).toBe(true);
    act(() => { result.current[1](); });
    expect(result.current[0]).toBe(false);
    expect(renderHook(() => useGuideOpen(true)).result.current[0]).toBe(false);
  });

  test('decides the default once it is known, and keeps it', () => {
    const { result, rerender } = renderHook(({ fallback }: { fallback: boolean | null }) => useGuideOpen(fallback), {
      initialProps: { fallback: null as boolean | null },
    });
    expect(result.current[0]).toBe(false);
    rerender({ fallback: true });
    expect(result.current[0]).toBe(true);
    rerender({ fallback: false });
    expect(result.current[0]).toBe(true);
  });

  test('works when storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(renderHook(() => useGuideOpen(false)).result.current[0]).toBe(false);
  });
});
