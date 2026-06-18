'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    let foreignKeyChecksDisabled = false;

    try {
      const [dbInfo] = await queryInterface.sequelize.query(
        `SELECT SCHEMA_NAME as name, DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation
         FROM information_schema.SCHEMATA
         WHERE SCHEMA_NAME = DATABASE()`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      console.log(`Current database charset: ${dbInfo.charset}, collation: ${dbInfo.collation}`);

      // Check the tables directly, not just the database default. A failed earlier run
      // can flip the database default to utf8mb4 (ALTER DATABASE auto-commits) while
      // leaving tables on utf8mb3, so the default alone isn't reliable.
      const tables = await queryInterface.sequelize.query(
        `SELECT TABLE_NAME, TABLE_COLLATION
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_TYPE = 'BASE TABLE'
         AND TABLE_NAME NOT LIKE '_charset_migration_log'`,
        { transaction, type: Sequelize.QueryTypes.SELECT }
      );

      const tablesToConvert = tables.filter(
        (table) => !table.TABLE_COLLATION || !table.TABLE_COLLATION.includes('utf8mb4')
      );
      const databaseNeedsUpgrade = dbInfo.charset !== 'utf8mb4';

      if (!databaseNeedsUpgrade && tablesToConvert.length === 0) {
        console.log('Database already uses utf8mb4, skipping migration');
        await transaction.commit();
        return;
      }

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
         VALUES (?, ?, 'DATABASE')`,
        { transaction, replacements: [dbInfo.charset, dbInfo.collation] }
      );

      // Log each table's current state
      for (const table of tablesToConvert) {
        await queryInterface.sequelize.query(
          `INSERT INTO _charset_migration_log (table_name, original_table_collation)
           VALUES (?, ?)`,
          { transaction, replacements: [table.TABLE_NAME, table.TABLE_COLLATION] }
        );
      }

      // Turn off foreign key checks while converting. JobVideos.job_id and
      // JobVideoDownloads.job_id are CHAR-based UUIDs in a foreign key into Jobs, and
      // MariaDB won't change the charset of a column that's in a foreign key. Every table
      // is converted in the same run, so the constraints stay consistent.
      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
      foreignKeyChecksDisabled = true;

      // Use the real database name; it's not always "youtarr"
      if (databaseNeedsUpgrade) {
        await queryInterface.sequelize.query(
          `ALTER DATABASE \`${dbInfo.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          { transaction }
        );
      }

      // Upgrade tables that need it
      for (const table of tablesToConvert) {
        console.log(`Converting table ${table.TABLE_NAME} from ${table.TABLE_COLLATION} to utf8mb4_unicode_ci`);

        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table.TABLE_NAME}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
          { transaction }
        );

        // Update log with new collation
        await queryInterface.sequelize.query(
          `UPDATE _charset_migration_log
           SET new_table_collation = 'utf8mb4_unicode_ci'
           WHERE table_name = ?
           AND migration_date = (SELECT MAX(migration_date) FROM _charset_migration_log AS l2 WHERE l2.table_name = ?)`,
          { transaction, replacements: [table.TABLE_NAME, table.TABLE_NAME] }
        );
      }

      await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
      foreignKeyChecksDisabled = false;

      console.log('UTF8mb4 migration completed successfully');

      await transaction.commit();
    } catch (error) {
      // Re-enable foreign key checks before the connection goes back to the pool, so a
      // failure doesn't leave a pooled connection with checks off.
      if (foreignKeyChecksDisabled) {
        try {
          await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
        } catch (resetError) {
          console.error('Failed to re-enable foreign key checks after migration error:', resetError);
        }
      }
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
