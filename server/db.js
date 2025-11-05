const { Sequelize } = require('sequelize');
const logger = require('./logger');
const databaseHealth = require('./modules/databaseHealthModule');

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
  const errors = [];
  let connected = false;
  let schemaValid = false;

  try {
    // Attempt database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    connected = true;

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
    logger.info('Database migrations completed successfully');

    // Load models after migrations
    const models = require('./models');

    // Attach models to db object for easy access
    Object.keys(models).forEach(modelName => {
      module.exports[modelName] = models[modelName];
    });

    // Validate database schema matches models
    logger.info('Starting database schema validation');
    const validation = await databaseHealth.validateDatabaseSchema(sequelize, models);

    if (validation.valid) {
      logger.info('Database schema validation passed');
      schemaValid = true;
    } else {
      logger.error({ errorCount: validation.errors.length }, 'Database schema validation failed');
      errors.push(...validation.errors);
    }

  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize database');

    // Categorize the error with a helpful message
    if (error.name === 'SequelizeConnectionError' || error.original?.code === 'ECONNREFUSED') {
      const dbHost = process.env.DB_HOST || 'localhost';
      const dbPort = process.env.DB_PORT || 3321;
      errors.push(`Cannot connect to database at ${dbHost}:${dbPort}. Error: ${error.message}`);
    } else if (error.name === 'SequelizeAccessDeniedError') {
      errors.push(`Database authentication failed. Check DB_USER and DB_PASSWORD. Error: ${error.message}`);
    } else if (error.name === 'SequelizeDatabaseError') {
      errors.push(`Database error: ${error.message}`);
    } else {
      errors.push(`Database initialization failed: ${error.message}`);
    }
  }

  // Store startup health status
  databaseHealth.setStartupHealth(connected, schemaValid, errors);

  // If database failed to connect or schema is invalid, log but don't throw
  // This allows the server to start and report the issue via the API
  if (!connected || !schemaValid) {
    logger.warn(
      { connected, schemaValid, errorCount: errors.length },
      'Database is not in healthy state - server starting in degraded mode'
    );
  }
};

module.exports = {
  initializeDatabase,
  sequelize,
  Sequelize,
};
