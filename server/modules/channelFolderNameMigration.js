const Channel = require('../models/channel');
const logger = require('../logger');

/**
 * Migration utility to populate folder_name for existing channels.
 * Uses yt-dlp to get the authoritative folder name for each channel.
 * Runs asynchronously on startup to avoid blocking.
 */
class ChannelFolderNameMigration {
  /**
   * Migrate folder_name for all channels using yt-dlp.
   * This is idempotent - safe to run multiple times.
   * Processes channels sequentially to avoid rate limiting.
   * @returns {Promise<{migrated: number, failed: number}>} - Migration results
   */
  async migrateExistingChannels() {
    // Lazy require to avoid circular dependency at module load time
    const channelModule = require('./channelModule');

    // Get channels without folder_name
    const channelsToMigrate = await Channel.findAll({
      where: { folder_name: null },
      attributes: ['id', 'channel_id', 'uploader', 'folder_name']
    });

    if (channelsToMigrate.length === 0) {
      logger.debug('No channels need folder_name migration');
      return { migrated: 0, failed: 0 };
    }

    logger.info(
      { count: channelsToMigrate.length },
      'Starting folder_name migration for existing channels using yt-dlp'
    );

    let migrated = 0;
    let failed = 0;

    // Process channels sequentially to avoid rate limiting
    for (const channel of channelsToMigrate) {
      try {
        // resolveChannelFolderName calls yt-dlp and saves to database
        await channelModule.resolveChannelFolderName(channel);

        // Reload channel to check if folder_name was successfully saved
        await channel.reload();

        if (channel.folder_name) {
          // Successfully saved folder_name to database
          logger.info(
            { channelId: channel.channel_id, folderName: channel.folder_name },
            'Migrated channel folder_name'
          );
          migrated++;
        } else {
          // folder_name was not saved (yt-dlp must have failed)
          logger.warn(
            { channelId: channel.channel_id, uploader: channel.uploader },
            'Could not get folder_name from yt-dlp'
          );
          failed++;
        }
      } catch (err) {
        logger.error(
          { err: err.message, channelId: channel.channel_id },
          'Error migrating folder_name for channel'
        );
        failed++;
      }
    }

    logger.info(
      { migrated, failed, total: channelsToMigrate.length },
      'Completed folder_name migration for existing channels'
    );

    return { migrated, failed };
  }
}

module.exports = new ChannelFolderNameMigration();
