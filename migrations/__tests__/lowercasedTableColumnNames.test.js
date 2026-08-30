'use strict';

const migration = require('../20260830201917-lowercased-table-column-names');

// Transformations to simulate create/compare behaviour for different values of lower_case_table_names.
const LCTNS = {
  0: {
    store: (name) => name,
    compare: (a, b) => a === b,
  },
  1: {
    store: (name) => name.toLowerCase(),
    compare: (a, b) => a.toLowerCase() === b.toLowerCase(),
  },
  2: {
    store: (name) => name,
    compare: (a, b) => a.toLowerCase() === b.toLowerCase(),
  },
};

// The whole schema before this migration.
const PRE_RENAME = {
  ApiKeys: ['id', 'name', 'key_hash', 'key_prefix', 'created_at', 'last_used_at', 'is_active', 'usage_count'],
  channels: ['id', 'channel_id', 'title', 'url', 'description', 'uploader', 'enabled', 'available_tabs', 'auto_download_enabled_tabs', 'lastFetchedByTab', 'sub_folder', 'video_quality', 'min_duration', 'max_duration', 'title_filter_regex', 'folder_name', 'default_rating', 'audio_format', 'skip_video_folder', 'hidden_tabs', 'terminated_at', 'm3u_enabled', 'm3u_sort_order', 'auto_removal_protected', 'auto_removal_keep_recent_count'],
  channelvideos: ['id', 'youtube_id', 'channel_id', 'title', 'thumbnail', 'duration', 'publishedAt', 'availability', 'media_type', 'youtube_removed', 'youtube_removed_checked_at', 'live_status', 'ignored', 'ignored_at', 'published_at_source'],
  Jobs: ['id', 'jobType', 'status', 'output', 'timeInitiated', 'timeCreated', 'aux_data'],
  JobVideoDownloads: ['id', 'job_id', 'youtube_id', 'file_path', 'status', 'created_at'],
  JobVideos: ['id', 'job_id', 'video_id'],
  media_server_users: ['id', 'server_type', 'server_user_id', 'server_user_name', 'createdAt', 'updatedAt'],
  playlist_sync_state: ['id', 'playlist_id', 'server_type', 'server_playlist_id', 'last_synced_at', 'last_error', 'createdAt', 'updatedAt'],
  playlists: ['id', 'playlist_id', 'title', 'url', 'description', 'uploader', 'thumbnail', 'video_count', 'enabled', 'auto_download', 'sync_to_plex', 'sync_to_jellyfin', 'sync_to_emby', 'public_on_servers', 'default_sub_folder', 'video_quality', 'min_duration', 'max_duration', 'title_filter_regex', 'audio_format', 'default_rating', 'lastFetched', 'createdAt', 'updatedAt', 'auto_download_baseline_at', 'sort_order'],
  playlistvideos: ['id', 'playlist_id', 'youtube_id', 'position', 'added_at', 'channel_id', 'ignored', 'ignored_at', 'createdAt', 'updatedAt', 'title', 'thumbnail', 'duration', 'channel_name', 'published_at'],
  Sessions: ['id', 'session_token', 'username', 'user_agent', 'ip_address', 'expires_at', 'last_used_at', 'is_active', 'createdAt', 'updatedAt'],
  subfolders: ['id', 'name', 'createdAt', 'updatedAt'],
  video_watch_status: ['id', 'video_id', 'server_type', 'server_user_id', 'played', 'play_count', 'position_ms', 'percent_watched', 'last_watched_at', 'last_synced_at', 'createdAt', 'updatedAt'],
  Videos: ['id', 'youtubeId', 'youTubeChannelName', 'youTubeVideoName', 'duration', 'originalDate', 'description', 'channel_id', 'filePath', 'fileSize', 'removed', 'media_type', 'youtube_removed', 'youtube_removed_checked_at', 'last_downloaded_at', 'content_rating', 'age_limit', 'normalized_rating', 'rating_source', 'audioFilePath', 'audioFileSize', 'protected', 'video_resolution'],
  watch_status_sync_cursors: ['id', 'server_type', 'cursor', 'createdAt', 'updatedAt'],
};

