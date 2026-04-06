'use strict';

const fs = require('fs');
const path = require('path');

jest.mock('child_process');
jest.mock('../../../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const NETSCAPE_HEADER = '# Netscape HTTP Cookie File\n';
const validBuffer = Buffer.from(
  NETSCAPE_HEADER +
    '.youtube.com\tTRUE\t/\tTRUE\t9999999999\tLOGIN_INFO\tabc\n'
);

const FAKE_TEMP_DIR = '/tmp/youtarr-subsimport-abc123';

const validYtdlpOutput = JSON.stringify({
  entries: [
    {
      id: 'UC1234567890abcdef12345',
      channel_id: 'UC1234567890abcdef12345',
      title: 'Test Channel',
      url: 'https://www.youtube.com/channel/UC1234567890abcdef12345',
    },
    {
      id: 'UC0987654321zyxwvu09876',
      channel_id: 'UC0987654321zyxwvu09876',
      title: 'Another Channel',
      url: 'https://www.youtube.com/channel/UC0987654321zyxwvu09876',
    },
  ],
});

let fetchWithCookies;
let FetchError;
let isNetscapeFormat;
let childProcess;
let mkdtempSyncSpy;
let writeFileSyncSpy;
let chmodSyncSpy;
let rmSyncSpy;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  mkdtempSyncSpy = jest.spyOn(fs, 'mkdtempSync').mockReturnValue(FAKE_TEMP_DIR);
  writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  chmodSyncSpy = jest.spyOn(fs, 'chmodSync').mockImplementation(() => {});
  rmSyncSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

  childProcess = require('child_process');
  const mod = require('../cookiesFetcher');
  fetchWithCookies = mod.fetchWithCookies;
  FetchError = mod.FetchError;
  isNetscapeFormat = mod.isNetscapeFormat;
});

afterEach(() => {
  mkdtempSyncSpy.mockRestore();
  writeFileSyncSpy.mockRestore();
  chmodSyncSpy.mockRestore();
  rmSyncSpy.mockRestore();
});

describe('isNetscapeFormat', () => {
  test('returns true for buffer with Netscape header', () => {
    expect(isNetscapeFormat(validBuffer)).toBe(true);
  });

  test('returns false for buffer without Netscape header', () => {
    expect(isNetscapeFormat(Buffer.from('random data'))).toBe(false);
  });
});

describe('fetchWithCookies', () => {
  test('rejects a buffer that is not in Netscape format', async () => {
    const badBuffer = Buffer.from('not a cookies file');

    await expect(fetchWithCookies(badBuffer)).rejects.toThrow(FetchError);
    await expect(fetchWithCookies(badBuffer)).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    });
  });

  test('returns parsed entries on yt-dlp success', async () => {
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, validYtdlpOutput, '');
    });

    const result = await fetchWithCookies(validBuffer);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      channelId: 'UC1234567890abcdef12345',
      title: 'Test Channel',
      url: 'https://www.youtube.com/channel/UC1234567890abcdef12345',
    });
    expect(result[1]).toEqual({
      channelId: 'UC0987654321zyxwvu09876',
      title: 'Another Channel',
      url: 'https://www.youtube.com/channel/UC0987654321zyxwvu09876',
    });
  });

  test('always deletes temp dir on success', async () => {
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, validYtdlpOutput, '');
    });

    await fetchWithCookies(validBuffer);

    expect(rmSyncSpy).toHaveBeenCalledWith(FAKE_TEMP_DIR, {
      recursive: true,
      force: true,
    });
  });

  test('deletes temp dir on yt-dlp failure', async () => {
    const error = new Error('yt-dlp failed');
    error.stderr = 'some random error text';
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(error, '', 'some random error text');
    });

    await expect(fetchWithCookies(validBuffer)).rejects.toThrow(FetchError);

    expect(rmSyncSpy).toHaveBeenCalledWith(FAKE_TEMP_DIR, {
      recursive: true,
      force: true,
    });
  });

  test('classifies bot-check stderr into BOT_CHECK FetchError', async () => {
    const error = new Error('yt-dlp failed');
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(error, '', 'ERROR: Sign in to confirm you are not a bot');
    });

    await expect(fetchWithCookies(validBuffer)).rejects.toMatchObject({
      code: 'BOT_CHECK',
    });
  });

  test('throws NO_CHANNELS_FOUND when yt-dlp returns empty entries array', async () => {
    const emptyOutput = JSON.stringify({ entries: [] });
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, emptyOutput, '');
    });

    await expect(fetchWithCookies(validBuffer)).rejects.toThrow(FetchError);
    await expect(fetchWithCookies(validBuffer)).rejects.toMatchObject({
      code: 'NO_CHANNELS_FOUND',
    });
  });

  test('chmods temp cookies file to 0600', async () => {
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, validYtdlpOutput, '');
    });

    await fetchWithCookies(validBuffer);

    const expectedPath = path.join(FAKE_TEMP_DIR, 'cookies.txt');
    expect(chmodSyncSpy).toHaveBeenCalledWith(expectedPath, 0o600);
  });

  test('deduplicates entries by channelId', async () => {
    const dupeOutput = JSON.stringify({
      entries: [
        {
          channel_id: 'UC1234567890abcdef12345',
          title: 'Test Channel',
          url: 'https://www.youtube.com/channel/UC1234567890abcdef12345',
        },
        {
          channel_id: 'UC1234567890abcdef12345',
          title: 'Test Channel Dupe',
          url: 'https://www.youtube.com/channel/UC1234567890abcdef12345',
        },
      ],
    });
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, dupeOutput, '');
    });

    const result = await fetchWithCookies(validBuffer);

    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe('UC1234567890abcdef12345');
  });

  test('skips entries without UC prefix in channel_id', async () => {
    const mixedOutput = JSON.stringify({
      entries: [
        {
          channel_id: 'UC1234567890abcdef12345',
          title: 'Valid Channel',
          url: 'https://www.youtube.com/channel/UC1234567890abcdef12345',
        },
        {
          channel_id: 'XX_not_a_channel',
          title: 'Invalid Channel',
          url: 'https://www.youtube.com/channel/XX_not_a_channel',
        },
      ],
    });
    childProcess.execFile.mockImplementation((_cmd, _args, _opts, cb) => {
      cb(null, mixedOutput, '');
    });

    const result = await fetchWithCookies(validBuffer);

    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe('UC1234567890abcdef12345');
  });
});
