'use strict';

const { addIndexIfMissing, removeIndexIfExists, tableExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'Videos'))) {
      return;
    }

    // Step 1: Remap JobVideos to point to survivor Videos (highest id) for each youtubeId
    // This prevents FK constraint violations when deleting duplicates
    await queryInterface.sequelize.query(`
      UPDATE JobVideos jv
      INNER JOIN Videos v_old ON jv.video_id = v_old.id
      INNER JOIN (
        SELECT youtubeId, MAX(id) as survivor_id
        FROM Videos
        GROUP BY youtubeId
        HAVING COUNT(*) > 1
      ) survivors ON v_old.youtubeId = survivors.youtubeId
      SET jv.video_id = survivors.survivor_id
      WHERE jv.video_id != survivors.survivor_id
    `);

    // Step 2: Remove duplicate youtubeId entries from Videos
    // Keep the most recent entry (highest id) for each youtubeId
    await queryInterface.sequelize.query(`
      DELETE v1 FROM Videos v1
      INNER JOIN Videos v2
      WHERE v1.youtubeId = v2.youtubeId
      AND v1.id < v2.id
    `);

    // Step 3: Add unique constraint on youtubeId
    await addIndexIfMissing(queryInterface, 'Videos', ['youtubeId'], {
      unique: true,
      name: 'videos_youtubeid_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the unique constraint
    await removeIndexIfExists(queryInterface, 'Videos', 'videos_youtubeid_unique');
  }
};
