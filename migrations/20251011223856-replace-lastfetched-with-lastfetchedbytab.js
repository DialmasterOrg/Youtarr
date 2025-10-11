'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // 1. Add new column first (before dropping old one to preserve data)
    await queryInterface.addColumn('channels', 'lastFetchedByTab', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });

    // 2. Migrate existing lastFetched data to lastFetchedByTab as {"video": "timestamp"}
    // This preserves the existing refresh timestamps so channels don't all re-fetch on upgrade
    await queryInterface.sequelize.query(`
      UPDATE channels
      SET lastFetchedByTab = CONCAT('{"video":"', DATE_FORMAT(lastFetched, '%Y-%m-%dT%H:%i:%s.000Z'), '"}')
      WHERE lastFetched IS NOT NULL
    `);

    // 3. Now safe to drop the old column
    await queryInterface.removeColumn('channels', 'lastFetched');
  },

  async down (queryInterface, Sequelize) {
    // 1. Add back the old column first
    await queryInterface.addColumn('channels', 'lastFetched', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // 2. Migrate lastFetchedByTab data back to lastFetched (use 'video' tab timestamp)
    // Extract the "video" timestamp from JSON if it exists
    await queryInterface.sequelize.query(`
      UPDATE channels
      SET lastFetched = STR_TO_DATE(
        JSON_UNQUOTE(JSON_EXTRACT(lastFetchedByTab, '$.video')),
        '%Y-%m-%dT%H:%i:%s.000Z'
      )
      WHERE lastFetchedByTab IS NOT NULL
        AND JSON_EXTRACT(lastFetchedByTab, '$.video') IS NOT NULL
    `);

    // 3. Remove the new per-tab column
    await queryInterface.removeColumn('channels', 'lastFetchedByTab');
  }
};
