const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const DEFAULT_TOKEN_PATH = path.join(__dirname, '../../config/setup-token');
const TOKEN_BYTES = 32;
const TOKEN_HEX_LENGTH = TOKEN_BYTES * 2;
const TOKEN_HEX_PATTERN = new RegExp(`^[0-9a-f]{${TOKEN_HEX_LENGTH}}$`);

class SetupTokenModule {
  constructor() {
    this.tokenPath = DEFAULT_TOKEN_PATH;
    this.token = null;
    this.setupInProgress = false;
  }

  setTokenPath(tokenPath) {
    this.tokenPath = tokenPath;
  }

  reset() {
    this.token = null;
    this.setupInProgress = false;
  }

  getToken() {
    return this.token;
  }

  enforceTokenFileMode() {
    try {
      fs.chmodSync(this.tokenPath, 0o600);
    } catch (err) {
      logger.warn({ err, tokenPath: this.tokenPath }, 'Could not enforce setup-token file mode');
    }
  }

  writeTokenFile(token) {
    const tokenDir = path.dirname(this.tokenPath);
    const tempPath = path.join(tokenDir, `.setup-token.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);

    try {
      fs.writeFileSync(tempPath, token, { mode: 0o600 });
      fs.chmodSync(tempPath, 0o600);
      fs.renameSync(tempPath, this.tokenPath);
      this.enforceTokenFileMode();
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (cleanupErr) {
          logger.warn({ err: cleanupErr, tokenPath: tempPath }, 'Could not remove temporary setup-token file');
        }
      }
      throw err;
    }
  }

  ensureToken() {
    if (this.token) return this.token;

    if (fs.existsSync(this.tokenPath)) {
      const existing = fs.readFileSync(this.tokenPath, 'utf8').trim();
      if (TOKEN_HEX_PATTERN.test(existing)) {
        this.enforceTokenFileMode();
        this.token = existing;
        return this.token;
      }
      logger.warn({ tokenPath: this.tokenPath }, 'Existing setup-token file is malformed; regenerating');
    }

    const generated = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    this.writeTokenFile(generated);
    this.token = generated;
    return this.token;
  }

  verify(provided) {
    if (!this.token || typeof provided !== 'string') return false;
    const expected = Buffer.from(this.token, 'utf8');
    const padded = Buffer.alloc(expected.length);
    Buffer.from(provided, 'utf8').copy(padded, 0, 0, expected.length);
    const equal = crypto.timingSafeEqual(expected, padded);
    return equal && Buffer.byteLength(provided, 'utf8') === expected.length;
  }

  claimForSetup(provided) {
    if (this.setupInProgress || !this.verify(provided)) return false;
    this.setupInProgress = true;
    return true;
  }

  releaseSetupClaim() {
    this.setupInProgress = false;
  }

  consume() {
    this.token = null;
    this.setupInProgress = false;
    if (fs.existsSync(this.tokenPath)) {
      try {
        fs.unlinkSync(this.tokenPath);
      } catch (err) {
        logger.error({ err, tokenPath: this.tokenPath }, 'Failed to delete setup-token file after setup');
      }
    }
  }

  clearStaleFile() {
    this.token = null;
    this.setupInProgress = false;
    if (fs.existsSync(this.tokenPath)) {
      try {
        fs.unlinkSync(this.tokenPath);
        logger.info({ tokenPath: this.tokenPath }, 'Removed stale setup-token file');
      } catch (err) {
        logger.warn({ err, tokenPath: this.tokenPath }, 'Could not remove stale setup-token file');
      }
    }
  }

  logBanner() {
    if (!this.token) return;
    logger.warn({
      tokenPath: this.tokenPath,
      instruction: 'Read config/setup-token to complete first-time setup. The token-bearing setup log entry is emitted at info level.'
    }, 'Youtarr initial setup required');
    logger.info({
      // Intentionally visible: first-time setup depends on operators seeing this
      // value in logs or reading config/setup-token. Treat forwarded logs as sensitive.
      setupToken: this.token,
      tokenPath: this.tokenPath,
      instruction: 'Open Youtarr in a browser and paste this token to complete setup.'
    }, 'Youtarr initial setup required');
  }
}

module.exports = new SetupTokenModule();
