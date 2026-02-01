'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tighten constraints for title and thumbnail in channelvideos table
    // First, provide default values for any orphans (though there shouldn't be any)
    await queryInterface.sequelize.query(
      "UPDATE channelvideos SET title = 'Unknown Title' WHERE title IS NULL"
    );
    await queryInterface.sequelize.query(
      "UPDATE channelvideos SET thumbnail = '' WHERE thumbnail IS NULL"
    );

    await queryInterface.changeColumn('channelvideos', 'title', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn('channelvideos', 'thumbnail', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('channelvideos', 'title', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.changeColumn('channelvideos', 'thumbnail', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }
};
