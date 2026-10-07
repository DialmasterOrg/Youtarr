import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useSelectedFolder } from '../useSelectedFolder';
import type { LibraryFolder } from '../../../../types/tvShows';

const folders: LibraryFolder[] = [
  { name: '', layout: 'videos', isDefault: false, hasFiles: false, channels: 0 },
  { name: 'Kids', layout: 'videos', isDefault: true, hasFiles: false, channels: 2 },
];
let location: ReturnType<typeof useLocation>;
function Spy() { location = useLocation(); return null; }

const wrapperAt = (entry: string | { pathname: string; state?: unknown }) => function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/settings/library/*" element={<>{children}<Spy /></>} /></Routes>
    </MemoryRouter>
  );
};

describe('useSelectedFolder', () => {
  test('two columns: the bare URL selects the default folder at once', async () => {
    renderHook(() => useSelectedFolder({ folders, loaded: true, twoColumn: true }), { wrapper: wrapperAt('/settings/library') });
    await waitFor(() => expect(location.pathname).toBe('/settings/library/Kids'));
  });

  test('list/detail: the bare URL selects nothing', () => {
    const { result } = renderHook(() => useSelectedFolder({ folders, loaded: true, twoColumn: false }), { wrapper: wrapperAt('/settings/library') });
    expect(result.current.selected).toBeNull();
    expect(location.pathname).toBe('/settings/library');
  });

  test('matches the URL ignoring case and resolves the main folder key', () => {
    const { result } = renderHook(() => useSelectedFolder({ folders, loaded: true, twoColumn: true }), { wrapper: wrapperAt('/settings/library/kids') });
    expect(result.current.selected?.name).toBe('Kids');
    const view = renderHook(() => useSelectedFolder({ folders, loaded: true, twoColumn: true }), { wrapper: wrapperAt('/settings/library/~main') });
    expect(view.result.current.selected?.name).toBe('');
  });

  test('an unknown folder goes back to the list with a notice', async () => {
    const { result } = renderHook(() => useSelectedFolder({ folders, loaded: true, twoColumn: false }), { wrapper: wrapperAt('/settings/library/Gone') });
    await waitFor(() => expect(location.pathname).toBe('/settings/library'));
    expect(result.current.missingName).toBe('Gone');
  });

  test('waits for the folder list before deciding a folder is unknown', () => {
    renderHook(() => useSelectedFolder({ folders: [], loaded: false, twoColumn: true }), { wrapper: wrapperAt('/settings/library/Kids') });
    expect(location.pathname).toBe('/settings/library/Kids');
  });

  test('a folder selected while the list refetches is not reported missing', async () => {
    const { result, rerender } = renderHook(
      ({ list, loading }: { list: LibraryFolder[]; loading: boolean }) => useSelectedFolder({ folders: list, loaded: true, loading, twoColumn: true }),
      { wrapper: wrapperAt('/settings/library/Kids'), initialProps: { list: folders, loading: true } }
    );
    act(() => { result.current.select('Science'); });
    expect(location.pathname).toBe('/settings/library/Science');
    rerender({ list: [...folders, { name: 'Science', layout: 'tv', isDefault: false, hasFiles: false, channels: 0 }], loading: false });
    await waitFor(() => expect(result.current.selected?.name).toBe('Science'));
    expect(result.current.missingName).toBeNull();
    expect(location.pathname).toBe('/settings/library/Science');
  });

  test('after a failed load a deep link is not reported missing', () => {
    const { result } = renderHook(() => useSelectedFolder({ folders: [], loaded: true, error: 'Failed to load', twoColumn: true }), { wrapper: wrapperAt('/settings/library/Kids') });
    expect(result.current.missingName).toBeNull();
    expect(location.pathname).toBe('/settings/library/Kids');
  });
});
