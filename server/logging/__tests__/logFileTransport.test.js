/* eslint-env jest */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');
const logFileTransport = require('../logFileTransport');

const MAX_FILES = 2;
const SMALL_FILE_BYTES = 200;
const WRITE_INTERVAL_MS = 10;
// pino-roll deletes old files asynchronously after each rotation.
const CLEANUP_SETTLE_MS = 100;
const PRETTY_OPTIONS = {
  translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
  ignore: 'pid,hostname',
  singleLine: true,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logLine(fields) {
  return `${JSON.stringify({ level: 30, time: Date.UTC(2026, 8, 25, 12), pid: 1, hostname: 'host', ...fields })}\n`;
}

function fillerLines(count) {
  return Array.from({ length: count }, (_, i) => logLine({ msg: `line ${i} ${'x'.repeat(60)}` }));
}

async function writeAndClose(stream, lines, { spaced = false } = {}) {
  for (const line of lines) {
    stream.write(line);
    if (spaced) await sleep(WRITE_INTERVAL_MS);
  }
  stream.end();
  await once(stream, 'close');
}

function numberedLogFiles(dir) {
  return fs.readdirSync(dir)
    .filter((name) => /^youtarr\.\d+\.log$/.test(name))
    .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
}

describe('logFileTransport', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'youtarr-log-transport-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const open = (overrides = {}) => logFileTransport({
    file: path.join(dir, 'youtarr.log'),
    maxSizeBytes: 10 * 1024 * 1024,
    maxFiles: MAX_FILES,
    prettyOptions: PRETTY_OPTIONS,
    ...overrides,
  });

  test('writes readable text lines instead of JSON', async () => {
    const stream = await open();
    await writeAndClose(stream, [logLine({ msg: 'hello', videoId: 'abc' })]);

    const contents = fs.readFileSync(path.join(dir, 'youtarr.1.log'), 'utf8');
    expect(contents).toContain('INFO: hello {"videoId":"abc"}');
    expect(contents).not.toContain('"level":30');
  });

  test('strips terminal color codes from messages', async () => {
    const stream = await open();
    await writeAndClose(stream, [logLine({ msg: '\u001b[32mINFO\u001b[39m: [Post-Process] moved file' })]);

    // eslint-disable-next-line no-control-regex
    expect(fs.readFileSync(path.join(dir, 'youtarr.1.log'), 'utf8')).not.toMatch(/\u001b\[/);
  });

  test('keeps the configured number of older files plus the current one', async () => {
    const stream = await open({ maxSizeBytes: SMALL_FILE_BYTES });
    await writeAndClose(stream, fillerLines(20), { spaced: true });
    await sleep(CLEANUP_SETTLE_MS);

    expect(numberedLogFiles(dir)).toHaveLength(MAX_FILES + 1);
  });

  test('deletes older files left by earlier runs once it rotates', async () => {
    for (let n = 1; n <= 6; n += 1) {
      fs.writeFileSync(path.join(dir, `youtarr.${n}.log`), 'old\n');
    }

    const stream = await open({ maxSizeBytes: SMALL_FILE_BYTES });
    await writeAndClose(stream, fillerLines(6), { spaced: true });
    await sleep(CLEANUP_SETTLE_MS);

    const files = numberedLogFiles(dir);
    expect(files).not.toContain('youtarr.1.log');
    expect(files.length).toBeLessThanOrEqual(MAX_FILES + 1);
  });

  test('keeps accepting log lines when the log folder cannot be created', async () => {
    const stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const blocker = path.join(dir, 'blocker');
    fs.writeFileSync(blocker, '');

    const stream = await open({ file: path.join(blocker, 'logs', 'youtarr.log') });
    await writeAndClose(stream, [logLine({ msg: 'one' }), logLine({ msg: 'two' })], { spaced: true });

    expect(stderr).toHaveBeenCalledTimes(1);
    expect(stderr.mock.calls[0][0]).toMatch(/^Youtarr stopped writing log files: /);
  });
});

describe('logFileTransport backpressure', () => {
  const { EventEmitter } = require('events');
  const settle = () => new Promise((resolve) => setImmediate(resolve));

  class SlowFile extends EventEmitter {
    constructor() {
      super();
      this.write = jest.fn(() => false);
    }

    end() {
      this.emit('close');
    }
  }

  let file;
  let transport;

  beforeEach(() => {
    file = new SlowFile();
    jest.resetModules();
    jest.doMock('pino-roll', () => jest.fn(async () => file));
    transport = require('../logFileTransport');
  });

  afterEach(() => {
    jest.dontMock('pino-roll');
    jest.restoreAllMocks();
  });

  const open = () => transport({ file: '/unused/youtarr.log', maxSizeBytes: 1024, maxFiles: 1, prettyOptions: {} });

  test('waits for the file to drain before writing more', async () => {
    const stream = await open();
    stream.write(logLine({ msg: 'one' }));
    stream.write(logLine({ msg: 'two' }));
    await settle();
    expect(file.write).toHaveBeenCalledTimes(1);

    file.emit('drain');
    await settle();

    expect(file.write).toHaveBeenCalledTimes(2);
  });

  test('stops waiting when the file fails while draining', async () => {
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stream = await open();
    stream.write(logLine({ msg: 'one' }));
    stream.write(logLine({ msg: 'two' }));
    await settle();

    file.emit('error', new Error('ENOSPC: no space left on device'));
    stream.end();
    await once(stream, 'close');

    expect(file.write).toHaveBeenCalledTimes(1);
  });
});
