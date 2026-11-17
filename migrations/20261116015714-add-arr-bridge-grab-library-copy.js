'use strict';

const { addColumnIfMissing, removeColumnIfExists } = require('./helpers');

module.exports = {
  async up(queryInterface, Sequelize) {
    // What became of the copy in Youtarr's library, for the bridge's "remove
    // after import" setting: 'owned' (Youtarr downloaded the video for this
    // grab), 'remove' (waiting for the import to be confirmed), 'removed' or
    // 'kept'. NULL when the video was in the library before the grab.
    await addColumnIfMissing(queryInterface, 'arr_bridge_grabs', 'library_copy', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await removeColumnIfExists(queryInterface, 'arr_bridge_grabs', 'library_copy');
  },
};
