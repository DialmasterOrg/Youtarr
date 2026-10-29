import { renderHook, act } from '@testing-library/react';
import { useReorganizeRequest } from '../useReorganizeRequest';

const CHANGE = { type: 'defaultSubfolder' as const, value: 'TV' };

describe('useReorganizeRequest', () => {
  test('starts closed', () => {
    const { result } = renderHook(() => useReorganizeRequest());
    expect(result.current).toMatchObject({ open: false, change: null, operationId: null });
  });

  test('opens on a change to review', () => {
    const { result } = renderHook(() => useReorganizeRequest());
    act(() => result.current.review(CHANGE));
    expect(result.current).toMatchObject({ open: true, change: CHANGE, operationId: null });
  });

  test('opens on an operation to show', () => {
    const { result } = renderHook(() => useReorganizeRequest());
    act(() => result.current.showOperation(4));
    expect(result.current).toMatchObject({ open: true, change: null, operationId: 4 });
  });

  test('closes', () => {
    const { result } = renderHook(() => useReorganizeRequest());
    act(() => result.current.review(CHANGE));
    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });
});
