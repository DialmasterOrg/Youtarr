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

export type ArrGrabState = 'waiting' | 'blocked' | 'downloading' | 'ready' | 'failed' | 'handed-off' | 'cancelled';

export type ArrLibraryCopy = 'checking' | 'removed' | 'kept';

export const LIBRARY_COPY_NOTES: Record<ArrLibraryCopy, string> = {
  checking: 'Asking Sonarr or Radarr whether it was imported, before Youtarr removes its own copy.',
  removed: 'Imported. Youtarr removed its own copy.',
  kept: 'Youtarr kept its copy: Sonarr or Radarr did not confirm the import through the connection in step 3.',
};

/**
 * "Remove after import" only removes a video once the app that grabbed it
 * confirms the import, so an app without a connection keeps every video.
 * @returns What to tell the user, or null when both apps are connected
 */
export function removeAfterImportWarning(connected: Record<ArrApp, boolean>): string | null {
  if (connected.sonarr && connected.radarr) return null;
  if (!connected.sonarr && !connected.radarr) {
    return 'Sonarr and Radarr are not connected in step 3. Youtarr cannot confirm an import without a connection, so it keeps every grabbed video.';
  }
  const app = connected.sonarr ? 'Radarr' : 'Sonarr';
  return `${app} is not connected in step 3. Youtarr cannot confirm its imports, so it keeps every video ${app} grabs.`;
}

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
  /** When YouTube first blocked this grab's own download; null for a grab that waits behind another grab's block. */
  blockedAt: string | null;
  /** For a blocked grab, when Youtarr next tries a waiting grab; null when a try is due. */
  nextTryAt: string | null;
  /** For a blocked grab, whether a "Try again" asked for it is still to be carried out. */
  retryRequested: boolean;
  /** For a blocked grab, whether downloads are paused by a storage limit. */
  downloadsPaused: boolean;
  /** For a failed grab, until when Youtarr leaves its video out of searches; null when it does not. */
  hiddenUntil: string | null;
  /** What "remove after import" did with Youtarr's copy; null when it was never asked. */
  libraryCopy: ArrLibraryCopy | null;
  createdAt: string;
  completedAt: string | null;
  removedAt: string | null;
}

type GrabTone = 'default' | 'info' | 'success' | 'warning' | 'error';

// Sonarr and Radarr remove an item after importing it and when it is removed
// there, with the same call, so "handed-off" cannot be called "Imported".
export const GRAB_STATE_LABELS: Record<ArrGrabState, { label: string; tone: GrabTone }> = {
  waiting: { label: 'Waiting to download', tone: 'default' },
  blocked: { label: 'Waiting: blocked by YouTube', tone: 'warning' },
  downloading: { label: 'Downloading', tone: 'info' },
  ready: { label: 'Ready to import', tone: 'warning' },
  failed: { label: 'Failed', tone: 'error' },
  'handed-off': { label: 'Taken by Sonarr/Radarr', tone: 'success' },
  cancelled: { label: 'Removed before it finished', tone: 'default' },
};

export const BLOCKED_GRAB_ADVICE =
  'This is often temporary. If it keeps happening, upload fresh YouTube cookies in Settings -> Cookies. To stop, remove it from the queue in Sonarr or Radarr.';

/**
 * Why a blocked grab waits and when Youtarr next tests the block. One
 * waiting grab is tried at a time, so that try may be another grab's: the
 * text promises a check, not this grab's turn.
 * @param grab - A grab in the `blocked` state
 * @param formatTime - How to show the time of the next try
 */
export function blockedGrabText(
  grab: Pick<ArrGrab, 'blockedAt' | 'nextTryAt' | 'downloadsPaused'>,
  formatTime: (value: string) => string
): string {
  const reason = grab.blockedAt
    ? 'YouTube blocked this download.'
    : 'YouTube blocked another grab, so this one waits too.';
  if (grab.downloadsPaused) return `${reason} Youtarr checks again when downloads resume.`;
  const time = grab.nextTryAt ? formatTime(grab.nextTryAt) : '';
  return `${reason} ${time ? `Youtarr checks again at ${time}.` : 'Youtarr checks again soon.'}`;
}

