// What the Settings page reads and changes outside /updateconfig: the bridge
// key, and the connections to the user's own Sonarr and Radarr. Both are
// server-owned, so a Settings save from a stale tab can never undo them.
const {
  CONNECTION_KEYS, generateKey, normalizeArrUrl, parseConnectionInput, readSettings,
} = require('./arrBridgeConfig');
const { applyMapping, hostPathCandidates } = require('./clientPaths');
const { PLACEHOLDER_TITLES } = require('./searchService');

const APP_NAMES = Object.freeze({ sonarr: 'Sonarr', radarr: 'Radarr' });
// Nothing else of the app's answer is passed on, so the connection test
// cannot be used to read a page the server can reach and the caller cannot.
const VERSION_PATTERN = /^[0-9][0-9.]{0,30}$/;
const UNREACHABLE = 'unreachable';
// The shared folder check asks the app about a few paths besides the one it
// is told: at most this many through its mappings, and as many guesses.
const MAX_EXTRA_PATHS = 3;

const isApp = (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(APP_NAMES, value);

// How a request that got no answer failed, by the error code of the attempt.
const NAME_NOT_FOUND_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN']);
const REFUSED_CODES = new Set(['ECONNREFUSED']);
const NO_ANSWER_CODES = new Set(['ERR_CANCELED', 'ECONNABORTED', 'ETIMEDOUT']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// "Could not reach" alone does not say what to change. A name that does not
// resolve, localhost (which is Youtarr's own container) and an address that
// never answers each need a different fix, and Docker setups meet all three.
function unreachableMessage(appName, { code, url } = {}) {
  const host = hostOf(url);
  if (NAME_NOT_FOUND_CODES.has(code)) {
    return `Youtarr could not find a server called "${host}". From Docker, another container's name only works when both containers are on the same network.`;
  }
  const refused = REFUSED_CODES.has(code);
  const noAnswer = NO_ANSWER_CODES.has(code);
  if ((refused || noAnswer) && LOOPBACK_HOSTS.has(host)) {
    return `Nothing answers at that address. Youtarr runs in a container, where localhost is Youtarr itself: use the name or IP address of the machine ${appName} runs on.`;
  }
  if (refused) return `Nothing answers at that address. Check the port, and that ${appName} is running.`;
  if (noAnswer) {
    return `${appName} did not answer in time. Check that Youtarr's container can reach that address: a port published only on the host's localhost cannot be reached from a container.`;
  }
  return `Could not reach ${appName} at that address.`;
}

const FAILURE_MESSAGES = {
  unauthorized: (appName) => `${appName} rejected the API key.`,
  redirect: () => 'The address answers with a redirect. Use the address it redirects to.',
  'not-json': (appName) => `The address did not answer like ${appName}. It may be a login page or another app.`,
  'not-configured': (appName) => `No ${appName} connection is saved.`,
  'lookup-failed': (appName) => `${appName} answered, but could not look up a title. Check that the address points at ${appName} itself and that its version is current.`,
  [UNREACHABLE]: unreachableMessage,
};

// A reason this module does not know reads as unreachable.
function failure(reason, appName, details) {
  const known = Object.prototype.hasOwnProperty.call(FAILURE_MESSAGES, reason) ? reason : UNREACHABLE;
  return { ok: false, reason: known, message: FAILURE_MESSAGES[known](appName, details) };
}

// Where the app says it runs, which decides what advice fits: a volume only
// helps an app in Docker. Null when it did not say.
function whereAppRuns(status) {
  if (typeof status?.isDocker !== 'boolean' || typeof status?.isWindows !== 'boolean') return null;
  if (status.isDocker) return 'docker';
  return status.isWindows ? 'windows' : 'other';
}

/**
 * @param {Object} deps
 * @param {Object} deps.configModule
 * @param {Object} deps.client - arrClient
 * @param {Object} deps.staging
 * @param {Function} [deps.getHostDownloadsFolder] - () => the downloads folder as the
 *   host knows it, or null; an app outside Docker may see the staging folder inside it
 * @param {Object} deps.logger
 */
function createArrBridgeSettings({
  configModule, client, staging, getHostDownloadsFolder = () => null, logger,
}) {
  const getConfig = () => configModule.getConfig();
  // updateConfig replaces the whole config.
  const save = (changes) => configModule.updateConfig({ ...getConfig(), ...changes });

  function saveNewKey() {
    const key = generateKey();
    save({ arrBridgeApiKey: key });
    return key;
  }

  /**
   * The key is stored unhashed so Settings can show it again, like the feed
   * token, and is never written to a log.
   * @returns {string}
   */
  function getOrCreateKey() {
    const existing = readSettings(getConfig()).apiKey;
    if (existing) return existing;
    const key = saveNewKey();
    logger.info({ event: 'arr_bridge_key_created' }, 'Created the Sonarr/Radarr bridge key');
    return key;
  }

  function regenerateKey() {
    const key = saveNewKey();
    logger.info({ event: 'arr_bridge_key_regenerated' }, 'Replaced the Sonarr/Radarr bridge key');
    return key;
  }

  // The address as it is used, and whether a usable key is stored with it.
  function connectionView(app) {
    const stored = readSettings(getConfig())[app];
    if (stored) return { url: stored.url, keySet: true };
    return { url: normalizeArrUrl(getConfig()[CONNECTION_KEYS[app].url]), keySet: false };
  }

  function getStatus() {
    const stagingRoot = staging.stagingRoot();
    return {
      enabled: readSettings(getConfig()).enabled,
      stagingRoot,
      stagingClientPath: staging.clientPath(stagingRoot),
      connections: { sonarr: connectionView('sonarr'), radarr: connectionView('radarr') },
    };
  }

  // Asks the address who it is. The answer must be the app this slot is for:
  // a Radarr saved as Sonarr would answer every series lookup with nothing.
  async function check(app, connection) {
    const appName = APP_NAMES[app];
    let status;
    try {
      status = await client.fetchStatus(connection);
    } catch (error) {
      const reason = typeof error?.reason === 'string' ? error.reason : UNREACHABLE;
      const code = typeof error?.code === 'string' ? error.code : null;
      // Never the error object: an HTTP client's error holds the key.
      logger.info({ app, reason, code }, 'Sonarr/Radarr connection test failed');
      return failure(reason, appName, { code, url: connection.url });
    }
    if (status.appName.toLowerCase() !== app) {
      const other = Object.values(APP_NAMES).find((name) => name.toLowerCase() === status.appName.toLowerCase());
      logger.info({ app, reason: 'wrong-app' }, 'Sonarr/Radarr connection test failed');
      return {
        ok: false,
        reason: 'wrong-app',
        message: `That address belongs to ${other || 'another app'}, not ${appName}.`,
      };
    }
    // A search resolves its series through this call, so a connection that
    // only answers system/status is not usable. Not knowing the placeholder
    // is the normal answer; only a failed call fails the test.
    try {
      if (app === 'sonarr') await client.fetchParsedEpisode(connection, PLACEHOLDER_TITLES.tv);
      else await client.fetchParsedMovie(connection, PLACEHOLDER_TITLES.movie);
    } catch (error) {
      const reason = typeof error?.reason === 'string' ? error.reason : UNREACHABLE;
      const code = typeof error?.code === 'string' ? error.code : null;
      // Never the error object: an HTTP client's error holds the key.
      logger.info({ app, reason, code }, 'Sonarr/Radarr connection test failed on the lookup');
      return failure('lookup-failed', appName);
    }
    return { ok: true, appName, version: VERSION_PATTERN.test(status.version) ? status.version : '' };
  }

  /**
   * Tests an address and key, and stores both when the app answers. The
   * stored key is never read here: it may only ever be sent to the address
   * stored beside it, so a new address always comes with its own key.
   * @param {'sonarr'|'radarr'} app
   * @param {{url: unknown, apiKey: unknown}} input
   * @returns {Promise<{error: string}|{ok: false, reason: string, message: string}|
   *   {ok: true, appName: string, version: string, connection: {url: string, keySet: boolean}}>}
   */
  async function saveConnection(app, input) {
    const parsed = parseConnectionInput(input?.url, input?.apiKey);
    if (parsed.error) return { error: parsed.error };
    const result = await check(app, parsed.connection);
    if (!result.ok) return result;
    save({
      [CONNECTION_KEYS[app].url]: parsed.connection.url,
      [CONNECTION_KEYS[app].apiKey]: parsed.connection.apiKey,
    });
    logger.info({ app }, 'Saved a Sonarr/Radarr connection');
    return { ...result, connection: connectionView(app) };
  }

  /**
   * @param {'sonarr'|'radarr'} app
   * @returns {Promise<{ok: false, reason: string, message: string}|{ok: true, appName: string, version: string}>}
   */
  async function testStoredConnection(app) {
    const stored = readSettings(getConfig())[app];
    if (!stored) return failure('not-configured', APP_NAMES[app]);
    return check(app, stored);
  }

  /**
   * Whether the app sees the staging folder under the path it is told. The
   * proof is one of the category folders Youtarr keeps there, so another
   * folder that happens to exist at that path does not pass. When it does
   * not, the app is asked a little more: whether a Remote Path Mapping of
   * its own leads to the folder, where it runs, and whether it sees the
   * folder where the host has it. Nothing the app listed or named leaves
   * this function, only verdicts and a path Youtarr built itself.
   * @param {'sonarr'|'radarr'} app
   * @returns {Promise<{ok: false, reason: string, message: string}|
   *   {ok: true, visible: boolean, path: string, via?: 'mapping',
   *   runsIn?: 'docker'|'windows'|'other', suggestedPath?: string}>}
   */
  async function checkSharedFolder(app) {
    const appName = APP_NAMES[app];
    const { [app]: stored, categories } = readSettings(getConfig());
    if (!stored) return failure('not-configured', appName);
    const folderPath = staging.clientPath(staging.stagingRoot());
    const sees = async (candidatePath) => {
      const names = await client.fetchFolderNames(stored, candidatePath);
      return categories.some((category) => names.includes(category.name));
    };
    try {
      if (await sees(folderPath)) return { ok: true, visible: true, path: folderPath };
    } catch (error) {
      const reason = typeof error?.reason === 'string' ? error.reason : UNREACHABLE;
      const code = typeof error?.code === 'string' ? error.code : null;
      // Never the error object: an HTTP client's error holds the key.
      logger.info({ app, reason, code }, 'Sonarr/Radarr shared folder check failed');
      return failure(reason, appName, { code, url: stored.url });
    }

    // The app answered and does not see the folder there. What follows only
    // adds to that answer, so a question that fails ends the asking and is
    // no failed check.
    let stillAsking = true;
    const ask = async (question, fallback) => {
      if (!stillAsking) return fallback;
      try {
        return await question();
      } catch (error) {
        stillAsking = false;
        const reason = typeof error?.reason === 'string' ? error.reason : UNREACHABLE;
        logger.info({ app, reason }, 'Sonarr/Radarr shared folder check could not ask further');
        return fallback;
      }
    };

    const seenThroughMapping = await ask(async () => {
      const hosts = (await client.fetchBridgeClientHosts(stored)).map((host) => host.toLowerCase());
      if (hosts.length === 0) return false;
      const mappedPaths = (await client.fetchRemotePathMappings(stored))
        .filter((mapping) => hosts.includes(mapping.host.trim().toLowerCase()))
        .map((mapping) => applyMapping(folderPath, mapping))
        .filter(Boolean)
        .slice(0, MAX_EXTRA_PATHS);
      for (const mappedPath of mappedPaths) {
        if (await sees(mappedPath)) return true;
      }
      return false;
    }, false);
    // Only that it passed: the mapped path is the app's own answer.
    if (seenThroughMapping) return { ok: true, visible: true, path: folderPath, via: 'mapping' };

    const status = await ask(() => client.fetchStatus(stored), null);
    const runsIn = whereAppRuns(status);
    const suggestedPath = await ask(async () => {
      const guesses = [
        ...hostPathCandidates(getHostDownloadsFolder(), { windows: runsIn === 'windows' }),
        // With a path of its own entered, the app may still see Youtarr's.
        ...(runsIn === 'windows' ? [] : [staging.stagingRoot()]),
      ];
      const untried = [...new Set(guesses)].filter((guess) => guess !== folderPath).slice(0, MAX_EXTRA_PATHS);
      for (const guess of untried) {
        if (await sees(guess)) return guess;
      }
      return null;
    }, null);

    return {
      ok: true,
      visible: false,
      path: folderPath,
      ...(runsIn ? { runsIn } : {}),
      // A path Youtarr built from its own settings, never one the app named.
      ...(suggestedPath ? { suggestedPath } : {}),
    };
  }

  function removeConnection(app) {
    const next = { ...getConfig() };
    delete next[CONNECTION_KEYS[app].url];
    delete next[CONNECTION_KEYS[app].apiKey];
    configModule.updateConfig(next);
    logger.info({ app }, 'Removed a Sonarr/Radarr connection');
    return connectionView(app);
  }

  return {
    isApp,
    getOrCreateKey,
    regenerateKey,
    getStatus,
    saveConnection,
    testStoredConnection,
    checkSharedFolder,
    removeConnection,
  };
}

module.exports = { createArrBridgeSettings };
