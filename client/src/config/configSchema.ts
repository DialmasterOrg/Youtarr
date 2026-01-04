/**
 * Central configuration schema - single source of truth for all config fields
 *
 * This file defines:
 * - Default values for all configuration fields
 * - Which fields should be tracked for "unsaved changes" detection
 * - TypeScript types derived from the schema
 *
 * When adding a new config field:
 * 1. Add it to CONFIG_FIELDS with its default value and trackChanges setting
 * 2. Add it to DEFAULT_CONFIG (TypeScript will enforce this)
 * 3. ConfigState type and TRACKABLE_CONFIG_KEYS are automatically derived
 */

import { SponsorBlockCategories } from '../components/Configuration/types';

/**
 * Configuration field registry
 * Each field defines its default value and whether changes should be tracked
 */
export const CONFIG_FIELDS = {
  // Channel settings
  channelAutoDownload: { default: false, trackChanges: true },
  channelDownloadFrequency: { default: '', trackChanges: true },
  channelFilesToDownload: { default: 3, trackChanges: true },

  // Video settings
  preferredResolution: { default: '1080', trackChanges: true },
  videoCodec: { default: 'default', trackChanges: true },
  defaultSubfolder: { default: '', trackChanges: true },

  // Plex integration
  plexApiKey: { default: '', trackChanges: true },
  plexYoutubeLibraryId: { default: '', trackChanges: true },
  plexIP: { default: '', trackChanges: true },
  plexPort: { default: '32400', trackChanges: true },
  plexViaHttps: { default: false, trackChanges: true },

  // SponsorBlock
  sponsorblockEnabled: { default: false, trackChanges: true },
  sponsorblockAction: { default: 'remove' as 'remove' | 'mark', trackChanges: true },
  sponsorblockCategories: {
    default: {
      sponsor: true,
      intro: false,
      outro: false,
      selfpromo: true,
      preview: false,
      filler: false,
      interaction: false,
      music_offtopic: false,
    } as SponsorBlockCategories,
    trackChanges: true
  },
  sponsorblockApiUrl: { default: '', trackChanges: true },

  // Download performance
  downloadSocketTimeoutSeconds: { default: 30, trackChanges: true },
  downloadThrottledRate: { default: '100K', trackChanges: true },
  downloadRetryCount: { default: 2, trackChanges: true },
  enableStallDetection: { default: true, trackChanges: true },
  stallDetectionWindowSeconds: { default: 30, trackChanges: true },
  stallDetectionRateThreshold: { default: '100K', trackChanges: true },

  // Advanced settings
  sleepRequests: { default: 1, trackChanges: true },
  proxy: { default: '', trackChanges: true },

  // Cookies
  cookiesEnabled: { default: false, trackChanges: true },
  customCookiesUploaded: { default: false, trackChanges: true },

  // Kodi compatibility
  writeChannelPosters: { default: true, trackChanges: true },
  writeVideoNfoFiles: { default: true, trackChanges: true },

  // Notifications
  notificationsEnabled: { default: false, trackChanges: true },
  appriseUrls: { default: [] as Array<{ url: string; name: string; richFormatting?: boolean }>, trackChanges: true },

  // Auto removal
  autoRemovalEnabled: { default: false, trackChanges: true },
  autoRemovalFreeSpaceThreshold: { default: '', trackChanges: true },
  autoRemovalVideoAgeThreshold: { default: '', trackChanges: true },

  // Storage
  useTmpForDownloads: { default: false, trackChanges: true },
  tmpFilePath: { default: '/tmp/youtarr-downloads', trackChanges: false }, // Not tracked for changes

  // Subtitles
  subtitlesEnabled: { default: false, trackChanges: true },
  subtitleLanguage: { default: 'en', trackChanges: true },

  // Appearance
  darkModeEnabled: { default: false, trackChanges: true },

  // API Keys
  apiKeyRateLimit: { default: 10, trackChanges: true },

  // System/internal fields (not tracked for changes)
  youtubeOutputDirectory: { default: '', trackChanges: false },
  uuid: { default: '', trackChanges: false },
  envAuthApplied: { default: false, trackChanges: false },
};

/**
 * Derived ConfigState type from the schema
 * This ensures type safety and automatic inference of field types
 */
