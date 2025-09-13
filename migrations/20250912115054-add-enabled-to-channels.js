'use strict';

const fs = require('fs');
const path = require('path');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add enabled column to channels table
    await queryInterface.addColumn('channels', 'enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // DB-side cleanup: strip carriage returns from stored URLs and trim
    // This fixes issues found during testing where stored URLs had CR characters.
    await queryInterface.sequelize.query(
      `UPDATE channels SET url = TRIM(REPLACE(url, CHAR(13), ''))`
    );

    // Normalize a URL line from channels.list for safe comparison
    const normalizeUrl = (val) =>
      (val || '')
        .replace(/^\uFEFF/, '') // drop BOM if present at file start
        .replace(/[\r\n\t]/g, '') // remove CR/LF/TAB from lines
        .trim();

    // Read channels.list file if it exists
    const channelsListPath = path.join(__dirname, '../config/channels.list');
    if (fs.existsSync(channelsListPath)) {
      try {
        const data = fs.readFileSync(channelsListPath, 'utf-8');
        const channelUrls = data
          .split(/\r?\n/)
          .map((line) => normalizeUrl(line))
          .filter((line) => line !== '');

        // Update enabled status for channels in the list
        for (const url of channelUrls) {
          await queryInterface.sequelize.query(
            'UPDATE channels SET enabled = true WHERE url = :url',
            {
              replacements: { url },
              type: Sequelize.QueryTypes.UPDATE
            }
          );
        }

        // Backup channels.list file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, `../config/channels.list.backup_${timestamp}`);
        fs.renameSync(channelsListPath, backupPath);

        console.log(`Migration complete: channels.list backed up to ${backupPath}`);
        console.log(`Updated ${channelUrls.length} channels to enabled status`);
      } catch (err) {
        console.error('Error processing channels.list:', err);
        throw err;
      }
    } else {
      console.log('No channels.list file found, all channels will be disabled by default');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // NOTE: This migration is not reversible because it
    // modifies local files and updates database rows based on those files.
    throw new Error('Irreversible migration: add-enabled-to-channels');
  },
};
