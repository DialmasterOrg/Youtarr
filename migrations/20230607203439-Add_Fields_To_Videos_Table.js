'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Videos', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: true, // Change to 'false' if the field should be required
    });

    await queryInterface.addColumn('Videos', 'originalDate', {
      type: Sequelize.STRING,
      allowNull: true, // Change to 'false' if the field should be required
    });

    await queryInterface.addColumn('Videos', 'description', {
      type: Sequelize.TEXT,
      allowNull: true, // Change to 'false' if the field should be required
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Videos', 'duration');
    await queryInterface.removeColumn('Videos', 'originalDate');
    await queryInterface.removeColumn('Videos', 'description');
  },
};