/**
 * What to say on a blocked grab whose "Try again" is still to be carried
 * out. The server says so, which keeps the note true after a reload and
 * drops it once the try was made.
 * @returns The note, or null when no try is asked for
 */
export function requestedRetryNote(grab: Pick<ArrGrab, 'retryRequested' | 'downloadsPaused'>): string | null {
  if (!grab.retryRequested) return null;
  return grab.downloadsPaused
    ? 'Downloads are paused, so this will start when they resume.'
    : 'Youtarr will try again in a moment.';
}

/** What "Try again" on a blocked grab led to: the server's answers, plus the two ways the request can fail. */
export type ArrGrabRetryOutcome = 'started' | 'queued' | 'paused' | 'ready' | 'deferred' | 'not-waiting' | 'failed';

export const SERVER_RETRY_OUTCOMES: ArrGrabRetryOutcome[] = ['started', 'queued', 'paused', 'ready', 'deferred'];

// What the browser says right after a "Try again". `state` is the grab state
// the note belongs to: once the grab is in another state, the row's own text
// tells the newer story. "paused" has no note here: the server reports that
// try as still asked for (see requestedRetryNote).
export const GRAB_RETRY_NOTES: Record<Exclude<ArrGrabRetryOutcome, 'paused'>, { text: string; state: ArrGrabState }> = {
  started: { text: 'Trying again now.', state: 'downloading' },
  queued: { text: 'Queued. It starts when the current download finishes.', state: 'downloading' },
  ready: { text: 'The video is already in your Youtarr library, so it is ready to import.', state: 'ready' },
  deferred: { text: 'Youtarr could not start it right now. It waits for the next check.', state: 'blocked' },
  'not-waiting': { text: 'This grab is no longer waiting. Refresh the list.', state: 'blocked' },
  failed: { text: 'Could not try again. Try once more in a moment.', state: 'blocked' },
};

/**
 * What to say on a grab's row about its last "Try again" in this browser.
 * @returns The note, or null when there is none for the state the grab is in now
 */
export function grabRetryNote(grab: Pick<ArrGrab, 'state'>, outcome: ArrGrabRetryOutcome | undefined): string | null {
  if (!outcome || outcome === 'paused') return null;
  const note = GRAB_RETRY_NOTES[outcome];
  return note.state === grab.state ? note.text : null;
}

export function hiddenGrabNote(hiddenUntil: string, formatDate: (value: string) => string): string {
  return `This release is now blocklisted in Sonarr or Radarr, and Youtarr will not offer this video again until ${formatDate(hiddenUntil)}.`;
}

export interface ArrSetupValues {
  indexerUrl: string;
  apiPath: string;
  host: string;
  port: string;
  useSsl: boolean;
  urlBase: string;
}

/** Where Sonarr and Radarr run, which decides the address they reach Youtarr at. */
export type ArrLocation = 'docker' | 'elsewhere';

// The container name in Youtarr's compose file, and the port it listens on
// inside Docker whatever port is published.
export const YOUTARR_CONTAINER_NAME = 'youtarr';
export const YOUTARR_CONTAINER_PORT = '3011';
const DOCKER_ORIGIN = { protocol: 'http:', hostname: YOUTARR_CONTAINER_NAME, port: YOUTARR_CONTAINER_PORT };

/**
 * The values to type into Sonarr and Radarr. Apps in Docker on Youtarr's
 * network reach it by container name; anything else uses the address this
 * page is open at.
 */
