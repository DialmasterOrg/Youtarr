/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');

const mockLogDirectory = path.join(os.tmpdir(), `youtarr-log-files-${process.pid}`);
jest.mock('../../logging/logFileConfig', () => ({
  ...jest.requireActual('../../logging/logFileConfig'),
  LOG_DIRECTORY: mockLogDirectory,
}));

const logFilesModule = require('../logFilesModule');

async function readAll(stream) {
  let text = '';
  for await (const chunk of stream) text += chunk;
  return text;
}

function writeLog(name, contents) {
  fs.writeFileSync(path.join(mockLogDirectory, name), contents);
}

describe('logFilesModule', () => {
  beforeEach(() => {
    fs.rmSync(mockLogDirectory, { recursive: true, force: true });
    fs.mkdirSync(mockLogDirectory, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(mockLogDirectory, { recursive: true, force: true });
  });

  test('lists log files oldest first by number', async () => {
    ['youtarr.9.log', 'youtarr.10.log', 'youtarr.2.log', 'notes.txt', 'youtarr.log'].forEach((name) => writeLog(name, ''));

    const files = await logFilesModule.listLogFiles();

    expect(files.map((file) => file.name)).toEqual(['youtarr.2.log', 'youtarr.9.log', 'youtarr.10.log']);
  });

  test('returns no files when the log folder does not exist yet', async () => {
    fs.rmSync(mockLogDirectory, { recursive: true, force: true });

    expect(await logFilesModule.listLogFiles()).toEqual([]);
  });

  test('combines the files oldest first', async () => {
    writeLog('youtarr.10.log', 'ten\n');
    writeLog('youtarr.9.log', 'nine\n');

    const files = await logFilesModule.listLogFiles();

    expect(await readAll(logFilesModule.createCombinedStream(files, {}))).toBe('nine\nten\n');
  });

  test('hides configured secrets in the combined output', async () => {
    writeLog('youtarr.1.log', 'refresh ?X-Plex-Token=plexToken123abc failed\n');
    writeLog('youtarr.2.log', 'proxy http://user:pass@host:8080\n');
    const files = await logFilesModule.listLogFiles();

    const text = await readAll(logFilesModule.createCombinedStream(files, { plexApiKey: 'plexToken123abc' }));

    expect(text).toBe('refresh ?X-Plex-Token=[REDACTED] failed\nproxy http://[REDACTED]@host:8080\n');
  });

  test('skips a file deleted after it was listed', async () => {
    writeLog('youtarr.1.log', 'one\n');
    writeLog('youtarr.2.log', 'two\n');
    const files = await logFilesModule.listLogFiles();
    fs.rmSync(path.join(mockLogDirectory, 'youtarr.1.log'));

    expect(await readAll(logFilesModule.createCombinedStream(files, {}))).toBe('two\n');
  });
});
