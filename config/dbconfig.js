// Database configuration for Sequelize CLI
// Reads from environment variables with sensible defaults
// This allows migration scripts to use the same DB config as docker-compose

require('dotenv').config();

const config = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123qweasd',
  database: process.env.DB_NAME || 'youtarr',
  host: process.env.DB_HOST || '127.0.0.1',
  dialect: 'mysql',
  port: parseInt(process.env.DB_PORT || '3321', 10),
  dialectOptions: {
    charset: 'utf8mb4',
    supportBigNumbers: true,
    bigNumberStrings: true
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  }
};

module.exports = {
  development: config,
  test: config,
  production: config
};
