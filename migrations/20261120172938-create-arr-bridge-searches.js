'use strict';

const { createTableIfNotExists, addIndexIfMissing, dropTableIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // One row per search Sonarr or Radarr sent through the bridge, for the
    // Settings page. It holds request fields, search results and release
    // names only: never the origin, a feed link or a key.
    await createTableIfNotExists(queryInterface, 'arr_bridge_searches', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      // When the request arrived; for the no-query row, the latest one.
      at: { type: Sequelize.DATE, allowNull: false },
      first_at: { type: Sequelize.DATE, allowNull: false },
      // Above 1 only for the no-query feed, whose requests share one row per kind.
      count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      // tv | movie
      kind: { type: Sequelize.STRING(10), allowNull: true },
      // episode | season | daily | movie | rss | empty
      shape: { type: Sequelize.STRING(20), allowNull: false },
      // offered | nothing | not-searched | failed
      outcome: { type: Sequelize.STRING(20), allowNull: false },
      offered: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      note: { type: Sequelize.STRING(40), allowNull: true },
      title_stage_skipped: { type: Sequelize.STRING(40), allowNull: true },
      // What the list's search box matches: the name asked for, with its episode, date or year.
      search_text: { type: Sequelize.STRING(255), allowNull: true },
      // JSON as text, not a JSON column: the same on MariaDB and MySQL.
      asked: { type: Sequelize.TEXT, allowNull: false },
      stages: { type: Sequelize.TEXT('medium'), allowNull: false },
    }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });

    await addIndexIfMissing(queryInterface, 'arr_bridge_searches', ['at'], {
      name: 'arr_bridge_searches_at_idx',
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'arr_bridge_searches');
  },
};
