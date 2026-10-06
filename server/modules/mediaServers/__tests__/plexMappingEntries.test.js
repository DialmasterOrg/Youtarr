const {
  readMappings, findEntry, mappingOf, withEntry, withoutEntry,
} = require('../plexMappingEntries');

describe('plexMappingEntries', () => {
  const mappings = [
    { subfolder: 'Kids', libraryId: '38' },
    { subfolder: null, libraryId: '37' },
    { subfolder: 'Archive', libraryId: null },
  ];

  test('readMappings skips entries that are not objects', () => {
    expect(readMappings({ plexSubfolderLibraryMappings: [null, 'x', 3, { subfolder: 'A', libraryId: '1' }] }))
      .toEqual([{ subfolder: 'A', libraryId: '1' }]);
    expect(readMappings({})).toEqual([]);
  });

  test('finds a folder ignoring case, and the main folder by a null subfolder', () => {
    expect(findEntry(mappings, 'KIDS')).toEqual({ subfolder: 'Kids', libraryId: '38' });
    expect(findEntry(mappings, '')).toEqual({ subfolder: null, libraryId: '37' });
    expect(findEntry(mappings, 'Music')).toBeNull();
  });

  test('reports a library choice, an explicit default choice, or none', () => {
    expect(mappingOf(mappings, 'kids')).toEqual({ choice: 'library', libraryId: '38' });
    expect(mappingOf(mappings, 'Archive')).toEqual({ choice: 'default', libraryId: null });
    expect(mappingOf(mappings, 'Music')).toEqual({ choice: 'none', libraryId: null });
  });

  test('treats an empty library id as the default choice', () => {
    expect(mappingOf([{ subfolder: 'A', libraryId: '' }], 'A')).toEqual({ choice: 'default', libraryId: null });
  });

  test('withEntry replaces the folder entry in place and keeps the others', () => {
    expect(withEntry(mappings, 'kids', '41')).toEqual([
      { subfolder: 'kids', libraryId: '41' },
      { subfolder: null, libraryId: '37' },
      { subfolder: 'Archive', libraryId: null },
    ]);
  });

  test('withEntry appends a new entry, storing the main folder as null', () => {
    expect(withEntry([], '', null)).toEqual([{ subfolder: null, libraryId: null }]);
    expect(withEntry([], 'TV', '41')).toEqual([{ subfolder: 'TV', libraryId: '41' }]);
  });

  test('withoutEntry removes every entry of the folder', () => {
    expect(withoutEntry([...mappings, { subfolder: 'kids', libraryId: '2' }], 'Kids')).toEqual([
      { subfolder: null, libraryId: '37' },
      { subfolder: 'Archive', libraryId: null },
    ]);
  });
});
