'use strict';

const {
  createTableIfNotExists,
  dropTableIfExists,
  addIndexIfMissing
} = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'JobVideoDownloads', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      youtube_id: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      file_path: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('in_progress', 'completed'),
        allowNull: false,
        defaultValue: 'in_progress'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add index on job_id for faster queries
    await addIndexIfMissing(queryInterface, 'JobVideoDownloads', ['job_id']);

    // Add index on status for faster cleanup queries
    await addIndexIfMissing(queryInterface, 'JobVideoDownloads', ['status']);

    // Ensure each job/video pair is unique
    await addIndexIfMissing(
      queryInterface,
      'JobVideoDownloads',
      ['job_id', 'youtube_id'],
      {
        unique: true,
        name: 'jobvideodownloads_job_video_unique'
      }
    );
  },

  async down (queryInterface, Sequelize) {
    await dropTableIfExists(queryInterface, 'JobVideoDownloads');
  }
};
