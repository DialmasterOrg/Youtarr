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

    const preparedArgs = [...args];
    try {
      copyDir = fs.mkdtempSync(path.join(os.tmpdir(), COPY_DIR_PREFIX));
      const copyPath = path.join(copyDir, 'cookies.txt');
      fs.writeFileSync(copyPath, fs.readFileSync(this.getPath()), { mode: 0o600, flag: 'wx' });
      preparedArgs[cookieIndex + 1] = copyPath;
      return { args: preparedArgs, cleanup };
    } catch (err) {
      cleanup();
      logger.warn({ err }, 'Could not copy uploaded cookies for yt-dlp; running without cookies');
      preparedArgs.splice(cookieIndex, 2);
      return { args: preparedArgs, cleanup: null };
    }
  }
}

module.exports = new UploadedCookies();
