/* eslint-env jest */

jest.mock('../../models');
jest.mock('../configModule', () => ({
  directoryPath: '/test/downloads'
}));

describe('ChannelProfileModule', () => {
  let channelProfileModule;
  let ChannelProfile;
  let ProfileFilter;
  let Video;
  let VideoProfileMapping;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset modules to get fresh instances
    jest.resetModules();

    // Import models after mocking
    const models = require('../../models');
    ChannelProfile = models.ChannelProfile;
    ProfileFilter = models.ProfileFilter;
    Video = models.Video;
    VideoProfileMapping = models.VideoProfileMapping;

    // Set up mock implementations
    ChannelProfile.sequelize = {
      transaction: jest.fn().mockResolvedValue({
        commit: jest.fn(),
        rollback: jest.fn()
      })
    };

    ChannelProfile.findAll = jest.fn();
    ChannelProfile.findByPk = jest.fn();
    ChannelProfile.create = jest.fn();
    ChannelProfile.update = jest.fn();
    ChannelProfile.destroy = jest.fn();

    ProfileFilter.bulkCreate = jest.fn();
    ProfileFilter.destroy = jest.fn();

    Video.findAll = jest.fn();
    Video.findOne = jest.fn();

    VideoProfileMapping.create = jest.fn();

    // Import the module after setting up mocks
    channelProfileModule = require('../channelProfileModule');
  });

  describe('getProfilesForChannel', () => {
    it('should return all profiles for a channel', async () => {
      const mockProfiles = [
        { id: 1, channel_id: 1, profile_name: 'Test Profile', filters: [] }
      ];

      ChannelProfile.findAll.mockResolvedValue(mockProfiles);

      const result = await channelProfileModule.getProfilesForChannel(1);

      expect(ChannelProfile.findAll).toHaveBeenCalledWith({
        where: { channel_id: 1 },
        include: expect.any(Array),
        order: [['is_default', 'DESC'], ['profile_name', 'ASC']]
      });
      expect(result).toEqual(mockProfiles);
    });
  });

  describe('checkFilters', () => {
    const videoData = {
      title: 'VFX Artists React to Bad CGI',
      duration: 1200
    };

    it('should return true when title_contains filter matches (OR logic)', async () => {
      const filters = [
        { filter_type: 'title_contains', filter_value: 'React', priority: 0 },
        { filter_type: 'title_contains', filter_value: 'Review', priority: 1 }
      ];

      const result = await channelProfileModule.checkFilters(videoData, filters);
      expect(result).toBe(true);
    });

    it('should return false when no filters match', async () => {
      const filters = [
        { filter_type: 'title_contains', filter_value: 'Review', priority: 0 },
        { filter_type: 'title_contains', filter_value: 'Tutorial', priority: 1 }
      ];

      const result = await channelProfileModule.checkFilters(videoData, filters);
      expect(result).toBe(false);
    });

    it('should handle title_regex filter', async () => {
      const filters = [
        { filter_type: 'title_regex', filter_value: 'VFX.*React', priority: 0 }
      ];

      const result = await channelProfileModule.checkFilters(videoData, filters);
      expect(result).toBe(true);
    });

    it('should handle duration_range filter', async () => {
      const filters = [
        { filter_type: 'duration_range', filter_value: '600-1800', priority: 0 }
      ];

      const result = await channelProfileModule.checkFilters(videoData, filters);
      expect(result).toBe(true);
    });

    it('should return false for empty filters', async () => {
      const result = await channelProfileModule.checkFilters(videoData, []);
      expect(result).toBe(false);
    });
  });

  describe('applyNamingTemplate', () => {
    it('should correctly apply template with season 0', () => {
      const template = '{series} - s{season:02d}e{episode:03d} - {title}';
      const data = {
        series: 'Test Series',
        season: 0,
        episode: 1,
        title: 'Test Episode'
      };

      const result = channelProfileModule.applyNamingTemplate(template, data);
      expect(result).toBe('Test Series - s00e001 - Test Episode');
    });

    it('should correctly apply template with season 1', () => {
      const template = '{series} - s{season:02d}e{episode:03d} - {title}';
      const data = {
        series: 'Test Series',
        season: 1,
        episode: 5,
        title: 'Test Episode'
      };

      const result = channelProfileModule.applyNamingTemplate(template, data);
      expect(result).toBe('Test Series - s01e005 - Test Episode');
    });

    it('should handle clean_title template variable', () => {
      const template = '{series} - {clean_title}';
      const data = {
        series: 'Test Series',
        clean_title: 'Clean Title',
        title: 'Original Title with Pattern'
      };

      const result = channelProfileModule.applyNamingTemplate(template, data);
      expect(result).toBe('Test Series - Clean Title');
    });

    it('should handle date variables', () => {
      const template = '{year}-{month:02d}-{day:02d} - {title}';
      const data = {
        year: '2025',
        month: '9',
        day: '5',
        title: 'Test'
      };

      const result = channelProfileModule.applyNamingTemplate(template, data);
      expect(result).toBe('2025-09-05 - Test');
    });

    it('should remove invalid filename characters', () => {
      const template = '{title}';
      const data = {
        title: 'Test: Episode <1> | Part "A"'
      };

      const result = channelProfileModule.applyNamingTemplate(template, data);
      expect(result).toBe('Test Episode 1 Part A');
    });
  });

  describe('evaluateVideoAgainstProfiles', () => {
    const videoData = {
      title: 'Pass It On Challenge',
      duration: 1500
    };

    it('should return matching non-default profile', async () => {
      const mockProfiles = [
        {
          id: 1,
          profile_name: 'Pass It On',
          is_default: false,
          enabled: true,
          filters: [
            { filter_type: 'title_contains', filter_value: 'Pass It On' }
          ]
        },
        {
          id: 2,
          profile_name: 'Default',
          is_default: true,
          enabled: true,
          filters: []
        }
      ];

      ChannelProfile.findAll.mockResolvedValue(mockProfiles);

      const result = await channelProfileModule.evaluateVideoAgainstProfiles(videoData, 1);

      expect(result).toEqual(mockProfiles[0]);
    });

    it('should return default profile when no match', async () => {
      const mockProfiles = [
        {
          id: 1,
          profile_name: 'Other Series',
          is_default: false,
          enabled: true,
          filters: [
            { filter_type: 'title_contains', filter_value: 'Different' }
          ]
        },
        {
          id: 2,
          profile_name: 'Default',
          is_default: true,
          enabled: true,
          filters: []
        }
      ];

      ChannelProfile.findAll.mockResolvedValue(mockProfiles);

      const result = await channelProfileModule.evaluateVideoAgainstProfiles(videoData, 1);

      expect(result).toEqual(mockProfiles[1]);
    });

    it('should skip disabled profiles', async () => {
      const mockProfiles = [
        {
          id: 1,
          profile_name: 'Pass It On',
          is_default: false,
          enabled: false, // Disabled
          filters: [
            { filter_type: 'title_contains', filter_value: 'Pass It On' }
          ]
        },
        {
          id: 2,
          profile_name: 'Default',
          is_default: true,
          enabled: true,
          filters: []
        }
      ];

      ChannelProfile.findAll.mockResolvedValue(mockProfiles);

      const result = await channelProfileModule.evaluateVideoAgainstProfiles(videoData, 1);

      expect(result).toEqual(mockProfiles[1]); // Should get default instead
    });
  });

  describe('createProfile', () => {
    it('should create profile with filters', async () => {
      const profileData = {
        profile_name: 'Test Profile',
        season_number: 1,
        episode_counter: 1,
        is_default: false
      };

      const filters = [
        { filter_type: 'title_contains', filter_value: 'Test' }
      ];

      const mockProfile = { id: 1, ...profileData };
      ChannelProfile.create.mockResolvedValue(mockProfile);
      ChannelProfile.findByPk.mockResolvedValue({ ...mockProfile, filters });
      ProfileFilter.bulkCreate.mockResolvedValue([]);

      const result = await channelProfileModule.createProfile(1, profileData, filters);

      expect(ChannelProfile.create).toHaveBeenCalled();
      expect(ProfileFilter.bulkCreate).toHaveBeenCalled();
      expect(result).toHaveProperty('filters');
    });

    it('should unset existing default when creating new default', async () => {
      const profileData = {
        profile_name: 'New Default',
        is_default: true
      };

      const mockProfile = { id: 2, ...profileData };
      ChannelProfile.create.mockResolvedValue(mockProfile);
      ChannelProfile.findByPk.mockResolvedValue(mockProfile);
      ChannelProfile.update.mockResolvedValue([1]);

      await channelProfileModule.createProfile(1, profileData, []);

      expect(ChannelProfile.update).toHaveBeenCalledWith(
        { is_default: false },
        expect.objectContaining({
          where: {
            channel_id: 1,
            is_default: true
          }
        })
      );
    });
  });

  describe('getCleanTitle', () => {
    it('should remove matched regex pattern from title', () => {
      const title = 'Tutorial #5: Advanced Techniques';
      const filters = [
        { filter_type: 'title_regex', filter_value: 'Tutorial #\\d+:\\s*' }
      ];

      const result = channelProfileModule.getCleanTitle(title, filters);
      expect(result).toBe('Advanced Techniques');
    });

    it('should return original title when no filters match', () => {
      const title = 'Regular Video Title';
      const filters = [
        { filter_type: 'title_regex', filter_value: 'Tutorial' }
      ];

      const result = channelProfileModule.getCleanTitle(title, filters);
      expect(result).toBe('Regular Video Title');
    });

    it('should handle empty filters', () => {
      const title = 'Test Title';
      const result = channelProfileModule.getCleanTitle(title, []);
      expect(result).toBe('Test Title');
    });
  });

  describe('incrementEpisodeCounter', () => {
    it('should increment episode counter by 1', async () => {
      const mockProfile = {
        id: 1,
        episode_counter: 5,
        save: jest.fn()
      };

      ChannelProfile.findByPk.mockResolvedValue(mockProfile);

      const result = await channelProfileModule.incrementEpisodeCounter(1);

      expect(mockProfile.episode_counter).toBe(6);
      expect(mockProfile.save).toHaveBeenCalled();
      expect(result).toBe(6);
    });

    it('should throw error if profile not found', async () => {
      ChannelProfile.findByPk.mockResolvedValue(null);

      await expect(channelProfileModule.incrementEpisodeCounter(999))
        .rejects.toThrow('Profile not found');
    });
  });
});