/* eslint-env jest */

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

jest.mock('fs-extra', () => ({
  createWriteStream: jest.fn(),
  promises: {
    readFile: jest.fn(),
    unlink: jest.fn()
  }
}));

jest.mock('uuid', () => ({
  v4: jest.fn()
}));

jest.mock('../../download/tempPathManager', () => ({
  getTempBasePath: jest.fn()
}));

const { EventEmitter } = require('events');
const path = require('path');
const os = require('os');

const TEMP_BASE_PATH = '/tmp/yt-temp';
const FIXED_UUID = 'fixed-uuid';

function createFakeProcess() {
  const proc = new EventEmitter();
  proc.stdout = { pipe: jest.fn() };
  proc.stderr = new EventEmitter();
  return proc;
}

describe('channelYtdlpExecutor', () => {
  let executor;
  let childProcess;
  let fs;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    childProcess = require('child_process');
    fs = require('fs-extra');
    fs.promises.unlink.mockResolvedValue();

    const uuid = require('uuid');
    uuid.v4.mockReturnValue(FIXED_UUID);

    const tempPathManager = require('../../download/tempPathManager');
    tempPathManager.getTempBasePath.mockReturnValue(TEMP_BASE_PATH);

    executor = require('../channelYtdlpExecutor');
  });

  describe('executeYtDlpCommand', () => {
    let proc;

    beforeEach(() => {
      proc = createFakeProcess();
      childProcess.spawn.mockReturnValue(proc);
    });

    test('resolves when yt-dlp exits with code 0', async () => {
      const promise = executor.executeYtDlpCommand(['--dump-json']);
      proc.emit('exit', 0);

      await expect(promise).resolves.toBeUndefined();
    });

    test('rejects with COOKIES_REQUIRED when stderr reports a bot check, even on exit code 0', async () => {
      const promise = executor.executeYtDlpCommand(['--dump-json']);
      proc.stderr.emit('data', 'ERROR: Sign in to confirm you\'re not a bot');
      proc.emit('exit', 0);

      await expect(promise).rejects.toMatchObject({ code: 'COOKIES_REQUIRED' });
    });

    test('rejects with CHANNEL_NOT_FOUND when stderr reports an extraction failure', async () => {
      const promise = executor.executeYtDlpCommand(['--dump-json']);
      proc.stderr.emit('data', 'ERROR: Unable to extract channel data');
      proc.emit('exit', 1);

      await expect(promise).rejects.toMatchObject({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found or invalid URL'
      });
    });

    test('rejects with NETWORK_ERROR when stderr reports a webpage download failure', async () => {
      const promise = executor.executeYtDlpCommand(['--dump-json']);
      proc.stderr.emit('data', 'ERROR: Unable to download webpage');
      proc.emit('exit', 1);

      await expect(promise).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
        message: 'Network error: Unable to connect to YouTube'
      });
    });

    test('rejects with YT_DLP_ERROR and the stderr buffer on an unrecognized failure', async () => {
      const promise = executor.executeYtDlpCommand(['--dump-json']);
      proc.stderr.emit('data', 'some unrecognized failure');
      proc.emit('exit', 2);

      await expect(promise).rejects.toMatchObject({
        code: 'YT_DLP_ERROR',
        message: 'yt-dlp exited with code 2',
        stderr: 'some unrecognized failure'
      });
    });

    test('spawns yt-dlp with TMPDIR pointing at the temp base path', async () => {
      const promise = executor.executeYtDlpCommand(['--flat-playlist']);
      proc.emit('exit', 0);
      await promise;

      expect(childProcess.spawn).toHaveBeenCalledWith(
        'yt-dlp',
        ['--flat-playlist'],
        { env: expect.objectContaining({ TMPDIR: TEMP_BASE_PATH }) }
      );
    });

    describe('with an output file', () => {
      const OUTPUT_FILE = '/tmp/out.json';
      const OUTPUT_CONTENT = '{"entries":[]}';

      let writeStream;

      beforeEach(() => {
        writeStream = { on: jest.fn() };
        fs.createWriteStream.mockReturnValue(writeStream);
        fs.promises.readFile.mockResolvedValue(OUTPUT_CONTENT);
      });

      test('pipes yt-dlp stdout into a write stream on the output file', async () => {
        const promise = executor.executeYtDlpCommand(['--dump-json'], OUTPUT_FILE);
        proc.emit('exit', 0);
        await promise;

        expect(fs.createWriteStream).toHaveBeenCalledWith(OUTPUT_FILE);
        expect(proc.stdout.pipe).toHaveBeenCalledWith(writeStream);
      });

      test('resolves with the output file content', async () => {
        const promise = executor.executeYtDlpCommand(['--dump-json'], OUTPUT_FILE);
        proc.emit('exit', 0);

        await expect(promise).resolves.toBe(OUTPUT_CONTENT);
      });

      test('removes the output file after reading it', async () => {
        const promise = executor.executeYtDlpCommand(['--dump-json'], OUTPUT_FILE);
        proc.emit('exit', 0);
        await promise;

        expect(fs.promises.unlink).toHaveBeenCalledWith(OUTPUT_FILE);
      });
    });
  });

  describe('withTempFile', () => {
    const expectedTempPath = path.join(os.tmpdir(), `chan-${FIXED_UUID}.json`);

    test('resolves with the callback result', async () => {
      await expect(
        executor.withTempFile('chan', async () => 'the-result')
      ).resolves.toBe('the-result');
    });

    test('passes the temp file path to the callback', async () => {
      const callback = jest.fn().mockResolvedValue('ok');

      await executor.withTempFile('chan', callback);

      expect(callback).toHaveBeenCalledWith(expectedTempPath);
    });

    test('unlinks the temp file after the callback succeeds', async () => {
      await executor.withTempFile('chan', async () => 'ok');

      expect(fs.promises.unlink).toHaveBeenCalledWith(expectedTempPath);
    });

    test('rethrows the callback error', async () => {
      await expect(
        executor.withTempFile('chan', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });

    test('unlinks the temp file when the callback throws', async () => {
      await executor
        .withTempFile('chan', async () => {
          throw new Error('boom');
        })
        .catch(() => {});

      expect(fs.promises.unlink).toHaveBeenCalledWith(expectedTempPath);
    });

    test('still resolves with the callback result when temp file cleanup fails', async () => {
      fs.promises.unlink.mockRejectedValue(new Error('EPERM'));

      await expect(
        executor.withTempFile('chan', async () => 'ok')
      ).resolves.toBe('ok');
    });

    test('still rejects with the callback error when temp file cleanup fails', async () => {
      fs.promises.unlink.mockRejectedValue(new Error('EPERM'));

      await expect(
        executor.withTempFile('chan', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });
  });
});
