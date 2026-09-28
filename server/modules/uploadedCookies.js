const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('../logger');

const UPLOADED_COOKIES_FILENAME = 'cookies.user.txt';
const DEFAULT_CONFIG_DIR = path.join(__dirname, '../../config');
const COPY_DIR_PREFIX = 'youtarr-uploaded-cookies-';

// yt-dlp rewrites its cookie file in place on exit, so concurrent runs sharing
// the uploaded file could read a half-written jar or undo a Settings upload.
// Each run gets a disposable private copy instead; Settings alone writes the
// uploaded file.
class UploadedCookies {
  constructor() {
    this.configDir = DEFAULT_CONFIG_DIR;
  }

  getPath() {
    return path.join(this.configDir, UPLOADED_COOKIES_FILENAME);
  }

  prepare(args) {
    const cookieIndex = args.indexOf('--cookies');
    if (cookieIndex < 0 || args[cookieIndex + 1] !== this.getPath()) {
      return { args, cleanup: null };
    }

    let copyDir = null;
    const cleanup = () => {
      if (!copyDir) return;
      try {
        fs.rmSync(copyDir, { recursive: true, force: true });
        copyDir = null;
      } catch (err) {
        logger.warn({ err }, 'Failed to remove temporary copy of uploaded cookies');
      }
    };

    // Never fall back to the uploaded file itself: yt-dlp saves its jar there
    // on exit, which could overwrite a newer upload or recreate deleted cookies.
    const withoutCookies = () => {
      const remaining = [...args];
      remaining.splice(cookieIndex, 2);
      return { args: remaining, cleanup: null };
    };

    let contents;
    try {
      contents = fs.readFileSync(this.getPath());
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.info('Uploaded cookies were deleted before yt-dlp started; running without cookies');
      } else {
        logger.error({ err }, 'Could not read uploaded cookies; running yt-dlp without cookies');
      }
      return withoutCookies();
    }

    try {
      copyDir = fs.mkdtempSync(path.join(os.tmpdir(), COPY_DIR_PREFIX));
      const copyPath = path.join(copyDir, 'cookies.txt');
      fs.writeFileSync(copyPath, contents, { mode: 0o600, flag: 'wx' });
      const preparedArgs = [...args];
      preparedArgs[cookieIndex + 1] = copyPath;
      return { args: preparedArgs, cleanup };
    } catch (err) {
      cleanup();
      logger.error({ err }, 'Could not make a private copy of uploaded cookies; running yt-dlp without cookies');
      return withoutCookies();
    }
  }
}

module.exports = new UploadedCookies();
