"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("JobVideos", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "Jobs",
          key: "id",
        },
        onUpdate: "CASCADE",
      },
      video_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Videos",
          key: "id",
        },
        onUpdate: "CASCADE",
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("JobVideos");
  },
};
