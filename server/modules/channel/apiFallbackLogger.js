const logger = require('../../logger');
const youtubeApi = require('../youtubeApi');

// Log API-fallback events at the right level: warn for genuine failures
// (network/quota/etc), debug for "we knew the API path couldn't handle this
// channel" cases like a non-UC channel ID. Keeps warn-level signal high.
function logApiFallback(apiErr, fields, message) {
  const isShape = apiErr?.code === youtubeApi.YoutubeApiErrorCode.INVALID_CHANNEL_ID;
  const payload = { err: apiErr, ...fields, code: apiErr?.code };
  if (isShape) {
    logger.debug(payload, message);
  } else {
    logger.warn(payload, message);
  }
}

module.exports = { logApiFallback };