// The whole schema after this migration.
const POST_RENAME = {
  apikeys: ['id', 'name', 'key_hash', 'key_prefix', 'created_at', 'last_used_at', 'is_active', 'usage_count'],
  channels: ['id', 'channel_id', 'title', 'url', 'description', 'uploader', 'enabled', 'available_tabs', 'auto_download_enabled_tabs', 'last_fetched_by_tab', 'sub_folder', 'video_quality', 'min_duration', 'max_duration', 'title_filter_regex', 'folder_name', 'default_rating', 'audio_format', 'skip_video_folder', 'hidden_tabs', 'terminated_at', 'm3u_enabled', 'm3u_sort_order', 'auto_removal_protected', 'auto_removal_keep_recent_count'],
  channelvideos: ['id', 'youtube_id', 'channel_id', 'title', 'thumbnail', 'duration', 'published_at', 'availability', 'media_type', 'youtube_removed', 'youtube_removed_checked_at', 'live_status', 'ignored', 'ignored_at', 'published_at_source'],
  jobs: ['id', 'job_type', 'status', 'output', 'time_initiated', 'time_created', 'aux_data'],
  jobvideodownloads: ['id', 'job_id', 'youtube_id', 'file_path', 'status', 'created_at'],
  jobvideos: ['id', 'job_id', 'video_id'],
  media_server_users: ['id', 'server_type', 'server_user_id', 'server_user_name', 'created_at', 'updated_at'],
  playlist_sync_state: ['id', 'playlist_id', 'server_type', 'server_playlist_id', 'last_synced_at', 'last_error', 'created_at', 'updated_at'],
  playlists: ['id', 'playlist_id', 'title', 'url', 'description', 'uploader', 'thumbnail', 'video_count', 'enabled', 'auto_download', 'sync_to_plex', 'sync_to_jellyfin', 'sync_to_emby', 'public_on_servers', 'default_sub_folder', 'video_quality', 'min_duration', 'max_duration', 'title_filter_regex', 'audio_format', 'default_rating', 'last_fetched', 'created_at', 'updated_at', 'auto_download_baseline_at', 'sort_order'],
  playlistvideos: ['id', 'playlist_id', 'youtube_id', 'position', 'added_at', 'channel_id', 'ignored', 'ignored_at', 'created_at', 'updated_at', 'title', 'thumbnail', 'duration', 'channel_name', 'published_at'],
  sessions: ['id', 'session_token', 'username', 'user_agent', 'ip_address', 'expires_at', 'last_used_at', 'is_active', 'created_at', 'updated_at'],
  subfolders: ['id', 'name', 'created_at', 'updated_at'],
  video_watch_status: ['id', 'video_id', 'server_type', 'server_user_id', 'played', 'play_count', 'position_ms', 'percent_watched', 'last_watched_at', 'last_synced_at', 'created_at', 'updated_at'],
  videos: ['id', 'youtube_id', 'youtube_channel_name', 'youtube_video_name', 'duration', 'original_date', 'description', 'channel_id', 'file_path', 'file_size', 'removed', 'media_type', 'youtube_removed', 'youtube_removed_checked_at', 'last_downloaded_at', 'content_rating', 'age_limit', 'normalized_rating', 'rating_source', 'audio_file_path', 'audio_file_size', 'protected', 'video_resolution'],
  watch_status_sync_cursors: ['id', 'server_type', 'cursor', 'created_at', 'updated_at'],
};

// A schema that's somewhere inbetween the pre and post schema, simulating the result of a partial run of the migration/rollback.
const MIXED = {
  ...PRE_RENAME,
  videos: PRE_RENAME.Videos,
  // Because of the order of operations in the migration we cannot ever have a case where the columns of a table are renamed but the table itself is not, the column renames _always_ occur on the lowercased table names.
};
delete MIXED.Videos;

// Helper to transform a schema with an LCTN.
const applyLCTN = (template, lctn) => {
  const transforms = LCTNS[lctn];
  return Object.fromEntries(
    Object.entries(template).map(([table, columns]) => [transforms.store(table), [...columns]])
  );
};

