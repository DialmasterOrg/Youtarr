/* eslint-env jest */
jest.mock('fs');
jest.mock('../../logger', () => ({ debug: jest.fn(), warn: jest.fn(), info: jest.fn(), error: jest.fn() }));
jest.mock('../configModule', () => ({ getCookiesPath: jest.fn() }));
jest.mock('../externalCookies', () => ({
  getExternalCookiesPath: jest.fn(() => null),
  readExternalCookies: jest.fn(),
}));
jest.mock('../../models/videomembersaccess', () => ({
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../../models/channelvideo', () => ({ findAll: jest.fn() }));

const COOKIES_PATH = '/app/config/cookies.user.txt';
const HOUR_MS = 60 * 60 * 1000;

let fs;
let configModule;
let externalCookies;
let VideoMembersAccess;
let ChannelVideo;
let membersAccess;

function useCookieFile(contents = 'cookie-file', { size = 11, mtimeMs = 1000 } = {}) {
  configModule.getCookiesPath.mockReturnValue(COOKIES_PATH);
  fs.statSync.mockReturnValue({ size, mtimeMs });
  fs.readFileSync.mockReturnValue(Buffer.from(contents));
}

function record(overrides = {}) {
  return {
    youtube_id: 'aaaaaaaaaaa',
    access: 'denied',
    cookie_key: membersAccess.getContext().cookieKey,
    checked_at: new Date(Date.now() - HOUR_MS),
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  fs = require('fs');
  configModule = require('../configModule');
  externalCookies = require('../externalCookies');
  VideoMembersAccess = require('../../models/videomembersaccess');
  ChannelVideo = require('../../models/channelvideo');
  membersAccess = require('../membersAccess');
  configModule.getCookiesPath.mockReturnValue(null);
  VideoMembersAccess.findAll.mockResolvedValue([]);
  VideoMembersAccess.bulkCreate.mockResolvedValue([]);
  VideoMembersAccess.update.mockResolvedValue([0]);
  ChannelVideo.findAll.mockResolvedValue([]);
});

describe('getContext', () => {
  test('reports no cookies when none are configured', () => {
    expect(membersAccess.getContext()).toEqual({ cookiesConfigured: false, cookieKey: null });
  });

  test('keys the cookies by a hash of the file contents', () => {
    useCookieFile('first');
    const first = membersAccess.getContext().cookieKey;
    useCookieFile('second', { mtimeMs: 2000 });

    expect(membersAccess.getContext().cookieKey).not.toBe(first);
  });

  test('does not re-read an unchanged file', () => {
    useCookieFile();
    membersAccess.getContext();
    membersAccess.getContext();

    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
  });

  test('reads an external cookie file through the external reader', () => {
    configModule.getCookiesPath.mockReturnValue('/cookies/external.txt');
    externalCookies.getExternalCookiesPath.mockReturnValue('/cookies/external.txt');
    externalCookies.readExternalCookies.mockReturnValue({ contents: Buffer.from('external') });
    fs.statSync.mockReturnValue({ size: 8, mtimeMs: 1 });

    membersAccess.getContext();

    expect(externalCookies.readExternalCookies).toHaveBeenCalledWith('/cookies/external.txt');
  });

  test('has no key when the cookie file cannot be read', () => {
    configModule.getCookiesPath.mockReturnValue(COOKIES_PATH);
    fs.statSync.mockImplementation(() => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); });

    expect(membersAccess.getContext()).toEqual({ cookiesConfigured: true, cookieKey: null });
  });
});

describe('describe', () => {
  test('is no_cookies whatever is recorded when no cookies are configured', () => {
    expect(membersAccess.describe({ access: 'confirmed' }, { cookiesConfigured: false, cookieKey: null })).toBe('no_cookies');
  });

  test('reads a fresh verdict made with the same cookies', () => {
    useCookieFile();
    const context = membersAccess.getContext();

    expect(membersAccess.describe(record({ access: 'confirmed' }), context)).toBe('confirmed');
  });

  test('is unchecked once a verdict is 24 hours old', () => {
    useCookieFile();
    const context = membersAccess.getContext();

    expect(membersAccess.describe(record({ checked_at: new Date(Date.now() - 25 * HOUR_MS) }), context)).toBe('unchecked');
  });

  test('is unchecked when the verdict was made with other cookies', () => {
    useCookieFile();
    const context = membersAccess.getContext();

    expect(membersAccess.describe(record({ cookie_key: 'other' }), context)).toBe('unchecked');
  });
});

describe('getStates', () => {
  test('covers videos the channel listing marks members-only', async () => {
    useCookieFile();
    ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'bbbbbbbbbbb' }]);

    const states = await membersAccess.getStates(['bbbbbbbbbbb', 'ccccccccccc']);

    expect([...states]).toEqual([['bbbbbbbbbbb', 'unchecked']]);
  });

  test('covers recorded videos of untracked channels', async () => {
    useCookieFile();
    VideoMembersAccess.findAll.mockResolvedValue([record()]);

    const states = await membersAccess.getStates(['aaaaaaaaaaa']);

    expect(states.get('aaaaaaaaaaa')).toBe('denied');
  });
});

