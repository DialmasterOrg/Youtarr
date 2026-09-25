/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('validate-cookies.py', () => {
  let directory;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-cookie-validator-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('validates a Netscape snapshot when yt-dlp is a standalone binary', () => {
    const executable = path.join(directory, 'yt-dlp');
    const snapshot = path.join(directory, 'cookies.txt');
    fs.writeFileSync(executable, 'standalone binary', { mode: 0o700 });
    fs.writeFileSync(snapshot, '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tvalue\n');

    const result = spawnSync('python3', [
      path.resolve(__dirname, '../validate-cookies.py'),
      executable,
      snapshot,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ valid: true, warnings: false });
  });
});
