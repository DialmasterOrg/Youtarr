'use strict';

const {
  createTableIfNotExists,
  dropTableIfExists,
} = require('./helpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await createTableIfNotExists(queryInterface, 'ApiKeys', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      key_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      key_prefix: {
        type: Sequelize.STRING(8),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    });
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'ApiKeys');
  },
};

