/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const buildModule = (tokenPath) => {
  jest.resetModules();
  jest.doMock('../../logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }));
  // eslint-disable-next-line global-require
  const fresh = require('../setupTokenModule');
  fresh.setTokenPath(tokenPath);
  fresh.reset();
  return fresh;
};

describe('setupTokenModule', () => {
  let tmpDir;
  let tokenPath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-setup-token-'));
    tokenPath = path.join(tmpDir, 'setup-token');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('ensureToken', () => {
    test('generates a 64-char hex token when no file exists', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const token = mod.getToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(fs.readFileSync(tokenPath, 'utf8')).toBe(token);
    });

    test('writes the file with mode 0600', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const stat = fs.statSync(tokenPath);
      expect(stat.mode & 0o777).toBe(0o600);
    });

    test('loads an existing token from disk and does not regenerate', () => {
      const existing = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(tokenPath, existing, { mode: 0o600 });

      const mod = buildModule(tokenPath);
      mod.ensureToken();

      expect(mod.getToken()).toBe(existing);
      expect(fs.readFileSync(tokenPath, 'utf8')).toBe(existing);
    });

    test('tightens permissions on an existing valid token file', () => {
      const existing = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(tokenPath, existing, { mode: 0o644 });

      const mod = buildModule(tokenPath);
      mod.ensureToken();

      expect(mod.getToken()).toBe(existing);
      expect(fs.statSync(tokenPath).mode & 0o777).toBe(0o600);
    });

    test('regenerates when existing file is malformed', () => {
      fs.writeFileSync(tokenPath, 'not-a-hex-token', { mode: 0o600 });

      const mod = buildModule(tokenPath);
      mod.ensureToken();

      expect(mod.getToken()).toMatch(/^[0-9a-f]{64}$/);
      expect(fs.readFileSync(tokenPath, 'utf8')).toBe(mod.getToken());
    });

    test('replaces a malformed permissive file with mode 0600', () => {
      fs.writeFileSync(tokenPath, 'not-a-hex-token', { mode: 0o644 });

      const mod = buildModule(tokenPath);
      mod.ensureToken();

      expect(fs.readFileSync(tokenPath, 'utf8')).toBe(mod.getToken());
      expect(fs.statSync(tokenPath).mode & 0o777).toBe(0o600);
    });

    test('is idempotent across multiple calls', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const first = mod.getToken();
      mod.ensureToken();
      mod.ensureToken();
      expect(mod.getToken()).toBe(first);
    });
  });

  describe('verify', () => {
    test('returns true for the correct token', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      expect(mod.verify(mod.getToken())).toBe(true);
    });

    test('returns false for an incorrect token of the same length', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const wrong = 'a'.repeat(64);
      expect(mod.verify(wrong)).toBe(false);
    });

    test('returns false for a token of different length', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      expect(mod.verify('short')).toBe(false);
    });

    test('returns false for non-string input', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      expect(mod.verify(undefined)).toBe(false);
      expect(mod.verify(null)).toBe(false);
      expect(mod.verify(12345)).toBe(false);
    });

    test('returns false when no active token', () => {
      const mod = buildModule(tokenPath);
      expect(mod.verify('anything')).toBe(false);
    });
  });

  describe('consume', () => {
    test('deletes the file and clears memory', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      expect(fs.existsSync(tokenPath)).toBe(true);

      mod.consume();

      expect(fs.existsSync(tokenPath)).toBe(false);
      expect(mod.getToken()).toBeNull();
      expect(mod.verify('anything')).toBe(false);
    });

    test('is safe to call when no token is active', () => {
      const mod = buildModule(tokenPath);
      expect(() => mod.consume()).not.toThrow();
    });
  });

  describe('claimForSetup', () => {
    test('returns true and blocks another claim when the provided token matches', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const token = mod.getToken();

      expect(mod.claimForSetup(token)).toBe(true);
      expect(mod.claimForSetup(token)).toBe(false);
      expect(fs.existsSync(tokenPath)).toBe(true);
      expect(mod.getToken()).toBe(token);
    });

    test('returns false and leaves the token claimable when the provided token does not match', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const token = mod.getToken();

      expect(mod.claimForSetup('wrong-token')).toBe(false);
      expect(fs.existsSync(tokenPath)).toBe(true);
      expect(mod.getToken()).toBe(token);
      expect(mod.claimForSetup(token)).toBe(true);
    });

    test('allows another claim after releaseSetupClaim', () => {
      const mod = buildModule(tokenPath);
      mod.ensureToken();
      const token = mod.getToken();

      expect(mod.claimForSetup(token)).toBe(true);
      mod.releaseSetupClaim();
      expect(mod.claimForSetup(token)).toBe(true);
    });
  });

  describe('clearStaleFile', () => {
    test('deletes a leftover file and clears memory', () => {
      fs.writeFileSync(tokenPath, 'a'.repeat(64), { mode: 0o600 });

      const mod = buildModule(tokenPath);
      mod.clearStaleFile();

      expect(fs.existsSync(tokenPath)).toBe(false);
      expect(mod.getToken()).toBeNull();
    });

    test('is a no-op when the file does not exist', () => {
      const mod = buildModule(tokenPath);
      expect(() => mod.clearStaleFile()).not.toThrow();
    });
  });

  describe('logBanner', () => {
    test('logs setup guidance and the token-bearing info entry', () => {
      const mod = buildModule(tokenPath);
      const logger = require('../../logger');
      mod.ensureToken();

      mod.logBanner();

      expect(logger.warn).toHaveBeenCalledWith(
        {
          tokenPath,
          instruction: 'Read config/setup-token to complete first-time setup. The token-bearing setup log entry is emitted at info level.'
        },
        'Youtarr initial setup required'
      );
      expect(logger.info).toHaveBeenCalledWith(
        {
          setupToken: mod.getToken(),
          tokenPath,
          instruction: 'Open Youtarr in a browser and paste this token to complete setup.'
        },
        'Youtarr initial setup required'
      );
    });
  });
});
