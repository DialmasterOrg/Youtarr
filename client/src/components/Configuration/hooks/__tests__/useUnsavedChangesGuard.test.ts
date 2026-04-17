import { renderHook, act } from '@testing-library/react';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  let originalPushState: typeof window.history.pushState;
  let originalReplaceState: typeof window.history.replaceState;

  beforeEach(() => {
    originalPushState = window.history.pushState;
    originalReplaceState = window.history.replaceState;
    window.history.replaceState(null, '', '/settings/core');
  });

  afterEach(() => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
  });

  test('lets pushState pass through when enabled is false', () => {
    renderHook(() =>
      useUnsavedChangesGuard({
        enabled: false,
        shouldBlock: () => true,
      })
    );

    act(() => {
      window.history.pushState(null, '', '/channels');
    });

    expect(window.location.pathname).toBe('/channels');
  });

  test('blocks pushState and exposes pendingNav when shouldBlock returns true', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: (url) => !url.startsWith('/settings'),
      })
    );

    act(() => {
      window.history.pushState(null, '', '/channels');
    });

    expect(window.location.pathname).toBe('/settings/core');
    expect(result.current.pendingNav).toBe('/channels');
  });

  test('lets pushState pass through when shouldBlock returns false', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: (url) => !url.startsWith('/settings'),
      })
    );

    act(() => {
      window.history.pushState(null, '', '/settings/plex');
    });

    expect(window.location.pathname).toBe('/settings/plex');
    expect(result.current.pendingNav).toBeNull();
  });

  test('confirmNav performs the pending navigation and clears pendingNav', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: () => true,
      })
    );

    act(() => {
      window.history.pushState(null, '', '/channels');
    });
    expect(result.current.pendingNav).toBe('/channels');
    expect(window.location.pathname).toBe('/settings/core');

    act(() => {
      result.current.confirmNav();
    });

    expect(window.location.pathname).toBe('/channels');
    expect(result.current.pendingNav).toBeNull();
  });

  test('confirmNav dispatches popstate so the router re-renders', () => {
    const popstateHandler = jest.fn();
    window.addEventListener('popstate', popstateHandler);

    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: () => true,
      })
    );

    act(() => {
      window.history.pushState(null, '', '/channels');
    });
    act(() => {
      result.current.confirmNav();
    });

    expect(popstateHandler).toHaveBeenCalled();
    window.removeEventListener('popstate', popstateHandler);
  });

  test('cancelNav clears pendingNav and leaves URL unchanged', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: () => true,
      })
    );

    act(() => {
      window.history.pushState(null, '', '/channels');
    });
    expect(result.current.pendingNav).toBe('/channels');

    act(() => {
      result.current.cancelNav();
    });

    expect(result.current.pendingNav).toBeNull();
    expect(window.location.pathname).toBe('/settings/core');
  });

  test('restores original history methods on unmount', () => {
    const { unmount } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: () => true,
      })
    );

    expect(window.history.pushState).not.toBe(originalPushState);

    unmount();

    expect(window.history.pushState).toBe(originalPushState);
    expect(window.history.replaceState).toBe(originalReplaceState);
  });

  test('registers beforeunload listener while enabled and removes it when disabled', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useUnsavedChangesGuard({
          enabled,
          shouldBlock: () => true,
        }),
      { initialProps: { enabled: true } }
    );

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    rerender({ enabled: false });

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  test('beforeunload handler sets returnValue to trigger native warning', () => {
    renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: () => true,
      })
    );

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, 'returnValue', { writable: true, value: '' });
    window.dispatchEvent(event);

    expect(event.returnValue).toBe('');
    expect(event.defaultPrevented).toBe(true);
  });

  test('intercepts replaceState the same way as pushState', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        enabled: true,
        shouldBlock: (url) => !url.startsWith('/settings'),
      })
    );

    act(() => {
      window.history.replaceState(null, '', '/videos');
    });

    expect(window.location.pathname).toBe('/settings/core');
    expect(result.current.pendingNav).toBe('/videos');
  });
});
