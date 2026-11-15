// Answers the SABnzbd API modes Sonarr and Radarr call. Every answer is HTTP
// 200 with a JSON body: a non-2xx marks the whole download client
// unavailable in the apps.
const { isAuthorized, readSettings } = require('./arrBridgeConfig');
const { parseNzb } = require('./nzbFile');
const responses = require('./sabnzbdResponses');

const PLAIN_MODE_PATTERN = /^[a-z_]{1,30}$/;
// Sonarr's Test looks for this exact text.
const WRONG_KEY_MESSAGE = 'API Key Incorrect';
const NOT_OURS_MESSAGE = 'Not a Youtarr NZB';

const ok = (json) => ({ status: 200, json });
const splitIds = (value) => (typeof value === 'string' ? value.split(',').map((id) => id.trim()).filter(Boolean) : []);

/**
 * @param {Object} deps
 * @param {Function} deps.getConfig - () => the full config
 * @param {Object} deps.grabService
 * @param {Object} deps.staging
 * @param {Function} deps.getActivity - () => downloadModule.getCurrentActivitySnapshot()
 * @param {Function} deps.isPaused - () => downloads are paused by the storage guard
 */
function createSabnzbdApi({ getConfig, grabService, staging, getActivity, isPaused }) {
  const completeDir = () => staging.clientPath(staging.stagingRoot());

  async function handleQueue(param) {
    if (param('name') === 'delete') {
      const ids = splitIds(param('value'));
      for (const id of ids) await grabService.removeFromQueue(id);
      return { status: true, nzo_ids: ids };
    }
    return responses.queue({
      grabs: await grabService.listQueue(param('category')),
      activity: getActivity(),
      paused: isPaused(),
    });
  }

  async function handleHistory(param) {
    if (param('name') === 'delete') {
      for (const id of splitIds(param('value'))) await grabService.removeFromHistory(id);
      return { status: true };
    }
    return responses.history({
      grabs: await grabService.listHistory(param('category'), param('limit')),
      storagePathFor: (grab) => (grab.staged_path ? staging.clientPath(grab.staged_path) : ''),
    });
  }

  async function handleAddFile(param, file) {
    const fields = file?.buffer ? parseNzb(file.buffer) : null;
    if (!fields) return responses.error(NOT_OURS_MESSAGE);
    const result = await grabService.addGrab({ fields, category: param('cat') });
    return result.error ? responses.error(result.error) : responses.added(result.id);
  }

  /**
   * @param {Object} request
   * @param {Object} request.query - req.query
   * @param {Object} [request.body] - Text fields of a multipart upload
   * @param {Object} [request.file] - The uploaded NZB ({ buffer })
   * @returns {Promise<{status: number, json: Object}>}
   */
  async function handle({ query, body, file }) {
    // The apps send everything in the query; the SABnzbd API also accepts
    // form fields. Arrays and objects from the parser count as absent.
    const param = (name) => {
      const value = query?.[name] ?? body?.[name];
      return typeof value === 'string' ? value : null;
    };
    const mode = param('mode');
    // Real SABnzbd answers this without a key, and the apps ask it first.
    if (mode === 'version') return ok(responses.version());

    const config = getConfig();
    if (!isAuthorized(config, param('apikey'))) return ok(responses.error(WRONG_KEY_MESSAGE));

    switch (mode) {
    case 'get_config':
      return ok(responses.getConfig({ completeDir: completeDir(), categories: readSettings(config).categories }));
    case 'fullstatus':
      return ok(responses.fullStatus({ completeDir: completeDir() }));
    case 'queue':
      return ok(await handleQueue(param));
    case 'history':
      return ok(await handleHistory(param));
    case 'addfile':
      return ok(await handleAddFile(param, file));
    default:
      return ok(responses.error(
        mode && PLAIN_MODE_PATTERN.test(mode) ? `Mode ${mode} is not supported` : 'Mode is not supported'
      ));
    }
  }

  return { handle };
}

module.exports = { createSabnzbdApi, WRONG_KEY_MESSAGE };
