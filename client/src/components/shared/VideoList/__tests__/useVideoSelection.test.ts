import { act, renderHook } from '@testing-library/react';
import { useVideoSelection } from '../hooks/useVideoSelection';

describe('useVideoSelection', () => {
  test('starts empty with no selection', () => {
    const { result } = renderHook(() => useVideoSelection<number>());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.hasSelection).toBe(false);
    expect(result.current.count).toBe(0);
  });

  test('toggle adds and removes ids', () => {
    const { result } = renderHook(() => useVideoSelection<number>());

    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([1]);
    expect(result.current.hasSelection).toBe(true);

    act(() => result.current.toggle(2));
    expect(result.current.selectedIds).toEqual([1, 2]);

    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([2]);
  });

  test('isSelected reflects state', () => {
    const { result } = renderHook(() => useVideoSelection<number>());
    act(() => result.current.toggle(7));
    expect(result.current.isSelected(7)).toBe(true);
    expect(result.current.isSelected(8)).toBe(false);
  });

  test('selectAll replaces the selection', () => {
    const { result } = renderHook(() => useVideoSelection<number>());
    act(() => result.current.toggle(1));
    act(() => result.current.selectAll([5, 6, 7]));
    expect(result.current.selectedIds).toEqual([5, 6, 7]);
  });

  test('add merges without duplicates', () => {
    const { result } = renderHook(() => useVideoSelection<number>());
    act(() => result.current.set([1, 2]));
    act(() => result.current.add([2, 3]));
    expect(result.current.selectedIds).toEqual([1, 2, 3]);
  });

  test('clear resets and closes menu', () => {
    const anchor = document.createElement('div');
    const { result } = renderHook(() => useVideoSelection<number>());

    act(() => {
      result.current.toggle(1);
      result.current.openMenu(anchor);
    });
    expect(result.current.menuAnchor).toBe(anchor);

    act(() => result.current.clear());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.menuAnchor).toBeNull();
  });

  test('exposes actions passed in options', () => {
    const onDelete = jest.fn();
    const { result } = renderHook(() =>
      useVideoSelection<number>({
        actions: [{ id: 'delete', label: 'Delete', onClick: onDelete }],
      })
    );
    expect(result.current.actions).toHaveLength(1);
    expect(result.current.actions[0].id).toBe('delete');
  });
});
