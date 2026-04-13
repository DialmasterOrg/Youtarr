import { resolveLibraryDisplay, PlexLibrary } from '../plexLibraries';

describe('resolveLibraryDisplay', () => {
  const LIBRARIES: PlexLibrary[] = [
    { id: '1', title: 'YouTube' },
    { id: '31', title: 'Adults Library' },
    { id: '42', title: 'Kids Shows' },
  ];

  test('returns "resolved" with title and id when the id matches an entry', () => {
    expect(resolveLibraryDisplay(LIBRARIES, '31')).toEqual({
      kind: 'resolved',
      title: 'Adults Library',
      id: '31',
    });
  });

  test('returns "id-fallback" when the libraries list is empty', () => {
    expect(resolveLibraryDisplay([], '31')).toEqual({
      kind: 'id-fallback',
      id: '31',
    });
  });

  test('returns "id-only" when the libraries list is populated but no entry matches', () => {
    expect(resolveLibraryDisplay(LIBRARIES, '999')).toEqual({
      kind: 'id-only',
      id: '999',
    });
  });

  test('handles alphanumeric library ids in the "resolved" path', () => {
    const libs: PlexLibrary[] = [{ id: 'my-lib-99', title: 'My Lib' }];
    expect(resolveLibraryDisplay(libs, 'my-lib-99')).toEqual({
      kind: 'resolved',
      title: 'My Lib',
      id: 'my-lib-99',
    });
  });
});
