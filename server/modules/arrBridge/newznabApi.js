// Answers the Newznab endpoint and the carrier NZB link. Returns plain
// response descriptions so the route stays thin.
const { isAuthorized } = require('./arrBridgeConfig');
const { parseNewznabRequest } = require('./newznabRequest');
const { renderCaps, renderError, renderSearch } = require('./newznabXml');
const { buildNzb, parseNzbLink } = require('./nzbFile');
const { SearchUnavailableError } = require('./searchQueue');

const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';
const NZB_CONTENT_TYPE = 'application/x-nzb';
const ERROR_INCORRECT_CREDENTIALS = 100;
// Sonarr and Radarr disable the indexer for a minute or more after any
// error, so this is only for a search that really could not run. An empty
// page would read as "nothing on YouTube", and a 429 costs far more.
const ERROR_SEARCH_UNAVAILABLE = 900;
const SEARCH_UNAVAILABLE_MESSAGE = 'Youtarr could not search YouTube right now';

const xml = (body) => ({ status: 200, contentType: XML_CONTENT_TYPE, body });
const NOT_FOUND = Object.freeze({ status: 404 });

/**
 * @param {Object} deps
 * @param {Function} deps.getConfig - () => the full config
 * @param {Object} deps.searchService
 * @param {Object} deps.logger
 */
function createNewznabApi({ getConfig, searchService, logger }) {
  /**
   * Errors are Newznab error documents with HTTP 200, which the apps show
   * as text; a non-2xx only reads as "indexer unavailable".
   * @param {Object} query - req.query
   * @param {string} origin - Scheme and host the client used
   * @returns {Promise<{status: number, contentType: string, body: string}>}
   */
  async function handleApi(query, origin) {
    const source = query && typeof query === 'object' ? query : {};
    const authorized = isAuthorized(getConfig(), source.apikey);
    // Caps is public in Newznab, but the apps send the key with it, and a
    // wrong one is best reported where the user is looking: the indexer Test.
    const isCaps = source.t === 'caps';
    if (isCaps ? source.apikey !== undefined && !authorized : !authorized) {
      return xml(renderError(ERROR_INCORRECT_CREDENTIALS, 'Incorrect user credentials'));
    }

    const parsed = parseNewznabRequest(source);
    if (!parsed.ok) return xml(renderError(parsed.code, parsed.description));
    if (parsed.request.shape === 'caps') return xml(renderCaps());

    try {
      return xml(renderSearch(await searchService.search(parsed.request, origin)));
    } catch (error) {
      if (!(error instanceof SearchUnavailableError)) throw error;
      logger.warn(
        { err: error.cause, reason: error.reason, shape: parsed.request.shape },
        'Sonarr/Radarr search could not run'
      );
      return xml(renderError(ERROR_SEARCH_UNAVAILABLE, SEARCH_UNAVAILABLE_MESSAGE));
    }
  }

  /**
   * @param {string} fileParam - The decoded "<release title>.nzb" path segment
   * @param {Object} query - req.query
   * @returns {{status: number, contentType?: string, filename?: string, body?: string}}
   */
  function handleNzb(fileParam, query) {
    if (!isAuthorized(getConfig(), query?.apikey)) return NOT_FOUND;
    const fields = parseNzbLink(fileParam, query);
    if (!fields) return NOT_FOUND;
    return {
      status: 200,
      contentType: NZB_CONTENT_TYPE,
      filename: `${fields.releaseTitle}.nzb`,
      body: buildNzb(fields),
    };
  }

  return { handleApi, handleNzb };
}

module.exports = {
  createNewznabApi,
  XML_CONTENT_TYPE,
  ERROR_SEARCH_UNAVAILABLE,
  SEARCH_UNAVAILABLE_MESSAGE,
};
