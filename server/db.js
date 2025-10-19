const { Sequelize } = require('sequelize');
const logger = require('./logger');

// Configure SQL query logging based on LOG_SQL environment variable
const sqlLogging = process.env.LOG_SQL === 'true'
  ? (sql, timing) => logger.debug({ sql, timing }, 'SQL query')
  : false;

const sequelize = new Sequelize(
  process.env.DB_NAME || 'youtarr',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '123qweasd',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3321,
    logging: sqlLogging,
    pool: {
      max: 10, // Maximum number of connection in pool
      min: 0,  // Minimum number of connection in pool
      acquire: 30000, // Maximum time, in milliseconds, that pool will try to get connection before throwing error
      idle: 10000 // Maximum time, in milliseconds, that a connection can be idle before being released
    },
    retry: {
      max: 3 // Maximum number of retries for a query
    },
    // Ensure utf8mb4 for new connections
    dialectOptions: {
      charset: 'utf8mb4',
      // Additional connection options for better utf8mb4 support
      supportBigNumbers: true,
      bigNumberStrings: true
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      // Ensure all new tables use utf8mb4 by default
      dialectOptions: {
        charset: 'utf8mb4',
      }
    }
  }
);

const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Ensure connection uses utf8mb4
    await sequelize.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');

    // Run migrations
    const Umzug = require('umzug');
    const path = require('path');

    const migrator = new Umzug({
      migrations: {
        path: path.join(__dirname, '../migrations'),
        params: [sequelize.getQueryInterface(), Sequelize],
      },
      storage: 'sequelize',
      storageOptions: {
        sequelize: sequelize,
      },
    });

    await migrator.up();
    
    // Load models after migrations
    const models = require('./models');
    
    // Attach models to db object for easy access
    Object.keys(models).forEach(modelName => {
      module.exports[modelName] = models[modelName];
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize database');
    throw error;
  }
};

module.exports = {
  initializeDatabase,
  sequelize,
  Sequelize,
};
