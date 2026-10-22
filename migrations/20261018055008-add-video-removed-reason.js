'use strict';

const {
  addColumnIfMissing,
  removeColumnIfExists,
  addIndexIfMissing,
  removeIndexIfExists
} = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Why a removed row has no file: 'user_deleted' (deleted in the app),
    // 'auto_removal' (automatic cleanup, with the rule in removed_detail),
    // 'not_found' (expected on disk, not there), or 'marked_deleted' (the
    // user marked a missing video as deleted). NULL on a removed row means
    // it was removed before the reason was recorded; it is shown as deleted.
    await addColumnIfMissing(queryInterface, 'videos', 'removed_reason', {
      type: Sequelize.STRING(32),
      allowNull: true,
      defaultValue: null
    });
    await addColumnIfMissing(queryInterface, 'videos', 'removed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
    await addColumnIfMissing(queryInterface, 'videos', 'removed_detail', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null
    });
    await addIndexIfMissing(queryInterface, 'videos', ['removed', 'removed_reason']);
  },

  async down (queryInterface) {
    await removeIndexIfExists(queryInterface, 'videos', ['removed', 'removed_reason']);
    await removeColumnIfExists(queryInterface, 'videos', 'removed_detail');
    await removeColumnIfExists(queryInterface, 'videos', 'removed_at');
    await removeColumnIfExists(queryInterface, 'videos', 'removed_reason');
  }
};