describe('buildDownloadFilter', () => {
  test('keeps members-only videos out of a run without cookies', async () => {
    await expect(membersAccess.buildDownloadFilter({ cookiesEnabled: false })).resolves.toBe('availability!=subscriber_only');
  });

  test('adds no clause when the cookies have no fresh denials', async () => {
    useCookieFile();

    await expect(membersAccess.buildDownloadFilter({ cookiesEnabled: true })).resolves.toBeNull();
  });

  test('leaves out fresh denials by id', async () => {
    useCookieFile();
    VideoMembersAccess.findAll.mockResolvedValue([{ youtube_id: 'aaaaaaaaaaa' }, { youtube_id: 'bb-bbbbbbbb' }]);

    await expect(membersAccess.buildDownloadFilter({ cookiesEnabled: true }))
      .resolves.toBe('id!~=\'^(?:aaaaaaaaaaa|bb-bbbbbbbb)$\'');
  });

  test('attempts denied videos the user picked', async () => {
    useCookieFile();
    VideoMembersAccess.findAll.mockResolvedValue([{ youtube_id: 'aaaaaaaaaaa' }]);

    await expect(membersAccess.buildDownloadFilter({ cookiesEnabled: true, skipDenied: false })).resolves.toBeNull();
  });

  test('attempts every video when the denials cannot be read', async () => {
    useCookieFile();
    VideoMembersAccess.findAll.mockRejectedValue(new Error('db down'));

    await expect(membersAccess.buildDownloadFilter({ cookiesEnabled: true })).resolves.toBeNull();
  });
});

describe('recordFetchOutcome', () => {
  test('ignores a video that is not members-only', async () => {
    useCookieFile();

    await expect(membersAccess.recordFetchOutcome('aaaaaaaaaaa', { availability: 'public' })).resolves.toBeNull();
  });

  test('confirms access when yt-dlp read a members-only video with cookies', async () => {
    useCookieFile();

    await membersAccess.recordFetchOutcome('aaaaaaaaaaa', { availability: 'subscriber_only' });

    expect(VideoMembersAccess.bulkCreate.mock.calls[0][0][0]).toMatchObject({ youtube_id: 'aaaaaaaaaaa', access: 'confirmed' });
  });

  test('records a denial when the cookies were refused as a non-member', async () => {
    useCookieFile();

    const state = await membersAccess.recordFetchOutcome('aaaaaaaaaaa', { errorMessage: 'ERROR: Join this channel to get access to members-only content' });

    expect(state).toBe('denied');
  });

  test('records no verdict when YouTube rejected the cookies themselves', async () => {
    useCookieFile();

    const state = await membersAccess.recordFetchOutcome('aaaaaaaaaaa', {
      errorMessage: 'WARNING: The provided YouTube account cookies are no longer valid\nERROR: Join this channel',
    });

    expect(state).toBe('unchecked');
  });

  test('is no_cookies for a refusal without cookies', async () => {
    await expect(membersAccess.recordFetchOutcome('aaaaaaaaaaa', { errorMessage: 'Join this channel' })).resolves.toBe('no_cookies');
  });

  test('still answers when the record cannot be written', async () => {
    useCookieFile();
    VideoMembersAccess.bulkCreate.mockRejectedValue(new Error('db down'));

    await expect(membersAccess.recordFetchOutcome('aaaaaaaaaaa', { errorMessage: 'Join this channel' })).resolves.toBe('denied');
  });
});

describe('recordDownloadOutcome', () => {
  test('records denials from a run that used the cookies', async () => {
    useCookieFile();

    await membersAccess.recordDownloadOutcome({ membersOnlyIds: new Set(['aaaaaaaaaaa']), downloadedIds: [], usedCookies: true });

    expect(VideoMembersAccess.bulkCreate.mock.calls[0][0][0]).toMatchObject({ access: 'denied' });
  });

  test('records no denial from an anonymous run', async () => {
    useCookieFile();

    await membersAccess.recordDownloadOutcome({ membersOnlyIds: new Set(['aaaaaaaaaaa']), downloadedIds: [], usedCookies: false });

    expect(VideoMembersAccess.bulkCreate.mock.calls[0][0][0]).toMatchObject({ access: null });
  });

  test('records no denial when the run printed that the cookies are no longer valid', async () => {
    useCookieFile();

    await membersAccess.recordDownloadOutcome({
      membersOnlyIds: new Set(['aaaaaaaaaaa']),
      downloadedIds: [],
      usedCookies: true,
      stderr: 'WARNING: [youtube] The provided YouTube account cookies are no longer valid.',
    });

    expect(VideoMembersAccess.bulkCreate.mock.calls[0][0][0]).toMatchObject({ access: null });
  });

  test('confirms access for downloaded members-only videos', async () => {
    useCookieFile();
    ChannelVideo.findAll.mockResolvedValue([{ youtube_id: 'bbbbbbbbbbb' }]);

    await membersAccess.recordDownloadOutcome({ membersOnlyIds: new Set(), downloadedIds: ['bbbbbbbbbbb', 'ccccccccccc'], usedCookies: true });

    expect(VideoMembersAccess.bulkCreate.mock.calls[0][0]).toEqual([
      expect.objectContaining({ youtube_id: 'bbbbbbbbbbb', access: 'confirmed' }),
    ]);
  });
});

describe('clearVerdicts', () => {
  test('forgets the verdicts of the given videos', async () => {
    await membersAccess.clearVerdicts(['aaaaaaaaaaa']);

    expect(VideoMembersAccess.update).toHaveBeenCalledWith(
      { access: null, cookie_key: null, checked_at: null },
      { where: { youtube_id: ['aaaaaaaaaaa'] } }
    );
  });
});
