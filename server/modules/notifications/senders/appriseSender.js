/**
 * Apprise CLI sender
 */

const { spawn } = require('child_process');
const logger = require('../../../logger');

const APPRISE_TIMEOUT_MS = 30000;

/**
 * Run the Apprise CLI for one message
 * @param {string} title - The notification title
 * @param {string} body - The notification body
 * @param {Array<string>} urls - Array of Apprise-compatible URLs
 * @param {string|null} [input] - Apprise input format (-i): 'markdown' or 'html'; plain text when null
 * @returns {Promise<void>}
 */
async function runApprise(title, body, urls, input = null) {
  if (!urls || urls.length === 0) {
    throw new Error('No notification URLs provided');
  }

  const inputFormat = input ?? 'text';

  return new Promise((resolve, reject) => {
    // Use -vv for verbose output to get more error details
    const args = ['-vv', ...(input ? ['-i', input] : []), '-t', title, '-b', body, ...urls];

    logger.debug({ urlCount: urls.length, inputFormat }, 'Sending Apprise notification');

    const proc = spawn('apprise', args, { timeout: APPRISE_TIMEOUT_MS });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.debug({ stdout: stdout.trim(), inputFormat }, 'Apprise notification sent successfully');
        resolve();
      } else {
        const errorMsg = parseError(code, stdout, stderr);
        logger.error({ code, stderr: stderr.trim(), stdout: stdout.trim(), inputFormat }, 'Apprise notification failed');
        reject(new Error(errorMsg));
      }
    });

    proc.on('error', (error) => {
      logger.error({ err: error }, 'Failed to spawn Apprise process');
      if (error.code === 'ENOENT') {
        reject(new Error('Apprise is not installed or not in PATH'));
      } else {
        reject(new Error(`Failed to run Apprise: ${error.message}`));
      }
    });
  });
}

/** Send a plain text notification. Arguments as in runApprise. */
function send(title, body, urls) {
  return runApprise(title, body, urls);
}

/** Send a notification with a Markdown body. */
function sendMarkdown(title, body, urls) {
  return runApprise(title, body, urls, 'markdown');
}

/** Send a notification with an HTML body. */
function sendHtml(title, body, urls) {
  return runApprise(title, body, urls, 'html');
}

/**
 * Parse Apprise output to extract meaningful error messages
 * @param {number} code - Exit code
 * @param {string} stdout - Standard output
 * @param {string} stderr - Standard error
 * @returns {string} Human-readable error message
 */
function parseError(code, stdout, stderr) {
  const output = (stderr + '\n' + stdout).toLowerCase();

  // Check for common error patterns
  if (output.includes('connection refused') || output.includes('connect call failed')) {
    return 'Connection refused - check if the service URL is correct and the service is running';
  }
  if (output.includes('unauthorized') || output.includes('401')) {
    return 'Unauthorized - check your API key or token';
  }
  if (output.includes('forbidden') || output.includes('403')) {
    return 'Forbidden - access denied, check permissions or token';
  }
  if (output.includes('not found') || output.includes('404')) {
    return 'Not found - the webhook URL may be invalid or expired';
  }
  if (output.includes('rate limit') || output.includes('429')) {
    return 'Rate limited - too many requests, try again later';
  }
  if (output.includes('timeout') || output.includes('timed out')) {
    return 'Connection timed out - service may be unreachable';
  }
  if (output.includes('invalid url') || output.includes('invalid schema')) {
    return 'Invalid URL format - check the notification URL syntax';
  }
  if (output.includes('ssl') || output.includes('certificate')) {
    return 'SSL/Certificate error - there may be a problem with HTTPS';
  }
  if (output.includes('dns') || output.includes('name resolution')) {
    return 'DNS error - could not resolve hostname';
  }
  if (output.includes('bad request') || output.includes('400')) {
    return 'Bad request - the service rejected the notification format';
  }
  if (output.includes('internal server error') || output.includes('500')) {
    return 'Server error - the notification service had an internal error';
  }

  // Extract any error line from verbose output
  const lines = (stderr + '\n' + stdout).split('\n');
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('unable')) {
      const cleanedLine = line.trim().replace(/^\d{4}-\d{2}-\d{2}.*?-\s*/, '');
      if (cleanedLine.length > 10 && cleanedLine.length < 200) {
        return cleanedLine;
      }
    }
  }

  // Fallback to raw output or generic message
  const rawError = stderr.trim() || stdout.trim();
  if (rawError && rawError.length < 200) {
    return rawError;
  }

  return `Notification failed (exit code ${code})`;
}

module.exports = {
  send,
  sendMarkdown,
  sendHtml,
  parseError
};

