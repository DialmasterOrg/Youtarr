// Import ConfigState from centralized schema
import type { ConfigState } from '../../config/configSchema';

// Re-export for convenience
export type { ConfigState };

export type SettingsSectionGroup = 'general' | 'integrations' | 'downloads' | 'advanced' | 'security';

export interface AutoRemovalDryRunVideoSummary {
  id: number;
  youtubeId: string;
  title: string;
  channel: string;
  fileSize: number;
  timeCreated: string | null;
}

export interface AutoRemovalDryRunPlanStrategy {
  enabled: boolean;
  thresholdDays?: number | null;
  threshold?: string | null;
  thresholdBytes?: number | null;
  limit?: string | null;
  limitBytes?: number | null;
  usedBytes?: number | null;
  minDaysSinceWatched?: number | null;
  minVideoAgeDays?: number | null;
  skippedReason?: string | null;
  candidateCount: number;
  estimatedFreedBytes: number;
  deletedCount: number;
  failedCount: number;
  needsCleanup?: boolean;
  iterations?: number;
  storageStatus?: {
    availableGB: string;
    totalGB: string;
    percentFree: number;
    percentUsed: number;
  } | null;
  sampleVideos: AutoRemovalDryRunVideoSummary[];
}

export interface AutoRemovalDryRunResult {
  dryRun: boolean;
  success: boolean;
  errors: string[];
  plan: {
    ageStrategy: AutoRemovalDryRunPlanStrategy;
    watchedStrategy?: AutoRemovalDryRunPlanStrategy;
    keepRecent?: {
      count: number;
      protectedCount: number;
    };
    channelKeepRecent?: {
      channelCount: number;
      protectedCount: number;
    };
    spaceStrategy: AutoRemovalDryRunPlanStrategy;
    usageStrategy?: AutoRemovalDryRunPlanStrategy;
  };
  simulationTotals: {
    byAge: number;
    byWatched?: number;
    bySpace: number;
    byUsage?: number;
    total: number;
    estimatedFreedBytes: number;
  } | null;
}

export interface SponsorBlockCategories {
  sponsor: boolean;
  intro: boolean;
  outro: boolean;
  selfpromo: boolean;
  preview: boolean;
  filler: boolean;
  interaction: boolean;
  music_offtopic: boolean;
}

export interface PlatformManagedState {
  plexUrl: boolean;
  authEnabled: boolean;
  useTmpForDownloads: boolean;
  ytdlpUpdates: boolean;
}

export interface DeploymentEnvironment {
  timezone?: string | null;
  platform?: string | null;
  isWsl: boolean;
}

export interface LoggingStatus {
  envLevel: string;
  file: {
    enabled: boolean;
    directory: string;
    maxSizeBytes: number;
    maxFiles: number;
    error: string | null;
  };
}

export interface CookieDetails {
  loginCookiesFound: number;
  sessionLoginCookies: number;
  expiredLoginCookies: number;
  earliestExpiry: string | null;
  earliestExpiryName: string | null;
  lastModified: string;
}

export interface CookieStatus {
  cookiesEnabled: boolean;
  customCookiesUploaded: boolean;
  customFileExists: boolean;
  external?: {
    path: string;
    ready: boolean;
    lastModified: string | null;
    warning: string | null;
    error: string | null;
  };
  details?: CookieDetails | null;
}

export type CookieTestResult =
  | { ok: true; message: string }
  | { ok: false; code?: string; error: string };

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export type PlexConnectionStatus = 'connected' | 'not_connected' | 'not_tested' | 'testing';

export type YouTubeApiKeyStatus =
  | 'not_tested'
  | 'testing'
  | 'valid'
  | 'invalid'
  | 'quota_exhausted'
  | 'rate_limited'
  | 'api_not_enabled'
  | 'key_restricted'
  | 'network_error';

export interface YouTubeApiKeyTestResult {
  ok: boolean;
  code?: string;
  reason?: string;
}