export type ConfigState = {
  [K in keyof typeof CONFIG_FIELDS]: (typeof CONFIG_FIELDS)[K]['default']
};

/**
 * Default configuration object
 * Automatically generated from CONFIG_FIELDS
 */
export const DEFAULT_CONFIG: ConfigState = {
  channelAutoDownload: CONFIG_FIELDS.channelAutoDownload.default,
  channelDownloadFrequency: CONFIG_FIELDS.channelDownloadFrequency.default,
  channelFilesToDownload: CONFIG_FIELDS.channelFilesToDownload.default,
  preferredResolution: CONFIG_FIELDS.preferredResolution.default,
  videoCodec: CONFIG_FIELDS.videoCodec.default,
  defaultSubfolder: CONFIG_FIELDS.defaultSubfolder.default,
  plexApiKey: CONFIG_FIELDS.plexApiKey.default,
  plexYoutubeLibraryId: CONFIG_FIELDS.plexYoutubeLibraryId.default,
  plexIP: CONFIG_FIELDS.plexIP.default,
  plexPort: CONFIG_FIELDS.plexPort.default,
  plexViaHttps: CONFIG_FIELDS.plexViaHttps.default,
  sponsorblockEnabled: CONFIG_FIELDS.sponsorblockEnabled.default,
  sponsorblockAction: CONFIG_FIELDS.sponsorblockAction.default,
  sponsorblockCategories: CONFIG_FIELDS.sponsorblockCategories.default,
  sponsorblockApiUrl: CONFIG_FIELDS.sponsorblockApiUrl.default,
  downloadSocketTimeoutSeconds: CONFIG_FIELDS.downloadSocketTimeoutSeconds.default,
  downloadThrottledRate: CONFIG_FIELDS.downloadThrottledRate.default,
  downloadRetryCount: CONFIG_FIELDS.downloadRetryCount.default,
  enableStallDetection: CONFIG_FIELDS.enableStallDetection.default,
  stallDetectionWindowSeconds: CONFIG_FIELDS.stallDetectionWindowSeconds.default,
  stallDetectionRateThreshold: CONFIG_FIELDS.stallDetectionRateThreshold.default,
  sleepRequests: CONFIG_FIELDS.sleepRequests.default,
  proxy: CONFIG_FIELDS.proxy.default,
  cookiesEnabled: CONFIG_FIELDS.cookiesEnabled.default,
  customCookiesUploaded: CONFIG_FIELDS.customCookiesUploaded.default,
  writeChannelPosters: CONFIG_FIELDS.writeChannelPosters.default,
  writeVideoNfoFiles: CONFIG_FIELDS.writeVideoNfoFiles.default,
  notificationsEnabled: CONFIG_FIELDS.notificationsEnabled.default,
  appriseUrls: CONFIG_FIELDS.appriseUrls.default,
  autoRemovalEnabled: CONFIG_FIELDS.autoRemovalEnabled.default,
  autoRemovalFreeSpaceThreshold: CONFIG_FIELDS.autoRemovalFreeSpaceThreshold.default,
  autoRemovalVideoAgeThreshold: CONFIG_FIELDS.autoRemovalVideoAgeThreshold.default,
  useTmpForDownloads: CONFIG_FIELDS.useTmpForDownloads.default,
  tmpFilePath: CONFIG_FIELDS.tmpFilePath.default,
  subtitlesEnabled: CONFIG_FIELDS.subtitlesEnabled.default,
  subtitleLanguage: CONFIG_FIELDS.subtitleLanguage.default,
  darkModeEnabled: CONFIG_FIELDS.darkModeEnabled.default,
  apiKeyRateLimit: CONFIG_FIELDS.apiKeyRateLimit.default,
  youtubeOutputDirectory: CONFIG_FIELDS.youtubeOutputDirectory.default,
  uuid: CONFIG_FIELDS.uuid.default,
  envAuthApplied: CONFIG_FIELDS.envAuthApplied.default,
};

/**
 * Array of config keys that should be tracked for unsaved changes
 * Automatically filtered from CONFIG_FIELDS where trackChanges is true
 */
export const TRACKABLE_CONFIG_KEYS = Object.entries(CONFIG_FIELDS)
  .filter(([_, meta]) => meta.trackChanges)
  .map(([key, _]) => key) as (keyof ConfigState)[];
