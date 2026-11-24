'use strict';

const { QueryTypes } = require('sequelize');

// Playlist title filters used to be JavaScript regexes matched without regard
// to case. They are now Python regexes, case sensitive like channel title
// filters, so a pattern saved before this change gets Python's inline flag to
// keep matching the titles it matched before.
const CASE_INSENSITIVE_FLAG = '(?i)';

const SELECT_PATTERNS = 'SELECT id, title_filter_regex FROM playlists WHERE title_filter_regex IS NOT NULL';
const UPDATE_PATTERN = 'UPDATE playlists SET title_filter_regex = :pattern WHERE id = :id';

async function rewritePatterns(queryInterface, rewrite) {
  const rows = await queryInterface.sequelize.query(SELECT_PATTERNS, { type: QueryTypes.SELECT });
  for (const row of rows) {
    const pattern = rewrite(row.title_filter_regex);
    if (pattern === row.title_filter_regex) continue;
    await queryInterface.sequelize.query(UPDATE_PATTERN, { replacements: { id: row.id, pattern } });
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await rewritePatterns(queryInterface, (pattern) => (
      !pattern.trim() || pattern.startsWith(CASE_INSENSITIVE_FLAG) ? pattern : `${CASE_INSENSITIVE_FLAG}${pattern}`
    ));
  },

  // The JavaScript matcher this rolls back to cannot compile the flag and
  // always ignored case, so removing it is right even from a pattern where the
  // user typed it.
  async down(queryInterface) {
    await rewritePatterns(queryInterface, (pattern) => (
      pattern.startsWith(CASE_INSENSITIVE_FLAG) ? pattern.slice(CASE_INSENSITIVE_FLAG.length) : pattern
    ));
  },
};
