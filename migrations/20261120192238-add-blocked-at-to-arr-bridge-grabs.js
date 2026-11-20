'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // When YouTube first blocked this grab's download. Set while the grab
    // waits to be tried again; NULL for a grab that was never blocked.
    await addColumnIfMissing(queryInterface, 'arr_bridge_grabs', 'blocked_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'arr_bridge_grabs', 'blocked_at');
  },
};
