"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Videos", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      youtubeId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      youTubeChannelName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      youTubeVideoName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Videos");
  },
};
