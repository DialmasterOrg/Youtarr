'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // JSON snapshot of job.data minus the videos array (failedVideos,
    // diagnoses, cumulativeSkipped, terminatedChannels, ...). Videos are
    // persisted relationally via jobvideos; everything else previously
    // lived only in process memory and was lost on restart.
    await addColumnIfMissing(queryInterface, 'Jobs', 'aux_data', {
      type: Sequelize.TEXT('medium'),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'Jobs', 'aux_data');
  }
};
