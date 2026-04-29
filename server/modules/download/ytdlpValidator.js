const { spawn } = require('child_process');
const logger = require('../../logger');

const TIMEOUT_MS = 10_000;

/**
 * Run yt-dlp in argparse-only mode. `--help` exits with code 0 after printing
 * help, but argparse runs FIRST, so unknown flags / bad values fail with code 2
 * before help is printed. We pipe stdout to /dev/null so we don't buffer the
 * help text we don't care about.
 *
 * NOTE: We intentionally do NOT use `--version` here. `--version` is a
 * short-circuit that bypasses argparse entirely, so `yt-dlp --bogus-flag --version`
 * exits 0 and silently accepts the invalid flag.
 *
 * Surfaces yt-dlp's stderr verbatim so the user sees the real error message.
 * @param {string[]} tokens - Tokenized custom args (already validated against denylist + positional check).
 * @returns {Promise<{ ok: boolean, stderr: string }>}
 */
function dryRun(tokens) {
  return new Promise((resolve) => {
    let stderr = '';
    let resolved = false;

    const proc = spawn('yt-dlp', [...tokens, '--help'], {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      try {
        proc.kill();
      } catch (err) {
        logger.warn({ err }, 'Failed to kill yt-dlp validation process on timeout');
      }
      finish({ ok: false, stderr: `Validation timed out after ${TIMEOUT_MS / 1000} seconds` });
    }, TIMEOUT_MS);

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        finish({ ok: true, stderr: '' });
      } else {
        finish({ ok: false, stderr });
      }
    });

    proc.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        finish({ ok: false, stderr: 'yt-dlp binary not found' });
        return;
      }
      logger.error({ err }, 'yt-dlp validation process emitted error');
      finish({ ok: false, stderr: err.message || 'Validation failed' });
    });
  });
}

module.exports = { dryRun };
