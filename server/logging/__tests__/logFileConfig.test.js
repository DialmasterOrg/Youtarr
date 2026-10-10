/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  LOG_DIRECTORY,
  LOG_FILE_NAME_PATTERN,
  resolveLogFileConfig,
  checkLogDirectoryWritable,
} = require('../logFileConfig');

const MB = 1024 * 1024;

describe('resolveLogFileConfig', () => {
  test('defaults to 10 MB files and 5 older files', () => {
    expect(resolveLogFileConfig({})).toEqual(expect.objectContaining({
      maxSizeBytes: 10 * MB,
      maxFiles: 5,
      warnings: [],
    }));
  });

  test('writes youtarr.log inside the config folder', () => {
    expect(LOG_DIRECTORY).toBe(path.resolve(__dirname, '../../../config/logs'));
    expect(resolveLogFileConfig({}).file).toBe(path.join(LOG_DIRECTORY, 'youtarr.log'));
  });

  test.each([
    ['25', 25 * MB],
    ['25M', 25 * MB],
    ['25MB', 25 * MB],
    ['25 mb', 25 * MB],
    ['1G', 1024 * MB],
    ['1GB', 1024 * MB],
  ])('reads LOG_FILE_MAX_SIZE=%p', (value, bytes) => {
    expect(resolveLogFileConfig({ LOG_FILE_MAX_SIZE: value }).maxSizeBytes).toBe(bytes);
  });

  test.each(['0', '500KB', '1.5MB', 'lots', '-5', '10B'])('falls back to 10 MB for LOG_FILE_MAX_SIZE=%p', (value) => {
    const result = resolveLogFileConfig({ LOG_FILE_MAX_SIZE: value });
    expect(result.maxSizeBytes).toBe(10 * MB);
    expect(result.warnings).toEqual([{ variable: 'LOG_FILE_MAX_SIZE', value, fallback: '10MB' }]);
  });

  test('reads LOG_FILE_MAX_COUNT', () => {
    expect(resolveLogFileConfig({ LOG_FILE_MAX_COUNT: '12' }).maxFiles).toBe(12);
  });

  test.each(['0', '-1', '2.5', 'many'])('falls back to 5 for LOG_FILE_MAX_COUNT=%p', (value) => {
    const result = resolveLogFileConfig({ LOG_FILE_MAX_COUNT: value });
    expect(result.maxFiles).toBe(5);
    expect(result.warnings).toEqual([{ variable: 'LOG_FILE_MAX_COUNT', value, fallback: 5 }]);
  });

  test('treats blank values as unset', () => {
    expect(resolveLogFileConfig({ LOG_FILE_MAX_SIZE: '', LOG_FILE_MAX_COUNT: '' })).toEqual(
      expect.objectContaining({ maxSizeBytes: 10 * MB, maxFiles: 5, warnings: [] })
    );
  });
});

describe('LOG_FILE_NAME_PATTERN', () => {
  test('matches numbered log files', () => {
    expect(LOG_FILE_NAME_PATTERN.exec('youtarr.12.log')[1]).toBe('12');
  });

  test.each(['youtarr.log', 'other.1.log', 'youtarr.1.log.bak'])('ignores %p', (name) => {
    expect(LOG_FILE_NAME_PATTERN.test(name)).toBe(false);
  });
});

describe('checkLogDirectoryWritable', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-log-config-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates a missing folder and reports no error', () => {
    const directory = path.join(tempDir, 'logs');
    expect(checkLogDirectoryWritable(directory)).toBeNull();
    expect(fs.existsSync(directory)).toBe(true);
  });

  test('returns the error when the folder cannot be created', () => {
    const blocker = path.join(tempDir, 'blocker');
    fs.writeFileSync(blocker, '');
    expect(checkLogDirectoryWritable(path.join(blocker, 'logs'))).toEqual(expect.objectContaining({ code: 'ENOTDIR' }));
  });
});
