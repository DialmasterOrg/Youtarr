// The Sonarr/Radarr bridge: a Newznab indexer and a SABnzbd download client
// that Sonarr and Radarr can add with their stock settings screens.
const { createArrBridgeService } = require('./arrBridgeService');
const arrBridgeConfig = require('./arrBridgeConfig');
const { XML_CONTENT_TYPE, ERROR_SEARCH_UNAVAILABLE, SEARCH_UNAVAILABLE_MESSAGE } = require('./newznabApi');
const { renderError } = require('./newznabXml');
const { MAX_NZB_BYTES } = require('./nzbFile');
const { WRONG_KEY_MESSAGE } = require('./sabnzbdApi');
const sabnzbdResponses = require('./sabnzbdResponses');

module.exports = {
  createArrBridgeService,
  arrBridgeConfig,
  sabnzbdResponses,
  renderError,
  XML_CONTENT_TYPE,
  ERROR_SEARCH_UNAVAILABLE,
  SEARCH_UNAVAILABLE_MESSAGE,
  MAX_NZB_BYTES,
  WRONG_KEY_MESSAGE,
};