const createMockInterface = ({ template, lctn }) => {
  const transforms = LCTNS[lctn];
  const schema = applyLCTN(template, lctn);

  const findTable = (table) => Object.keys(schema).find((name) => transforms.compare(table, name));

  const mockInterface = {
    getSchema: () => schema,

    // Used in tableExists helper.
    showAllTables: async () => Object.keys(schema),

    // Used in columnExists helper.
    describeTable: async (table) => {
      const realTable = findTable(table);
      if (realTable === undefined) {
        throw new Error(`Table ${table} doesn't exist.`);
      }

      return Object.fromEntries(schema[realTable].map((name) => [name, true]));
    },

    renameTable: async (from, to) => {
      const realFrom = findTable(from);
      if (realFrom === undefined) {
        throw new Error(`Table ${from} doesn't exist.`);
      }

      const realTo = transforms.store(to);
      if (realFrom === realTo) {
        throw new Error(`From (${from}) and to (${to}) resolve to the same name (${realTo}).`);
      }

      const existingTo = findTable(to);
      if (existingTo !== undefined) {
        throw new Error(`Table ${to} already exists (${existingTo}).`);
      }

      schema[realTo] = schema[realFrom];
      delete schema[realFrom];
    },

    renameColumn: async (table, from, to) => {
      const realTable = findTable(table);
      if (realTable === undefined) {
        throw new Error(`Table ${table} doesn't exist.`);
      }

      const columns = schema[realTable];
      if (!(columns.includes(from))) {
        throw new Error(`Column ${from} doesn't exist.`);
      }
      if (columns.includes(to)) {
        throw new Error(`Column ${to} already exists.`);
      }

      columns[columns.indexOf(from)] = to;
    },

    sequelize: {
      query: jest.fn().mockImplementation(async (query) => {
        const match = /^ALTER TABLE (\w+) CHANGE (\w+) (\w+)/.exec(query);
        if (match) {
          await mockInterface.renameColumn(match[1], match[2], match[3]);
        }
      }),
    },
  };

  return mockInterface;
};

describe('lowercasedTableColumnNames', () => {
  for (const lctn of [0, 1, 2]) {
    describe(`with lower_case_table_names=${lctn}`, () => {
      test('up from clean state', async () => {
        const mockQueryInterface = createMockInterface({
          template: PRE_RENAME,
          lctn,
        });

        await migration.up(mockQueryInterface);

        expect(mockQueryInterface.sequelize.query).toHaveBeenCalledTimes(2);
        expect(mockQueryInterface.sequelize.query).toHaveBeenNthCalledWith(
          1,
          'ALTER TABLE sessions CHANGE createdAt created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
        expect(mockQueryInterface.sequelize.query).toHaveBeenNthCalledWith(
          2,
          'ALTER TABLE sessions CHANGE updatedAt updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        );

        expect(mockQueryInterface.getSchema()).toEqual(applyLCTN(POST_RENAME, lctn));
      });

      test('up from mixed state', async () => {
        const mockQueryInterface = createMockInterface({
          template: MIXED,
          lctn,
        });

        await migration.up(mockQueryInterface);

        expect(mockQueryInterface.getSchema()).toEqual(applyLCTN(POST_RENAME, lctn));
      });

      test('down from clean state', async () => {
        const mockQueryInterface = createMockInterface({
          template: POST_RENAME,
          lctn,
        });

        await migration.down(mockQueryInterface);

        expect(mockQueryInterface.sequelize.query).toHaveBeenCalledTimes(2);
        expect(mockQueryInterface.sequelize.query).toHaveBeenNthCalledWith(
          1,
          'ALTER TABLE sessions CHANGE created_at createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        );
        expect(mockQueryInterface.sequelize.query).toHaveBeenNthCalledWith(
          2,
          'ALTER TABLE sessions CHANGE updated_at updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
        );

        expect(mockQueryInterface.getSchema()).toEqual(applyLCTN(PRE_RENAME, lctn));
      });

      test('down from mixed state', async () => { const mockQueryInterface = createMockInterface({
          template: MIXED, lctn,
        });

        await migration.down(mockQueryInterface);

        expect(mockQueryInterface.getSchema()).toEqual(applyLCTN(PRE_RENAME, lctn));
      });
    });
  }
});
