'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Check current database charset
      const [dbInfo] = await queryInterface.sequelize.query(
        `SELECT DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation 
         FROM information_schema.SCHEMATA 
         WHERE SCHEMA_NAME = DATABASE()`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      console.log(`Current database charset: ${dbInfo.charset}, collation: ${dbInfo.collation}`);

      // Only migrate if not already utf8mb4
      if (dbInfo.charset !== 'utf8mb4') {
        console.log('Upgrading database to utf8mb4...');

        // Log current state for reference
        await queryInterface.sequelize.query(
          `CREATE TABLE IF NOT EXISTS _charset_migration_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            migration_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            original_db_charset VARCHAR(50),
            original_db_collation VARCHAR(50),
            table_name VARCHAR(64),
            original_table_collation VARCHAR(50),
            new_table_collation VARCHAR(50)
          )`,
          { transaction }
        );

        // Log database upgrade
        await queryInterface.sequelize.query(
          `INSERT INTO _charset_migration_log (original_db_charset, original_db_collation, table_name) 
           VALUES ('${dbInfo.charset}', '${dbInfo.collation}', 'DATABASE')`,
          { transaction }
        );

        // Get all table information before migration
        const tables = await queryInterface.sequelize.query(
          `SELECT TABLE_NAME, TABLE_COLLATION 
           FROM information_schema.tables 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_TYPE = 'BASE TABLE'
           AND TABLE_NAME NOT LIKE '_charset_migration_log'`,
          { transaction, type: Sequelize.QueryTypes.SELECT }
        );

        // Log each table's current state
        for (const table of tables) {
          await queryInterface.sequelize.query(
            `INSERT INTO _charset_migration_log (table_name, original_table_collation) 
             VALUES ('${table.TABLE_NAME}', '${table.TABLE_COLLATION}')`,
            { transaction }
          );
        }

        // Upgrade database
        await queryInterface.sequelize.query(
          'ALTER DATABASE youtarr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
          { transaction }
        );

        // Upgrade tables that need it
        for (const table of tables) {
          if (!table.TABLE_COLLATION.includes('utf8mb4')) {
            console.log(`Converting table ${table.TABLE_NAME} from ${table.TABLE_COLLATION} to utf8mb4_unicode_ci`);

            await queryInterface.sequelize.query(
              `ALTER TABLE \`${table.TABLE_NAME}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
              { transaction }
            );

            // Update log with new collation
            await queryInterface.sequelize.query(
              `UPDATE _charset_migration_log 
               SET new_table_collation = 'utf8mb4_unicode_ci' 
               WHERE table_name = '${table.TABLE_NAME}' 
               AND migration_date = (SELECT MAX(migration_date) FROM _charset_migration_log AS l2 WHERE l2.table_name = '${table.TABLE_NAME}')`,
              { transaction }
            );
          } else {
            console.log(`Table ${table.TABLE_NAME} already uses utf8mb4, skipping`);
          }
        }

        console.log('UTF8mb4 migration completed successfully');
      } else {
        console.log('Database already uses utf8mb4, skipping migration');
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('UTF8mb4 migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Charset migrations are irreversible to prevent data loss
    console.log('Warning: Charset migrations cannot be safely reversed.');
    console.log('Downgrading from utf8mb4 to utf8 may cause data loss if 4-byte characters exist.');
    console.log('If you need to rollback, please restore from a backup taken before the migration.');

    // Show migration log for reference
    try {
      const logs = await queryInterface.sequelize.query(
        'SELECT * FROM _charset_migration_log ORDER BY migration_date DESC LIMIT 10',
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (logs.length > 0) {
        console.log('Migration history:');
        console.table(logs);
      }
    } catch (error) {
      console.log('Could not retrieve migration history');
    }

    throw new Error(
      'Charset migration rollback disabled to prevent data loss. ' +
      'Restore from backup if rollback is absolutely necessary.'
    );
  },
};
