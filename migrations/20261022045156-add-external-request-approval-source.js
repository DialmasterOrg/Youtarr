'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Who approved a request: 'auto' (the key's auto-approval setting at
    // create time) or 'admin' (a review decision). The request executor
    // re-checks auto-approval only for 'auto' rows, so turning a key's
    // auto-approval off stops requests it approved but has not yet run.
    await addColumnIfMissing(queryInterface, 'external_requests', 'approval_source', {
      type: Sequelize.STRING(10),
      allowNull: true,
      defaultValue: null
    });
  },

  async down (queryInterface) {
    await removeColumnIfExists(queryInterface, 'external_requests', 'approval_source');
  }
};
