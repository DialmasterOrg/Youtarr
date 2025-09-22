const { ChannelProfile, ProfileFilter, Channel, Video } = require('../models');
const { Op } = require('sequelize');

class ChannelProfileModule {
  /**
   * Get all profiles for a channel
   * @param {number} channelId - Channel ID
   * @returns {Promise<Array>} Array of profiles with filters
   */
  async getProfilesForChannel(channelId) {
    try {
      const profiles = await ChannelProfile.findAll({
        where: { channel_id: channelId },
        include: [
          {
            model: ProfileFilter,
            as: 'filters',
            order: [['priority', 'ASC']],
          },
        ],
        order: [['is_default', 'DESC'], ['profile_name', 'ASC']],
      });
      return profiles;
    } catch (error) {
      console.error('Error fetching channel profiles:', error);
      throw error;
    }
  }

  /**
   * Create a new profile for a channel
   * @param {number} channelId - Channel ID
   * @param {Object} profileData - Profile configuration
   * @param {Array} filters - Array of filter configurations
   * @returns {Promise<Object>} Created profile
   */
  async createProfile(channelId, profileData, filters = []) {
    const transaction = await ChannelProfile.sequelize.transaction();

    try {
      // If this is set as default, unset any existing default
      if (profileData.is_default) {
        await ChannelProfile.update(
          { is_default: false },
          {
            where: {
              channel_id: channelId,
              is_default: true
            },
            transaction,
          }
        );
      }

      // Create the profile
      const profile = await ChannelProfile.create(
        {
          channel_id: channelId,
          ...profileData,
        },
        { transaction }
      );

      // Create filters if provided
      if (filters && filters.length > 0) {
        const filterData = filters.map((filter, index) => ({
          profile_id: profile.id,
          filter_type: filter.filter_type,
          filter_value: filter.filter_value,
          priority: filter.priority !== undefined ? filter.priority : index,
        }));

        await ProfileFilter.bulkCreate(filterData, { transaction });
      }

      await transaction.commit();

      // Return profile with filters
      return await ChannelProfile.findByPk(profile.id, {
        include: [
          {
            model: ProfileFilter,
            as: 'filters',
            order: [['priority', 'ASC']],
          },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error creating channel profile:', error);
      throw error;
    }
  }

  /**
   * Update an existing profile
   * @param {number} profileId - Profile ID
   * @param {Object} profileData - Updated profile data
   * @param {Array} filters - Updated filters (will replace existing)
   * @returns {Promise<Object>} Updated profile
   */
  async updateProfile(profileId, profileData, filters = null) {
    const transaction = await ChannelProfile.sequelize.transaction();

    try {
      const profile = await ChannelProfile.findByPk(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // If setting as default, unset any other default for this channel
      if (profileData.is_default && !profile.is_default) {
        await ChannelProfile.update(
          { is_default: false },
          {
            where: {
              channel_id: profile.channel_id,
              is_default: true,
              id: { [Op.ne]: profileId }
            },
            transaction,
          }
        );
      }

      // Update profile
      await profile.update(profileData, { transaction });

      // Update filters if provided
      if (filters !== null) {
        // Delete existing filters
        await ProfileFilter.destroy({
          where: { profile_id: profileId },
          transaction,
        });

        // Create new filters
        if (filters.length > 0) {
          const filterData = filters.map((filter, index) => ({
            profile_id: profileId,
            filter_type: filter.filter_type,
            filter_value: filter.filter_value,
            priority: filter.priority !== undefined ? filter.priority : index,
          }));

          await ProfileFilter.bulkCreate(filterData, { transaction });
        }
      }

      await transaction.commit();

      // Return updated profile with filters
      return await ChannelProfile.findByPk(profileId, {
        include: [
          {
            model: ProfileFilter,
            as: 'filters',
            order: [['priority', 'ASC']],
          },
        ],
      });
    } catch (error) {
      await transaction.rollback();
      console.error('Error updating channel profile:', error);
      throw error;
    }
  }

  /**
   * Delete a profile
   * @param {number} profileId - Profile ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteProfile(profileId) {
    try {
      const result = await ChannelProfile.destroy({
        where: { id: profileId },
      });
      return result > 0;
    } catch (error) {
      console.error('Error deleting channel profile:', error);
      throw error;
    }
  }

  /**
   * Evaluate a video against channel profiles to find a match
   * @param {Object} videoData - Video information (title, duration, etc.)
   * @param {number} channelId - Channel ID
   * @returns {Promise<Object|null>} Matched profile or null
   */
  async evaluateVideoAgainstProfiles(videoData, channelId) {
    try {
      const profiles = await this.getProfilesForChannel(channelId);

      // Filter to only enabled profiles
      const enabledProfiles = profiles.filter(p => p.enabled);

      // Sort profiles: non-default first, then default
      const sortedProfiles = enabledProfiles.sort((a, b) => {
        if (a.is_default && !b.is_default) return 1;
        if (!a.is_default && b.is_default) return -1;
        return 0;
      });

      for (const profile of sortedProfiles) {
        // Skip default profile in first pass
        if (profile.is_default) continue;

        // Check if video matches any filter
        const matches = await this.checkFilters(videoData, profile.filters);
        if (matches) {
          return profile;
        }
      }

      // Return default profile if no specific match
      const defaultProfile = sortedProfiles.find(p => p.is_default);
      return defaultProfile || null;
    } catch (error) {
      console.error('Error evaluating video against profiles:', error);
      return null;
    }
  }

  /**
   * Check if video matches profile filters
   * @param {Object} videoData - Video information
   * @param {Array} filters - Profile filters
   * @returns {Promise<boolean>} Match status
   */
  async checkFilters(videoData, filters) {
    if (!filters || filters.length === 0) {
      return false;
    }

    // Sort filters by priority
    const sortedFilters = [...filters].sort((a, b) => a.priority - b.priority);

    for (const filter of sortedFilters) {
      let matches = false;

      switch (filter.filter_type) {
      case 'title_regex': {
        try {
          const regex = new RegExp(filter.filter_value, 'i');
          matches = regex.test(videoData.title || '');
        } catch (error) {
          console.error(`Invalid regex pattern: ${filter.filter_value}`, error);
        }
        break;
      }

      case 'title_contains': {
        const title = (videoData.title || '').toLowerCase();
        const searchTerm = filter.filter_value.toLowerCase();
        matches = title.includes(searchTerm);
        break;
      }

      case 'duration_range': {
        // Parse duration range (e.g., "300-600" for 5-10 minutes)
        const [min, max] = filter.filter_value.split('-').map(Number);
        const duration = videoData.duration || 0;
        matches = duration >= min && duration <= max;
        break;
      }
      }

      // Any filter can match (OR logic)
      if (matches) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the next episode number for a profile
   * @param {number} profileId - Profile ID
   * @returns {Promise<number>} Next episode number
   */
  async getNextEpisodeNumber(profileId) {
    try {
      const profile = await ChannelProfile.findByPk(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }
      return profile.episode_counter;
    } catch (error) {
      console.error('Error getting next episode number:', error);
      throw error;
    }
  }

  /**
   * Increment the episode counter for a profile
   * @param {number} profileId - Profile ID
   * @returns {Promise<number>} New episode number
   */
  async incrementEpisodeCounter(profileId) {
    try {
      const profile = await ChannelProfile.findByPk(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      profile.episode_counter += 1;
      await profile.save();

      return profile.episode_counter;
    } catch (error) {
      console.error('Error incrementing episode counter:', error);
      throw error;
    }
  }

  /**
   * Apply naming template to generate filename
   * @param {string} template - Naming template
   * @param {Object} data - Template data
   * @returns {string} Generated filename
   */
  applyNamingTemplate(template, data) {
    let result = template;

    // Helper function to pad numbers
    const pad = (num, size) => {
      let s = num.toString();
      while (s.length < size) s = '0' + s;
      return s;
    };

    // Parse and replace template variables
    const replacements = {
      '{series}': data.series || '',
      '{season}': data.season ?? 1,
      '{season:02d}': pad(data.season ?? 1, 2),
      '{season:03d}': pad(data.season ?? 1, 3),
      '{episode}': data.episode ?? 1,
      '{episode:02d}': pad(data.episode ?? 1, 2),
      '{episode:03d}': pad(data.episode ?? 1, 3),
      '{title}': data.title || '',
      '{clean_title}': data.clean_title || data.title || '',
      '{year}': data.year || '',
      '{month}': data.month || '',
      '{month:02d}': pad(data.month || 1, 2),
      '{day}': data.day || '',
      '{day:02d}': pad(data.day || 1, 2),
      '{channel}': data.channel || '',
      '{id}': data.id || '',
    };

    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Clean up the filename
    result = result.replace(/[<>:"/\\|?*]/g, ''); // Remove invalid filename characters
    result = result.replace(/\s+/g, ' ').trim(); // Clean up whitespace

    return result;
  }

  /**
   * Get clean title by removing matched filter pattern
   * @param {string} title - Original title
   * @param {Array} filters - Profile filters
   * @returns {string} Clean title
   */
  getCleanTitle(title, filters) {
    if (!filters || filters.length === 0) {
      return title;
    }

    let cleanTitle = title;

    for (const filter of filters) {
      if (filter.filter_type === 'title_regex') {
        try {
          const regex = new RegExp(filter.filter_value, 'i');
          const match = title.match(regex);
          if (match) {
            // Remove the matched part and clean up
            cleanTitle = title.replace(match[0], '').trim();
            // Remove any leading/trailing separators
            cleanTitle = cleanTitle.replace(/^[-–—:]\s*/, '').replace(/\s*[-–—:]$/, '');
            break;
          }
        } catch (error) {
          console.error(`Invalid regex pattern: ${filter.filter_value}`, error);
        }
      }
    }

    return cleanTitle;
  }

  /**
   * Test profile filters against existing channel videos
   * @param {number} profileId - Profile ID
   * @returns {Promise<Array>} Array of matched videos with preview names
   */
  async testProfileFilters(profileId) {
    try {
      const profile = await ChannelProfile.findByPk(profileId, {
        include: [
          {
            model: ProfileFilter,
            as: 'filters',
          },
          {
            model: Channel,
            as: 'channel',
          },
        ],
      });

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Get all videos for the channel
      const videos = await Video.findAll({
        where: { channel_id: profile.channel.channel_id },
        order: [['originalDate', 'ASC']],
      });

      const matches = [];
      let episodeCounter = 1;

      for (const video of videos) {
        const videoData = {
          title: video.youTubeVideoName,
          duration: video.duration,
        };

        const isMatch = await this.checkFilters(videoData, profile.filters);

        if (isMatch || profile.is_default) {
          let cleanTitle = this.getCleanTitle(video.youTubeVideoName, profile.filters);

          // Remove channel name from title if present
          const channelName = profile.channel.title || profile.channel.uploader;
          if (cleanTitle.toLowerCase().startsWith(channelName.toLowerCase())) {
            cleanTitle = cleanTitle.substring(channelName.length).replace(/^[-–—:\s]+/, '').trim();
          }

          // Parse date if available
          let year = '', month = '', day = '';
          if (video.originalDate) {
            const dateStr = video.originalDate.toString();
            year = dateStr.substring(0, 4);
            month = dateStr.substring(4, 6);
            day = dateStr.substring(6, 8);
          }

          const templateData = {
            series: profile.series_name || profile.profile_name,
            season: profile.is_default ? 0 : profile.season_number,
            episode: episodeCounter,
            title: video.youTubeVideoName,
            clean_title: cleanTitle,
            year,
            month,
            day,
            channel: profile.channel.title || profile.channel.uploader,
            id: video.youtubeId,
          };

          const newFilename = this.applyNamingTemplate(profile.naming_template, templateData);

          matches.push({
            video_id: video.id,
            youtube_id: video.youtubeId,
            original_title: video.youTubeVideoName,
            clean_title: cleanTitle,
            new_filename: newFilename,
            season: templateData.season,
            episode: episodeCounter,
            matched_by_filter: !profile.is_default,
          });

          episodeCounter++;
        }
      }

      return matches;
    } catch (error) {
      console.error('Error testing profile filters:', error);
      throw error;
    }
  }
}

module.exports = new ChannelProfileModule();