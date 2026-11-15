// Types and pure helpers of the Sonarr / Radarr settings page. The types
// mirror the answers of /api/arr-bridge (server/routes/arrBridgeSettings.js).
import { GLOBAL_DEFAULT_SENTINEL, ROOT_SENTINEL } from '../../../utils/channelHelpers';

export type ArrApp = 'sonarr' | 'radarr';

export const ARR_APPS: ArrApp[] = ['sonarr', 'radarr'];
export const ARR_APP_NAMES: Record<ArrApp, string> = { sonarr: 'Sonarr', radarr: 'Radarr' };
export const ARR_DOCS_URL = 'https://dialmasterorg.github.io/Youtarr/docs/sonarr-radarr/';
export const MAX_ARR_CATEGORIES = 10;
export const MAX_MINIMUM_MINUTES = 600;
export const MAX_RETENTION_DAYS = 365;
const MAX_STAGING_PATH_LENGTH = 500;
// The server's rule: a category name is a folder under the staging folder.
const CATEGORY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const SUBFOLDER_NAME_PATTERN = /^[a-zA-Z0-9\s\-_]+$/;
const RESERVED_SUBFOLDERS = ['playlists'];
const MAX_SUBFOLDER_LENGTH = 100;
const SUBFOLDER_PREFIX = '__';

export interface ArrCategory {
  name: string;
  subfolder: string | null;
}

/** A saved connection. The server never returns the key, only whether one is stored. */
export interface ArrConnectionView {
  url: string | null;
  keySet: boolean;
}

export interface ArrBridgeStatus {
  enabled: boolean;
  stagingRoot: string;
  stagingClientPath: string;
  connections: Record<ArrApp, ArrConnectionView>;
}

export interface ArrConnectionResult {
  ok: boolean;
  appName?: string;
  version?: string;
  reason?: string;
  message?: string;
  connection?: ArrConnectionView;
}

export type ArrGrabState = 'waiting' | 'downloading' | 'ready' | 'failed' | 'handed-off' | 'cancelled';

export interface ArrGrab {
  id: string;
  releaseTitle: string;
  youtubeId: string;
  videoTitle: string | null;
  channelName: string | null;
  kind: 'tv' | 'movie';
  category: string;
  state: ArrGrabState;
  failMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  removedAt: string | null;
}

type GrabTone = 'default' | 'info' | 'success' | 'warning' | 'error';

// Sonarr and Radarr remove an item after importing it and when it is removed
// there, with the same call, so "handed-off" cannot be called "Imported".
export const GRAB_STATE_LABELS: Record<ArrGrabState, { label: string; tone: GrabTone }> = {
  waiting: { label: 'Waiting to download', tone: 'default' },
  downloading: { label: 'Downloading', tone: 'info' },
  ready: { label: 'Ready to import', tone: 'warning' },
  failed: { label: 'Failed', tone: 'error' },
  'handed-off': { label: 'Taken by Sonarr/Radarr', tone: 'success' },
  cancelled: { label: 'Removed before it finished', tone: 'default' },
};

export interface ArrSetupValues {
  indexerUrl: string;
  apiPath: string;
  host: string;
  port: string;
  useSsl: boolean;
  urlBase: string;
}

/**
 * The values to type into Sonarr and Radarr, from the address this page is
 * open at. Another container reaches Youtarr under a different address, which
 * the page says beside them.
 */
export function getSetupValues(origin: { protocol: string; hostname: string; port: string }): ArrSetupValues {
  const useSsl = origin.protocol === 'https:';
  const address = `${origin.protocol}//${origin.hostname}${origin.port ? `:${origin.port}` : ''}`;
  return {
    indexerUrl: `${address}/arr/newznab`,
    apiPath: '/api',
    host: origin.hostname,
    port: origin.port || (useSsl ? '443' : '80'),
    useSsl,
    urlBase: '/arr/sabnzbd',
  };
}

// Mirrors the server's validateSubFolderName. The subfolder list offers every
// subfolder that exists, and an old one can have a name the server refuses.
function isUsableSubfolder(subfolder: string | null): boolean {
  if (subfolder === null || subfolder.trim() === '') return true;
  if (subfolder === GLOBAL_DEFAULT_SENTINEL || subfolder === ROOT_SENTINEL) return true;
  const name = subfolder.trim();
  if (RESERVED_SUBFOLDERS.includes(name.toLowerCase()) || name.length > MAX_SUBFOLDER_LENGTH) return false;
  return SUBFOLDER_NAME_PATTERN.test(name) && !name.includes('..') && !name.startsWith(SUBFOLDER_PREFIX);
}

