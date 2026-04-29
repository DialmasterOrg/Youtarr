/* eslint-env jest */

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { EventEmitter } = require('events');

function makeFakeProcess() {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();
  return proc;
}

describe('ytdlpValidator.dryRun', () => {
  let dryRun;
  let spawn;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    ({ dryRun } = require('../ytdlpValidator'));
    ({ spawn } = require('child_process'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('spawns yt-dlp with [...tokens, --help] and no shell', async () => {
    const proc = makeFakeProcess();
    spawn.mockReturnValueOnce(proc);

    const promise = dryRun(['--no-mtime', '--retries', '3']);

    expect(spawn).toHaveBeenCalledWith(
      'yt-dlp',
      ['--no-mtime', '--retries', '3', '--help'],
      expect.objectContaining({ shell: false })
    );

    proc.emit('close', 0);
    await expect(promise).resolves.toEqual({ ok: true, stderr: '' });
  });

  test('returns ok=false with captured stderr on non-zero exit', async () => {
    const proc = makeFakeProcess();
    spawn.mockReturnValueOnce(proc);

    const promise = dryRun(['--bogus-flag']);
    proc.stderr.emit('data', Buffer.from('yt-dlp: error: no such option: --bogus-flag\n'));
    proc.emit('close', 2);

    await expect(promise).resolves.toEqual({
      ok: false,
      stderr: 'yt-dlp: error: no such option: --bogus-flag\n',
    });
  });

  test('returns timeout error after 10 seconds and kills the process', async () => {
    const proc = makeFakeProcess();
    spawn.mockReturnValueOnce(proc);

    const promise = dryRun(['--retries', '5']);
    jest.advanceTimersByTime(10_001);

    // Drain microtasks so the timeout handler resolves.
    await Promise.resolve();
    await Promise.resolve();

    await expect(promise).resolves.toEqual({
      ok: false,
      stderr: 'Validation timed out after 10 seconds',
    });
    expect(proc.kill).toHaveBeenCalled();
  });

  test('returns ENOENT message when yt-dlp binary is missing', async () => {
    const proc = makeFakeProcess();
    spawn.mockReturnValueOnce(proc);

    const promise = dryRun([]);
    const err = new Error('spawn yt-dlp ENOENT');
    err.code = 'ENOENT';
    proc.emit('error', err);

    await expect(promise).resolves.toEqual({
      ok: false,
      stderr: 'yt-dlp binary not found',
    });
  });
});
