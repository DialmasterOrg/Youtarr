/**
 * Discord webhook sender
 */

const https = require('https');
const { URL } = require('url');

/**
 * Convert discord:// Apprise URL to https:// webhook URL
 * @param {string} url - The URL (discord:// or https://)
 * @returns {string} The https:// webhook URL
 */
function convertToHttpUrl(url) {
  // If it's already an HTTP URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Convert discord://WEBHOOK_ID/TOKEN to https://discord.com/api/webhooks/WEBHOOK_ID/TOKEN
  if (url.startsWith('discord://')) {
    const parts = url.replace('discord://', '').split('/');
    if (parts.length >= 2) {
      const webhookId = parts[0];
      const token = parts.slice(1).join('/');
      return `https://discord.com/api/webhooks/${webhookId}/${token}`;
    }
  }

  throw new Error('Invalid Discord URL format');
}

/**
 * Send a message to a Discord webhook
 * @param {string} webhookUrl - The Discord webhook URL (supports both discord:// and https://)
 * @param {Object} message - The message payload
 * @returns {Promise<void>}
 */
async function send(webhookUrl, message) {
  return new Promise((resolve, reject) => {
    try {
      // Convert discord:// to https:// if needed
      const httpUrl = convertToHttpUrl(webhookUrl);
      const url = new URL(httpUrl);

      if (!url.hostname.includes('discord')) {
        throw new Error('Invalid Discord webhook URL');
      }

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
          reject(new Error('Discord server not reachable - check your internet connection'));
        } else if (error.code === 'ECONNREFUSED') {
          reject(new Error('Connection refused by Discord'));
        } else {
          reject(new Error(`Network error: ${error.message}`));
        }
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out - Discord may be slow or unreachable'));
      });

      req.write(payload);
      req.end();
    } catch (error) {
      reject(new Error(`Invalid webhook URL: ${error.message}`));
    }
  });
}

/**
 * Parse Discord API error response for user-friendly messages
 * @param {number} statusCode - HTTP status code
 * @param {string} data - Response body
 * @returns {string} Human-readable error message
 */
function parseError(statusCode, data) {
  // Try to parse JSON error response from Discord
  try {
    const errorJson = JSON.parse(data);
    if (errorJson.message) {
      if (statusCode === 401) {
        return `Unauthorized: ${errorJson.message} - webhook token may be invalid`;
      }
      if (statusCode === 404) {
        return `Webhook not found: ${errorJson.message} - URL may be invalid or deleted`;
      }
      if (statusCode === 429) {
        const retryAfter = errorJson.retry_after ? ` (retry after ${errorJson.retry_after}s)` : '';
        return `Rate limited by Discord${retryAfter}`;
      }
      return `Discord error: ${errorJson.message}`;
    }
  } catch {
    // Not JSON, use raw data
  }

  // Fallback based on status code
  switch (statusCode) {
  case 400:
    return 'Bad request - message format may be invalid';
  case 401:
    return 'Unauthorized - webhook token is invalid';
  case 403:
    return 'Forbidden - webhook may have been revoked';
  case 404:
    return 'Webhook not found - URL may be invalid or deleted';
  case 429:
    return 'Rate limited - too many requests to Discord';
  case 500:
  case 502:
  case 503:
    return 'Discord server error - try again later';
  default:
    return `Discord returned error ${statusCode}${data ? ': ' + data.substring(0, 100) : ''}`;
  }
}

module.exports = {
  send,
  convertToHttpUrl,
  parseError
};

