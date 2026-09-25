const { execFileSync, spawn } = require('child_process');
const path = require('path');

// Channel title filters are Python regexes because yt-dlp applies them with
// Python's re.search. The channel filter preview and validation go through
// this module so a pattern behaves the same there as in real downloads.
// (Playlist title filters are evaluated separately; see
// playlistModule.buildTitleFilterRegExp.)
const SCRIPT_PATH = path.join(__dirname, '../utils/title-filter-regex.py');
const VALIDATE_TIMEOUT_MS = 2000;
const MATCH_TIMEOUT_MS = 15000;

class TitleFilterRegex {
  /**
   * Check that a pattern compiles as a Python regex.
   * @param {string} pattern
   * @returns {{ valid: boolean, error?: string }}
   */
  checkSyntax(pattern) {
    try {
      const output = execFileSync('python3', [SCRIPT_PATH], {
        input: JSON.stringify({ pattern, titles: [] }),
        encoding: 'utf8',
        timeout: VALIDATE_TIMEOUT_MS,
      });
      const parsed = JSON.parse(output);
      if (parsed.error) return { valid: false, error: parsed.error };
      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Invalid Python regex pattern: ${err.message}` };
    }
  }

  /**
   * Test titles against a pattern in a single Python process.
   * @param {string} pattern
   * @param {string[]} titles
   * @returns {Promise<boolean[]>} one result per title, in order
   */
  matchTitles(pattern, titles) {
    if (titles.length === 0) return Promise.resolve([]);

    return new Promise((resolve, reject) => {
      const child = spawn('python3', [SCRIPT_PATH]);
      let stdout = '';
      let stderr = '';
      let settled = false;

      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(value);
      };

      // A catastrophic-backtracking pattern must not hang the caller.
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error(`Title filter regex timed out after ${MATCH_TIMEOUT_MS} ms`));
      }, MATCH_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('error', (err) => finish(err));
      child.on('close', (code) => {
        if (code !== 0) {
          finish(new Error(`Title filter regex check exited with code ${code}: ${stderr.trim()}`));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            finish(new Error(parsed.error));
            return;
          }
          if (!Array.isArray(parsed.matches) || parsed.matches.length !== titles.length) {
            finish(new Error('Title filter regex check returned an unexpected result'));
            return;
          }
          finish(null, parsed.matches);
        } catch (err) {
          finish(err);
        }
      });

      child.stdin.on('error', (err) => finish(err));
      child.stdin.end(JSON.stringify({ pattern, titles }));
    });
  }
}

module.exports = new TitleFilterRegex();
