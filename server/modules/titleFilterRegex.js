const { execFileSync, spawn } = require('child_process');
const path = require('path');

// Channel title filters and title-show patterns are Python regexes because
// yt-dlp applies them with Python's re.search. The channel filter preview and
// validation, and title-show classification, go through this module so a
// pattern behaves the same there as in real downloads.
// (Playlist title filters are evaluated separately; see
// playlistModule.buildTitleFilterRegExp.)
const SCRIPT_PATH = path.join(__dirname, '../utils/title-filter-regex.py');
const VALIDATE_TIMEOUT_MS = 2000;
const MATCH_TIMEOUT_MS = 15000;

/**
 * Run one request through the Python script in its own process.
 * @param {Object} request
 * @param {(parsed: Object) => *} pick - Returns the result, or throws when the response is malformed
 * @returns {Promise<*>}
 */
function runScript(request, pick) {
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
      const err = new Error(`A title pattern took too long to check (over ${MATCH_TIMEOUT_MS / 1000} seconds). Simplify the pattern.`);
      // The pattern is the cause, so callers answer it as a bad request.
      err.status = 400;
      finish(err);
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
        finish(null, pick(parsed));
      } catch (err) {
        finish(err);
      }
    });

    child.stdin.on('error', (err) => finish(err));
    child.stdin.end(JSON.stringify(request));
  });
}

function expectList(list, length) {
  if (!Array.isArray(list) || list.length !== length) {
    throw new Error('Title filter regex check returned an unexpected result');
  }
  return list;
}

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
    return runScript({ pattern, titles }, (parsed) => expectList(parsed.matches, titles.length));
  }

  /**
   * Compile-check several regexes in one Python process.
   * @param {string[]} patterns
   * @returns {Promise<Array<string|null>>} the compile error of each, or null
   */
  checkPatterns(patterns) {
    if (patterns.length === 0) return Promise.resolve([]);
    return runScript({ mode: 'check', patterns }, (parsed) => expectList(parsed.errors, patterns.length));
  }

  /**
   * Find each title's first matching pattern, skipping a pattern when one of
   * its excludes also matches the title.
   * @param {Array<{regex: string, excludes?: string[]}>} patterns
   * @param {string[]} titles
   * @returns {Promise<Array<null|{index: number, groups: Object<string, string|null>}>>}
   */
  classifyTitles(patterns, titles) {
    if (titles.length === 0) return Promise.resolve([]);
    if (patterns.length === 0) return Promise.resolve(titles.map(() => null));
    const request = {
      mode: 'classify',
      patterns: patterns.map(({ regex, excludes }) => ({ regex, excludes: excludes || [] })),
      titles,
    };
    return runScript(request, (parsed) => expectList(parsed.results, titles.length));
  }
}

module.exports = new TitleFilterRegex();
