/* eslint-env jest */
const path = require('path');
const { EventEmitter } = require('events');

describe('YtDlpRunner', () => {
  class MockChildProcess extends EventEmitter {
    constructor() {
      super();
      this.stdout = new EventEmitter();
      this.stderr = new EventEmitter();
      this.killSignals = [];
      this.killed = false;
      this.kill = jest.fn((signal) => {
        this.killSignals.push(signal);
        if (!signal || signal === 'SIGKILL') {
          this.killed = true;
        }
      });
    }
  }

  let spawnMock;
  let fsMock;
  let configModuleMock;
  let ytDlpRunner;
  let fileStream;
  let spawnedProcesses;

  const loadModule = () => {
    jest.isolateModules(() => {
      ytDlpRunner = require('../ytDlpRunner');
    });
  };

  const getLastProcess = () => spawnedProcesses[spawnedProcesses.length - 1];

  const emitDataAndClose = (proc, { stdout = '', stderr = '', code = 0 } = {}) => {
    if (stdout) {
      proc.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      proc.stderr.emit('data', Buffer.from(stderr));
    }
    proc.emit('close', code);
  };

  beforeEach(() => {
    jest.resetModules();

    fileStream = {
      write: jest.fn(),
      end: jest.fn()
    };

    fsMock = {
      existsSync: jest.fn(() => true),
      mkdirSync: jest.fn(),
      createWriteStream: jest.fn(() => fileStream)
    };

    spawnedProcesses = [];

    spawnMock = jest.fn(() => {
      const proc = new MockChildProcess();
      spawnedProcesses.push(proc);
      return proc;
    });

    jest.doMock('child_process', () => ({ spawn: spawnMock }));
    jest.doMock('fs', () => fsMock);

    configModuleMock = {
      getCookiesPath: jest.fn(() => '/mock/cookies.txt'),
      getConfig: jest.fn(() => ({
        sleepRequests: 1,
        proxy: ''
      }))
    };
    jest.doMock('../configModule', () => configModuleMock);

    // Mock ytdlpCommandBuilder
    const ytdlpCommandBuilderMock = {
      buildMetadataFetchArgs: jest.fn((url) => ['--skip-download', '--dump-single-json', '-4', '--cookies', '/mock/cookies.txt', url])
    };
    jest.doMock('../download/ytdlpCommandBuilder', () => ytdlpCommandBuilderMock);

    loadModule();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('rejects when args are not an array', async () => {
    await expect(ytDlpRunner.run('not-array', { timeoutMs: 0 })).rejects.toThrow('Arguments must be provided as an array');
    expect(spawnMock).not.toHaveBeenCalled();
    // No longer calls getCookiesPath - args should be pre-built
    expect(configModuleMock.getCookiesPath).not.toHaveBeenCalled();
  });

  it('runs yt-dlp with pre-built args and resolves stdout', async () => {
    // Args should be pre-built (e.g., using ytdlpCommandBuilder.buildMetadataFetchArgs())
    const runPromise = ytDlpRunner.run(['--cookies', '/mock/cookies.txt', '--version'], { timeoutMs: 0 });
    const proc = getLastProcess();
    emitDataAndClose(proc, { stdout: 'version 1.0' });

    await expect(runPromise).resolves.toBe('version 1.0');
    expect(spawnMock).toHaveBeenCalledWith(
      'yt-dlp',
      ['--cookies', '/mock/cookies.txt', '--version'],
      expect.objectContaining({ shell: false, timeout: 0 })
    );
    // No longer calls getCookiesPath - args should be pre-built
    expect(configModuleMock.getCookiesPath).not.toHaveBeenCalled();
  });

  it('uses args as-is without modification', async () => {
    const runPromise = ytDlpRunner.run(['-F'], { timeoutMs: 0 });
    const proc = getLastProcess();
    emitDataAndClose(proc);

    await expect(runPromise).resolves.toBe('');
    expect(configModuleMock.getCookiesPath).not.toHaveBeenCalled();
    expect(spawnMock).toHaveBeenCalledWith(
      'yt-dlp',
      ['-F'],
      expect.objectContaining({ timeout: 0 })
    );
  });

  it('writes stdout to file when pipeToFile is provided', async () => {
    fsMock.existsSync.mockReturnValue(false);

    const runPromise = ytDlpRunner.run(['--dump-json'], {
      timeoutMs: 0,
      pipeToFile: '/tmp/output/data.json'
    });
    const proc = getLastProcess();
    const chunk = Buffer.from('file chunk');
    proc.stdout.emit('data', chunk);
    proc.emit('close', 0);

    await expect(runPromise).resolves.toBe('');
    expect(fsMock.existsSync).toHaveBeenCalledWith(path.dirname('/tmp/output/data.json'));
    expect(fsMock.mkdirSync).toHaveBeenCalledWith(path.dirname('/tmp/output/data.json'), { recursive: true });
    expect(fsMock.createWriteStream).toHaveBeenCalledWith('/tmp/output/data.json');
    expect(fileStream.write).toHaveBeenCalledWith(chunk);
    expect(fileStream.end).toHaveBeenCalledTimes(1);
  });

  it('rejects when output file cannot be created', async () => {
    fsMock.existsSync.mockReturnValue(false);
    fsMock.createWriteStream.mockImplementation(() => {
      throw new Error('disk full');
    });

    const runPromise = ytDlpRunner.run(['--dump-json'], {
      timeoutMs: 0,
      pipeToFile: '/tmp/output/data.json'
    });
    const proc = getLastProcess();

    await expect(runPromise).rejects.toThrow('Failed to create output file: disk full');
    expect(proc.kill).toHaveBeenCalledTimes(1);
    expect(proc.killSignals).toContain(undefined);
  });

  it('rejects with cookies required error when bot detection is encountered', async () => {
    const runPromise = ytDlpRunner.run(['--some-flag'], { timeoutMs: 0 });
    const proc = getLastProcess();

    proc.stderr.emit('data', Buffer.from('Sign in to confirm you\'re not a bot'));
    proc.emit('close', 1);

    await expect(runPromise).rejects.toMatchObject({
      message: 'Bot detection encountered. Please set cookies in your Configuration or try different cookies to resolve this issue.',
      code: 'COOKIES_REQUIRED'
    });
  });

  it('rejects when the process reports a timeout', async () => {
    const runPromise = ytDlpRunner.run(['--any'], { timeoutMs: 0 });
    const proc = getLastProcess();

    proc.emit('close', null);

    await expect(runPromise).rejects.toThrow('yt-dlp process timed out after 0ms');
  });

  it('rejects with stderr output when process exits with error code', async () => {
    const runPromise = ytDlpRunner.run(['--any'], { timeoutMs: 0 });
    const proc = getLastProcess();

    proc.stderr.emit('data', Buffer.from('something went wrong'));
    proc.emit('close', 1);

    await expect(runPromise).rejects.toThrow('something went wrong');
  });

  it('rejects with generic message when no stderr output is provided', async () => {
    const runPromise = ytDlpRunner.run(['--any'], { timeoutMs: 0 });
    const proc = getLastProcess();

    proc.emit('close', 2);

    await expect(runPromise).rejects.toThrow('yt-dlp process exited with code 2');
  });

  it('rejects when yt-dlp is not installed', async () => {
    const runPromise = ytDlpRunner.run(['--any'], { timeoutMs: 0 });
    const proc = getLastProcess();
    const error = new Error('not found');
    error.code = 'ENOENT';

    proc.emit('error', error);

    await expect(runPromise).rejects.toThrow('yt-dlp not found. Please ensure yt-dlp is installed.');
  });

  it('propagates unexpected process errors', async () => {
    const runPromise = ytDlpRunner.run(['--any'], { timeoutMs: 0 });
    const proc = getLastProcess();
    const error = new Error('spawn failed');

    proc.emit('error', error);

    await expect(runPromise).rejects.toBe(error);
  });

  it('kills the process when timeout expires', async () => {
    jest.useFakeTimers();

    const runPromise = ytDlpRunner.run(['--version'], { timeoutMs: 100 });
    const proc = getLastProcess();

    expect(proc.kill).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');

    jest.advanceTimersByTime(1000);
    expect(proc.kill).toHaveBeenCalledWith('SIGKILL');
    expect(proc.killed).toBe(true);

    emitDataAndClose(proc, { stdout: 'done' });
    await expect(runPromise).resolves.toBe('done');
  });

  it('fetchMetadata parses yt-dlp output using builder', async () => {
    const metadata = { id: 'abc123' };
    const runSpy = jest.spyOn(ytDlpRunner, 'run').mockResolvedValueOnce(JSON.stringify(metadata));

    const result = await ytDlpRunner.fetchMetadata('https://example.com', 321);

    // Args should be built by ytdlpCommandBuilder.buildMetadataFetchArgs()
    expect(runSpy).toHaveBeenCalledWith(
      ['--skip-download', '--dump-single-json', '-4', '--cookies', '/mock/cookies.txt', 'https://example.com'],
      { timeoutMs: 321 }
    );
    expect(result).toEqual(metadata);
    runSpy.mockRestore();
  });

  it('fetchMetadata wraps timeout errors with friendly message', async () => {
    const runSpy = jest.spyOn(ytDlpRunner, 'run').mockRejectedValueOnce(new Error('yt-dlp process timed out after 5000ms'));

    await expect(ytDlpRunner.fetchMetadata('https://example.com')).rejects.toThrow('Failed to fetch video metadata: Request timed out');
    expect(runSpy).toHaveBeenCalled();
    runSpy.mockRestore();
  });

  it('fetchMetadata propagates other errors with additional context', async () => {
    const runSpy = jest.spyOn(ytDlpRunner, 'run').mockRejectedValueOnce(new Error('unexpected failure'));

    await expect(ytDlpRunner.fetchMetadata('https://example.com')).rejects.toThrow('Failed to fetch video metadata: unexpected failure');
    expect(runSpy).toHaveBeenCalled();
    runSpy.mockRestore();
  });
});