export function getSetupValues(
  pageOrigin: { protocol: string; hostname: string; port: string },
  location: ArrLocation = 'elsewhere'
): ArrSetupValues {
  const origin = location === 'docker' ? DOCKER_ORIGIN : pageOrigin;
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

const DEFAULT_RELEASE_RESOLUTION = 1080;

// Sonarr and Radarr have a quality for 2160, 1080, 720 and 480 only.
function resolutionTier(height: number): number {
  if (height >= 2160) return 2160;
  if (height >= 1080) return 1080;
  if (height >= 720) return 720;
  return 480;
}

/**
 * The highest resolution a release is labeled with, as the server works it
 * out: a release carries the video's real resolution, up to this.
 * @param bridgeResolution - arrBridgeResolution; empty follows the preferred one
 * @param preferredResolution - The preferredResolution setting
 * @param labelLimit - arrBridgeLabelLimit; empty for no limit
 */
export function releaseResolution(bridgeResolution: string, preferredResolution: string, labelLimit: string): number {
  const height = Number.parseInt(bridgeResolution || preferredResolution, 10);
  const download = Number.isFinite(height) ? resolutionTier(height) : DEFAULT_RELEASE_RESOLUTION;
  const limit = Number.parseInt(labelLimit, 10);
  return Number.isFinite(limit) ? Math.min(download, resolutionTier(limit)) : download;
}

const STAGING_FOLDER_NAME = '.arr-staging';

/**
 * The staging folder as the user knows it: inside the downloads folder they
 * configured, not the path inside Youtarr's container.
 */
export function stagingFolderOnHost(downloadsFolder: string | null | undefined): string | null {
  const folder = (downloadsFolder ?? '').trim().replace(/\/+$/, '');
  return folder ? `${folder}/${STAGING_FOLDER_NAME}` : null;
}

/** What a shared-folder check answered (GET /api/arr-bridge/connections/:app/shared-folder). */
export interface ArrFolderCheck {
  ok: boolean;
  visible?: boolean;
  /** The path the app is told, which is the one that was asked about. */
  path?: string;
  /** Set when the app sees the folder through a Remote Path Mapping of its own. */
  via?: 'mapping';
  /** Where the app says it runs, when it does not see the folder. */
  runsIn?: 'docker' | 'windows' | 'other';
  /** A path the app does see the folder under. */
  suggestedPath?: string;
  reason?: string;
  message?: string;
}

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  tv: 'TV grabs are saved to',
  movies: 'Movie grabs are saved to',
};

export function categoryRowLabel(name: string): string {
  return DEFAULT_CATEGORY_LABELS[name] ?? `Grabs in category ${name} are saved to`;
}

/** Whether the categories are still the two Youtarr starts with. */
export function hasOnlyDefaultCategories(categories: ArrCategory[]): boolean {
  const names = categories.map((category) => category.name).sort();
  return names.length === 2 && names[0] === 'movies' && names[1] === 'tv';
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

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const WINDOWS_SHARE_PREFIX = '\\\\';
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;

function hasControlCharacter(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < FIRST_PRINTABLE_CODE || code === DELETE_CODE) return true;
  }
  return false;
}

// A drive needs a folder on it; a share needs its server and its name.
function isWindowsStagingPath(path: string): boolean {
  const share = path.startsWith(WINDOWS_SHARE_PREFIX);
  const segments = path
    .slice(share ? WINDOWS_SHARE_PREFIX.length : 0)
    .replace(/[\s\\/]+$/, '')
    .split(/[\\/]+/);
  return segments.length >= 2 && segments.every((segment) => segment !== '' && segment !== '..');
}

// The server's rule for the staging path (modules/arrBridge/clientPaths.js):
// empty, or an absolute path without "..", on Linux or macOS ("/data/x"), on
// a Windows drive ("E:\x") or on a Windows share ("\\nas\x").
function isStagingPath(value: string): boolean {
  const path = value.trim();
  if (path === '') return true;
  if (path.length > MAX_STAGING_PATH_LENGTH || hasControlCharacter(path)) return false;
  if (WINDOWS_DRIVE_PATH.test(path) || path.startsWith(WINDOWS_SHARE_PREFIX)) return isWindowsStagingPath(path);
  if (!path.startsWith('/') || path.split('/').includes('..')) return false;
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
    return `Sonarr / Radarr: remove files nobody imported after 1 to ${MAX_RETENTION_DAYS} days`;
  }
  if (!isStagingPath(settings.arrBridgeStagingPath)) {
    return "Sonarr / Radarr: the folder's path inside Sonarr and Radarr must be an absolute path, like /downloads/.arr-staging or E:\\Youtube\\.arr-staging";
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
