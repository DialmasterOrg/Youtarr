const logger = require('../logger');

// Store startup health status in memory
let startupHealthStatus = {
  timestamp: null,
  database: {
    connected: false,
    schemaValid: false,
    errors: [],
  },
};

/**
 * Validates that all Sequelize models match the actual database schema
 * @param {Object} sequelize - Sequelize instance
 * @param {Object} models - Object containing all Sequelize models
 * @returns {Object} Validation result with { valid: boolean, errors: string[] }
 */
async function validateDatabaseSchema(sequelize, models) {
  const errors = [];
  const queryInterface = sequelize.getQueryInterface();

  try {
    // Get list of all tables in the database
    const tables = await queryInterface.showAllTables();
    const tableSet = new Set(tables);

    logger.info({ tableCount: tables.length }, 'Validating database schema');

    // Iterate through all models and validate against DB
    for (const modelName of Object.keys(models)) {
      const model = models[modelName];
      const tableName = model.getTableName();

      // Check if table exists
      if (!tableSet.has(tableName)) {
        errors.push(`Table "${tableName}" for model "${modelName}" does not exist in database`);
        logger.error({ tableName, modelName }, 'Missing table in database');
        continue;
      }

      try {
        // Get actual table structure from database
        const tableDescription = await queryInterface.describeTable(tableName);
        const dbColumns = Object.keys(tableDescription);
        const dbColumnSet = new Set(dbColumns);

        // Get model attributes
        const modelAttributes = model.rawAttributes;
        const modelColumns = Object.keys(modelAttributes);

        // Check for missing columns in database
        for (const columnName of modelColumns) {
          if (!dbColumnSet.has(columnName)) {
            const attr = modelAttributes[columnName];
            const typeName = attr.type?.constructor?.name || attr.type?.key || 'UNKNOWN';
            errors.push(
              `Table "${tableName}" is missing column "${columnName}" (type: ${typeName}, nullable: ${attr.allowNull !== false})`
            );
            logger.error(
              { tableName, columnName, type: typeName },
              'Missing column in database table'
            );
          }
        }

        // Check for type mismatches (basic validation)
        for (const columnName of modelColumns) {
          if (dbColumnSet.has(columnName)) {
            const modelAttr = modelAttributes[columnName];
            const dbColumn = tableDescription[columnName];

            // Check nullable constraint mismatch
            const modelNullable = modelAttr.allowNull !== false;
            const dbNullable = dbColumn.allowNull;

            if (modelNullable !== dbNullable) {
              errors.push(
                `Table "${tableName}" column "${columnName}": nullable mismatch (model: ${modelNullable}, database: ${dbNullable})`
              );
              logger.error(
                { tableName, columnName, modelNullable, dbNullable },
                'Nullable constraint mismatch - model does not match database'
              );
            }
          }
        }

        // Check for extra columns in database that aren't in model
        for (const dbColumn of dbColumns) {
          if (!modelColumns.includes(dbColumn)) {
            logger.warn(
              { tableName, columnName: dbColumn },
              'Database has column not defined in model (this may be okay)'
            );
          }
        }
      } catch (error) {
        errors.push(`Failed to validate table "${tableName}": ${error.message}`);
        logger.error({ err: error, tableName }, 'Error validating table structure');
      }
    }

    const valid = errors.length === 0;
    logger.info({ valid, errorCount: errors.length }, 'Schema validation complete');

    return { valid, errors };
  } catch (error) {
    logger.error({ err: error }, 'Fatal error during schema validation');
    return {
      valid: false,
      errors: [`Schema validation failed: ${error.message}`],
    };
  }
}

/**
 * Sets the startup health status (called during server initialization)
 * @param {boolean} connected - Whether database connection succeeded
 * @param {boolean} schemaValid - Whether schema validation passed
 * @param {string[]} errors - Array of error messages
 */
