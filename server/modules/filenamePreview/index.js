const path = require('path');
const ytDlpRunner = require('../ytDlpRunner');
const logger = require('../../logger');
const {
  composeVideoFileTemplate,
  composeVideoFolderName,
} = require('../filesystem/constants');

const SAMPLE_INFO_JSON_PATH = path.join(__dirname, 'sample-video.info.json');

// yt-dlp invocation per template is ~150-300ms locally and ~500-800ms in
// constrained environments. Two parallel calls are issued per preview, so we
// cap the timeout generously for slow hosts.
const TIMEOUT_MS = 5000;

// Small LRU; Map preserves insertion order, so we evict the oldest entry when
// the cache fills.
const CACHE_MAX_ENTRIES = 200;

class FilenamePreview {
  constructor() {
    this._cache = new Map();
  }

  _cacheGet(key) {
    if (!this._cache.has(key)) return undefined;
    const value = this._cache.get(key);
    // Refresh recency
    this._cache.delete(key);
    this._cache.set(key, value);
    return value;
  }

  _cacheSet(key, value) {
    if (this._cache.has(key)) this._cache.delete(key);
    this._cache.set(key, value);
    while (this._cache.size > CACHE_MAX_ENTRIES) {
      const oldestKey = this._cache.keys().next().value;
      this._cache.delete(oldestKey);
    }
  }

  /**
   * Build the yt-dlp args for rendering one template against the canned
   * fixture. No network: --simulate, --skip-download, and --load-info-json
   * mean yt-dlp does not contact YouTube.
   *
   * `--no-update` suppresses yt-dlp's "your version is older than 90 days"
   * warning, which would otherwise pollute stderr on fixed-version builds.
   */
  _renderArgs(template) {
    return [
      '--no-update',
      '--load-info-json', SAMPLE_INFO_JSON_PATH,
      '--simulate',
      '--skip-download',
      '--windows-filenames',
      '--quiet',
      '--no-warnings',
      '--print', 'filename',
      '-o', template,
    ];
  }

  async _renderOne(template) {
    const args = this._renderArgs(template);
    const stdout = await ytDlpRunner.run(args, { timeoutMs: TIMEOUT_MS });
    return stdout.trim();
  }

  /**
   * Run yt-dlp for the file and folder templates derived from the user's
   * prefix. Returns the rendered filenames (yt-dlp's actual output, not a
   * simulator's approximation) and their lengths.
   *
   * Throws on yt-dlp rejection; the route handler maps the error to 400 with
   * the yt-dlp stderr in `error.message`.
   *
   * @param {string} prefix
   * @returns {Promise<{fileLine: string, folderLine: string, fileLineLength: number, folderLineLength: number}>}
   */
  async previewTemplate(prefix) {
    const cached = this._cacheGet(prefix);
    if (cached) return cached;

    const fileTemplate = composeVideoFileTemplate(prefix);
    const folderTemplate = composeVideoFolderName(prefix);

    const [fileLine, folderLine] = await Promise.all([
      this._renderOne(fileTemplate),
      this._renderOne(folderTemplate),
    ]);

    const result = {
      fileLine,
      folderLine,
      fileLineLength: fileLine.length,
      folderLineLength: folderLine.length,
    };
    this._cacheSet(prefix, result);
    return result;
  }

  /**
   * Validate a template by attempting to render it. yt-dlp's stderr message
   * is surfaced verbatim on failure (e.g. `invalid default output template
   * "%(title)Z": unsupported format character 'Z' (0x5a) at index 8`).
   *
   * @param {string} prefix
   * @returns {Promise<{ok: true} | {ok: false, error: string}>}
   */
  async validateTemplate(prefix) {
    try {
      await this.previewTemplate(prefix);
      return { ok: true };
    } catch (err) {
      logger.warn({ err: err.message }, 'filenamePreview rejected template');
      return { ok: false, error: err.message };
    }
  }

  /** Test seam: clear the cache between tests. */
  _resetCache() {
    this._cache.clear();
  }
}

module.exports = new FilenamePreview();
