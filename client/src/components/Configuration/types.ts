// Import ConfigState from centralized schema
import type { ConfigState } from '../../config/configSchema';

// Re-export for convenience
export type { ConfigState };

export interface ConfigurationProps {
  token: string | null;
}

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
    spaceStrategy: AutoRemovalDryRunPlanStrategy;
  };
  simulationTotals: {
    byAge: number;
    bySpace: number;
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
}

export interface DeploymentEnvironment {
  platform?: string | null;
  isWsl: boolean;
}

export interface CookieStatus {
  cookiesEnabled: boolean;
  customCookiesUploaded: boolean;
  customFileExists: boolean;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export type PlexConnectionStatus = 'connected' | 'not_connected' | 'not_tested' | 'testing';