export function getCategoriesError(categories: ArrCategory[]): string | null {
  if (categories.length === 0) return 'Add at least one category.';
  if (categories.length > MAX_ARR_CATEGORIES) return `Use at most ${MAX_ARR_CATEGORIES} categories.`;
  if (categories.some((category) => !CATEGORY_NAME_PATTERN.test(category.name))) {
    return 'Category names use letters, digits, - and _, and start with a letter or digit (up to 32 characters).';
  }
  const names = new Set(categories.map((category) => category.name.toLowerCase()));
  if (names.size !== categories.length) return 'Each category needs a different name.';
  const refused = categories.find((category) => !isUsableSubfolder(category.subfolder));
  return refused ? `The subfolder chosen for "${refused.name}" cannot be used for a category. Pick another one.` : null;
}

// The server's rule for the staging path: empty, or an absolute path without
// "..", which is still a path once trailing slashes are removed.
function isStagingPath(value: string): boolean {
  const path = value.trim();
  if (path === '') return true;
  if (!path.startsWith('/') || path.length > MAX_STAGING_PATH_LENGTH || path.split('/').includes('..')) return false;
  return path.replace(/[\s/]+$/, '') !== '';
}

export interface ArrBridgeSavedSettings {
  arrBridgeCategories: ArrCategory[];
  arrBridgeMinTvMinutes: number;
  arrBridgeMinMovieMinutes: number;
  arrBridgeStagingPath: string;
  arrBridgeStagingRetentionDays: number;
}

const isMinutes = (value: number) => Number.isFinite(value) && value >= 0 && value <= MAX_MINIMUM_MINUTES;

/**
 * Mirrors the server's /updateconfig checks, so the Save button explains a
 * problem before the request is sent.
 */
export function getArrBridgeSettingsError(settings: ArrBridgeSavedSettings): string | null {
  const categoriesError = getCategoriesError(settings.arrBridgeCategories);
  if (categoriesError) return `Sonarr / Radarr: ${categoriesError}`;
  if (!isMinutes(settings.arrBridgeMinTvMinutes) || !isMinutes(settings.arrBridgeMinMovieMinutes)) {
    return `Sonarr / Radarr: the shortest length must be from 0 to ${MAX_MINIMUM_MINUTES} minutes`;
  }
  const days = settings.arrBridgeStagingRetentionDays;
  if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) {
    return `Sonarr / Radarr: keep staged files for 1 to ${MAX_RETENTION_DAYS} days`;
  }
  if (!isStagingPath(settings.arrBridgeStagingPath)) {
    return 'Sonarr / Radarr: the folder as Sonarr and Radarr see it must be an absolute path, like /downloads/.arr-staging';
  }
  return null;
}

export interface MatchingSummaryInput {
  looseMatching: boolean;
  minTvMinutes: number;
  minMovieMinutes: number;
  excludeCount: number;
  sonarrConnected: boolean;
  radarrConnected: boolean;
}

/** The matching rules in plain sentences, for the summary above the switches. */
export function describeMatching(input: MatchingSummaryInput): string[] {
  const sentences: string[] = [];
  if (input.looseMatching) {
    sentences.push(
      "An episode is offered when a video's title has the series name and the episode number in any common form, even without a season."
    );
    sentences.push("A movie is offered when a video's title has every word of its name, even without its year.");
  } else {
    sentences.push(
      "An episode is offered only when a video's title has the series name and the episode, written like S01E05, 1x05 or Season 1 Episode 5."
    );
    sentences.push("A movie is offered only when a video's title has every word of its name and its year.");
  }
  if (input.sonarrConnected) {
    sentences.push(
      "With your Sonarr connection, an upload titled with the episode's name is offered too, when its length fits the episode's runtime."
    );
  }
  if (input.radarrConnected) {
    sentences.push("With your Radarr connection, a movie's length must also fit the movie's runtime.");
  }
  if (input.excludeCount > 0) {
    const words = input.excludeCount === 1 ? 'the 1 excluded word ' : `one of the ${input.excludeCount} excluded words `;
    sentences.push(`A video with ${words}in its title is never offered.`);
  }
  const apps = [input.sonarrConnected ? 'Sonarr' : null, input.radarrConnected ? 'Radarr' : null].filter(Boolean);
  const runtimeNote = apps.length > 0 ? ` When ${apps.join(' or ')} knows the runtime, that decides instead.` : '';
  sentences.push(
    `Episodes shorter than ${input.minTvMinutes} minutes and movies shorter than ${input.minMovieMinutes} minutes are never offered.${runtimeNote}`
  );
  return sentences;
}
