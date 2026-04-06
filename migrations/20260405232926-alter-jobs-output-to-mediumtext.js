'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Jobs', 'output', {
      type: Sequelize.TEXT('medium'),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Jobs', 'output', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
