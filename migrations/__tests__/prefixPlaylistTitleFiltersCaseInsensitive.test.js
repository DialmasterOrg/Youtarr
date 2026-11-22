'use strict';

const migration = require('../20261122180135-prefix-playlist-title-filters-case-insensitive');

// Stands in for the playlists table: SELECT returns the rows with a pattern,
// UPDATE writes the bound pattern back to the row with the bound id.
function playlistsTable(rows) {
  const updates = [];
  const query = jest.fn(async (sql, options = {}) => {
    if (/^\s*SELECT/i.test(sql)) return rows.filter((row) => row.title_filter_regex !== null).map((row) => ({ ...row }));
    const { id, pattern } = options.replacements;
    rows.find((row) => row.id === id).title_filter_regex = pattern;
    updates.push(id);
    return [];
  });
  return { rows, updates, queryInterface: { sequelize: { query } } };
}

const patternsAfterUpgrade = async (patterns) => {
  const table = playlistsTable(patterns.map((title_filter_regex, index) => ({ id: index + 1, title_filter_regex })));
  await migration.up(table.queryInterface);
  return table.rows.map((row) => row.title_filter_regex);
};

describe('prefix playlist title filters case insensitive migration', () => {
  test('keeps an existing pattern matching without regard to case', async () => {
    expect(await patternsAfterUpgrade(['review'])).toEqual(['(?i)review']);
  });

  test('leaves a pattern that already sets the flag alone', async () => {
    expect(await patternsAfterUpgrade(['(?i)review'])).toEqual(['(?i)review']);
  });

  test.each([[null], [''], ['   ']])('leaves an unset pattern %j alone', async (pattern) => {
    expect(await patternsAfterUpgrade([pattern])).toEqual([pattern]);
  });

  test('writes only the rows it changes', async () => {
    const table = playlistsTable([
      { id: 1, title_filter_regex: 'review' },
      { id: 2, title_filter_regex: '(?i)already' },
      { id: 3, title_filter_regex: null },
    ]);
    await migration.up(table.queryInterface);
    expect(table.updates).toEqual([1]);
  });

  test('binds the pattern instead of interpolating it into SQL', async () => {
    const table = playlistsTable([{ id: 1, title_filter_regex: 'it\'s; DROP TABLE playlists' }]);
    await migration.up(table.queryInterface);
    const sqlStatements = table.queryInterface.sequelize.query.mock.calls.map(([sql]) => sql);
    expect(sqlStatements.some((sql) => sql.includes('DROP TABLE'))).toBe(false);
  });

  // The matcher being rolled back to compiles JavaScript and always ignores
  // case, so it rejects the flag and never needed it.
  describe('rollback', () => {
    const patternsAfterRollback = async (patterns) => {
      const table = playlistsTable(patterns.map((title_filter_regex, index) => ({ id: index + 1, title_filter_regex })));
      await migration.down(table.queryInterface);
      return table.rows.map((row) => row.title_filter_regex);
    };

    test('removes the flag the upgrade added', async () => {
      expect(await patternsAfterRollback(['(?i)review'])).toEqual(['review']);
    });

    test('leaves a pattern without the flag alone', async () => {
      expect(await patternsAfterRollback(['review', null])).toEqual(['review', null]);
    });

    test('restores what an upgrade changed', async () => {
      const table = playlistsTable([{ id: 1, title_filter_regex: 'Episode \\d+' }]);
      await migration.up(table.queryInterface);
      await migration.down(table.queryInterface);
      expect(table.rows[0].title_filter_regex).toBe('Episode \\d+');
    });
  });
});
