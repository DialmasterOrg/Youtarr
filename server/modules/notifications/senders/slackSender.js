/**
 * Slack webhook sender
 */

const https = require('https');
const { URL } = require('url');

/**
 * Send a message to a Slack webhook
 * @param {string} webhookUrl - The Slack webhook URL
 * @param {Object} message - The message payload with blocks
 * @returns {Promise<void>}
 */
async function send(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(webhookUrl);
      const payload = JSON.stringify(message);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            const errorDetail = parseError(res.statusCode, data);
            reject(new Error(errorDetail));
          }
        });
      });

      req.on('error', (error) => {
        if (error.code === 'ENOTFOUND') {
          reject(new Error('Slack server not reachable - check your internet connection'));
        } else if (error.code === 'ECONNREFUSED') {
          reject(new Error('Connection refused by Slack'));
        } else {
          reject(new Error(`Network error: ${error.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out - Slack may be slow or unreachable'));
      });

      req.write(payload);
      req.end();
    } catch (error) {
      reject(new Error(`Invalid Slack webhook URL: ${error.message}`));
    }
  });
}

/**
 * Parse Slack API error response for user-friendly messages
 * @param {number} statusCode - HTTP status code
 * @param {string} data - Response body
 * @returns {string} Human-readable error message
 */
function parseError(statusCode, data) {
  // Slack often returns plain text error messages
  const errorText = data.trim().toLowerCase();

  if (errorText === 'no_service' || errorText === 'invalid_payload') {
    return 'Invalid webhook URL or payload format';
  }
  if (errorText === 'channel_not_found') {
    return 'Slack channel not found - it may have been deleted';
  }
  if (errorText === 'channel_is_archived') {
    return 'Slack channel is archived';
  }
  if (errorText === 'posting_to_general_channel_denied') {
    return 'Cannot post to #general - webhook may not have permission';
  }
  if (errorText === 'token_revoked' || statusCode === 401) {
    return 'Webhook token has been revoked';
  }

  switch (statusCode) {
  case 400:
    return `Bad request: ${data || 'invalid message format'}`;
  case 403:
    return 'Forbidden - webhook may have been disabled';
  case 404:
    return 'Webhook not found - URL may be invalid';
  case 410:
    return 'Webhook has been deleted';
  case 429:
    return 'Rate limited by Slack - try again later';
  case 500:
  case 502:
  case 503:
    return 'Slack server error - try again later';
  default:
    return `Slack error ${statusCode}${data ? ': ' + data.substring(0, 100) : ''}`;
  }
}

module.exports = {
  send,
  parseError
};