function setStartupHealth(connected, schemaValid, errors = []) {
  startupHealthStatus = {
    timestamp: new Date().toISOString(),
    database: {
      connected,
      schemaValid,
      errors,
    },
  };

  logger.info(
    {
      connected,
      schemaValid,
      errorCount: errors.length,
    },
    'Startup health status set'
  );
}

/**
 * Gets the current startup health status
 * @returns {Object} Current health status
 */
function getStartupHealth() {
  return startupHealthStatus;
}

/**
 * Returns whether the database is in a healthy state
 * @returns {boolean} True if database is connected and schema is valid
 */
function isDatabaseHealthy() {
  return startupHealthStatus.database.connected && startupHealthStatus.database.schemaValid;
}

/**
 * Background health monitor that periodically checks database health
 * and attempts reconnection if unhealthy
 */
let healthMonitorInterval = null;
let consecutiveFailures = 0;
let sequelizeInstance = null;
let isRunningHealthCheck = false;

function startHealthMonitor(reinitializeDatabase, sequelize) {
  if (healthMonitorInterval) {
    logger.warn('Health monitor already running');
    return;
  }

  // Store sequelize instance for active health checks
  sequelizeInstance = sequelize;

  logger.info('Starting database health monitor');

  const runHealthCheck = async () => {
    // Prevent concurrent health checks
    if (isRunningHealthCheck) {
      logger.debug('Health check already in progress, skipping');
      return;
    }

    isRunningHealthCheck = true;

    try {
      let isHealthy = isDatabaseHealthy();

      // If cached status says healthy, actively probe database to verify
      if (isHealthy && sequelizeInstance) {
        try {
          await sequelizeInstance.authenticate();
          logger.debug('Active database health check passed');
        } catch (error) {
          logger.error({ err: error }, 'Active database health check failed - updating status');
          // Update health status to unhealthy
          setStartupHealth(false, false, [`Database connection lost: ${error.message}`]);
          isHealthy = false;
        }
      }

      if (!isHealthy) {
        consecutiveFailures++;

        // Use exponential backoff: 15s, 15s, 30s, 60s
        const checkInterval = consecutiveFailures <= 2 ? 15000 :
          consecutiveFailures <= 3 ? 30000 : 60000;

        logger.info(
          { consecutiveFailures, nextCheckIn: checkInterval / 1000 },
          'Database unhealthy, attempting reconnection'
        );

        try {
          const result = await reinitializeDatabase();

          if (result.connected && result.schemaValid) {
            logger.info('Database reconnection successful');
            consecutiveFailures = 0; // Reset failure counter
          } else {
            logger.warn(
              { connected: result.connected, schemaValid: result.schemaValid },
              'Database reconnection attempt completed but still unhealthy'
            );
          }
        } catch (error) {
          logger.error({ err: error }, 'Error during database reconnection attempt');
        }

        // Reschedule with appropriate interval
        if (healthMonitorInterval) {
          clearInterval(healthMonitorInterval);
          healthMonitorInterval = setInterval(runHealthCheck, checkInterval);
        }
      } else {
      // Database is healthy, keep checking every 15 seconds
        if (consecutiveFailures > 0) {
          logger.info('Database returned to healthy state');
          consecutiveFailures = 0;

          // Reset to normal interval
          if (healthMonitorInterval) {
            clearInterval(healthMonitorInterval);
            healthMonitorInterval = setInterval(runHealthCheck, 15000);
          }
        }
      }
    } finally {
      // Always reset the flag to allow next health check
      isRunningHealthCheck = false;
    }
  };

  // Start checking every 15 seconds
  healthMonitorInterval = setInterval(runHealthCheck, 15000);

  // Also run an immediate check
  runHealthCheck();
}

/**
 * Stops the background health monitor
 */
function stopHealthMonitor() {
  if (healthMonitorInterval) {
    clearInterval(healthMonitorInterval);
    healthMonitorInterval = null;
    logger.info('Database health monitor stopped');
  }
}

module.exports = {
  validateDatabaseSchema,
  setStartupHealth,
  getStartupHealth,
  isDatabaseHealthy,
  startHealthMonitor,
  stopHealthMonitor,
};
