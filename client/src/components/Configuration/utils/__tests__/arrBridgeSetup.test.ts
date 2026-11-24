import {
  categoryRowLabel,
  describeMatching,
  getArrBridgeSettingsError,
  getCategoriesError,
  getSetupValues,
  hasOnlyDefaultCategories,
  releaseResolution,
  removeAfterImportWarning,
  stagingFolderOnHost,
  GRAB_STATE_LABELS,
  GRAB_RETRY_NOTES,
  SERVER_RETRY_OUTCOMES,
  blockedGrabText,
  grabRetryNote,
  requestedRetryNote,
  ArrCategory,
} from '../arrBridgeSetup';

const category = (name: string): ArrCategory => ({ name, subfolder: null });

describe('getSetupValues', () => {
  test('builds the values for a plain http address with a port', () => {
    expect(getSetupValues({ protocol: 'http:', hostname: 'nas', port: '3087' })).toEqual({
      indexerUrl: 'http://nas:3087/arr/newznab',
      apiPath: '/api',
      host: 'nas',
      port: '3087',
      useSsl: false,
      urlBase: '/arr/sabnzbd',
    });
  });

  test('uses port 443 and SSL for an https address without a port', () => {
    expect(getSetupValues({ protocol: 'https:', hostname: 'youtarr.example.com', port: '' })).toEqual({
      indexerUrl: 'https://youtarr.example.com/arr/newznab',
      apiPath: '/api',
      host: 'youtarr.example.com',
      port: '443',
      useSsl: true,
      urlBase: '/arr/sabnzbd',
    });
  });

  test('uses port 80 for an http address without a port', () => {
    expect(getSetupValues({ protocol: 'http:', hostname: 'youtarr.lan', port: '' }).port).toBe('80');
  });

  // Inside Docker, the address the browser uses means nothing to Sonarr.
  test('for apps in Docker on Youtarr\'s network, the values are the container name and port', () => {
    expect(getSetupValues({ protocol: 'https:', hostname: 'youtarr.example.com', port: '' }, 'docker')).toEqual({
      indexerUrl: 'http://youtarr:3011/arr/newznab',
      apiPath: '/api',
      host: 'youtarr',
      port: '3011',
      useSsl: false,
      urlBase: '/arr/sabnzbd',
    });
  });
});

describe('releaseResolution', () => {
  test.each([
    ['', '480', 480],
    ['', '1440', 1080],
    ['', '360', 480],
    ['', '2160', 2160],
    ['720', '480', 720],
    ['2160', '1080', 2160],
    ['', 'best', 1080],
  ])('bridge "%s" with preferred "%s" and no label limit labels releases up to %sp', (bridge, preferred, expected) => {
    expect(releaseResolution(bridge, preferred, '')).toBe(expected);
  });

  test.each([
    ['1080', '480', '720', 720],
    ['', '2160', '480', 480],
    ['720', '480', '1080', 720],
    ['', 'best', '720', 720],
  ])('bridge "%s" with preferred "%s" and label limit "%s" labels releases up to %sp', (bridge, preferred, limit, expected) => {
    expect(releaseResolution(bridge, preferred, limit)).toBe(expected);
  });
});

describe('stagingFolderOnHost', () => {
  test('is the .arr-staging folder inside the downloads folder', () => {
    expect(stagingFolderOnHost('/mnt/media/youtube')).toBe('/mnt/media/youtube/.arr-staging');
    expect(stagingFolderOnHost('/mnt/media/youtube/ ')).toBe('/mnt/media/youtube/.arr-staging');
  });

  test('is unknown without a downloads folder', () => {
    expect(stagingFolderOnHost('')).toBeNull();
    expect(stagingFolderOnHost(null)).toBeNull();
    expect(stagingFolderOnHost(undefined)).toBeNull();
  });
});

describe('categoryRowLabel', () => {
  test.each([
    ['tv', 'TV grabs are saved to'],
    ['movies', 'Movie grabs are saved to'],
    ['tv-4k', 'Grabs in category tv-4k are saved to'],
  ])('%s -> %s', (name, label) => {
    expect(categoryRowLabel(name)).toBe(label);
  });
});

describe('hasOnlyDefaultCategories', () => {
  test('is true for tv and movies in any order', () => {
    expect(hasOnlyDefaultCategories([category('movies'), category('tv')])).toBe(true);
  });

  test.each([
    ['one more', [category('tv'), category('movies'), category('tv-4k')]],
    ['one fewer', [category('tv')]],
    ['another name', [category('tv'), category('films')]],
  ])('is false with %s', (_label, categories) => {
    expect(hasOnlyDefaultCategories(categories)).toBe(false);
  });
});

describe('getCategoriesError', () => {
  test('accepts the default categories', () => {
    expect(getCategoriesError([category('tv'), category('movies')])).toBeNull();
  });

  test('needs at least one category', () => {
    expect(getCategoriesError([])).toBe('Add at least one category.');
  });

  test('allows at most 10 categories', () => {
    const eleven = Array.from({ length: 11 }, (_, index) => category(`cat${index}`));
    expect(getCategoriesError(eleven)).toBe('Use at most 10 categories.');
  });

  test.each(['a b', '../x', '', '-tv', 'x'.repeat(33)])('refuses the name %p', (name) => {
    expect(getCategoriesError([category(name)])).toBe(
      'Category names use letters, digits, - and _, and start with a letter or digit (up to 32 characters).'
    );
  });

  test('refuses two names that differ only by case', () => {
    expect(getCategoriesError([category('tv'), category('TV')])).toBe('Each category needs a different name.');
  });

  // The subfolder list can hold an old name the server refuses for a category.
  test.each(['Kids & Co', 'a/b', '..', 'playlists', '__Shows', 'x'.repeat(101)])(
    'names the category whose subfolder %p cannot be used',
    (subfolder) => {
      expect(getCategoriesError([category('movies'), { name: 'tv', subfolder }])).toBe(
        'The subfolder chosen for "tv" cannot be used for a category. Pick another one.'
      );
    }
  );

  test.each([null, 'Shows', 'Kids TV-2_old', '##ROOT##', '##USE_GLOBAL_DEFAULT##'])(
    'accepts the subfolder choice %p',
    (subfolder) => {
      expect(getCategoriesError([{ name: 'tv', subfolder }])).toBeNull();
    }
  );
});

describe('getArrBridgeSettingsError', () => {
  const valid = {
    arrBridgeCategories: [category('tv'), category('movies')],
    arrBridgeMinTvMinutes: 10,
    arrBridgeMinMovieMinutes: 60,
    arrBridgeStagingPath: '',
    arrBridgeStagingRetentionDays: 7,
  };

  test('accepts the defaults and an absolute staging path', () => {
    expect(getArrBridgeSettingsError(valid)).toBeNull();
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeStagingPath: ' /downloads/.arr-staging/ ' })).toBeNull();
  });

  test('passes on what is wrong with the categories', () => {
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeCategories: [] })).toBe(
      'Sonarr / Radarr: Add at least one category.'
    );
  });

  test.each([-1, 601, Number.NaN])('refuses a shortest length of %p', (minutes) => {
    const message = 'Sonarr / Radarr: the shortest length must be from 0 to 600 minutes';
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeMinTvMinutes: minutes })).toBe(message);
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeMinMovieMinutes: minutes })).toBe(message);
  });

  test.each([0, 366, 1.5, Number.NaN])('refuses a retention of %p days', (days) => {
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeStagingRetentionDays: days })).toBe(
      'Sonarr / Radarr: remove files nobody imported after 1 to 365 days'
    );
  });

  test.each(['downloads/staging', '/data/../etc', '/', ' // ', `/${'x'.repeat(500)}`])('refuses the staging path %p', (stagingPath) => {
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeStagingPath: stagingPath })).toMatch(
      /must be an absolute path/
    );
  });

  // The same forms the server accepts (modules/arrBridge/clientPaths.js).
  test.each([
    'E:\\Youtube16TB\\.arr-staging',
    'E:\\Youtube16TB\\.arr-staging\\ ',
    'e:/Youtube16TB/.arr-staging',
    '\\\\nas\\videos\\.arr-staging',
    '\\\\nas\\arr-staging',
  ])('accepts the Windows staging path %p', (stagingPath) => {
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeStagingPath: stagingPath })).toBeNull();
  });

  test.each(['E:\\', 'E:', 'E:Videos', 'E:\\Videos\\..\\Windows', '\\\\nas', '/data/.arr-staging\n/etc'])(
    'refuses the staging path %p',
    (stagingPath) => {
      expect(getArrBridgeSettingsError({ ...valid, arrBridgeStagingPath: stagingPath })).toMatch(
        /must be an absolute path/
      );
    }
  );
});

describe('describeMatching', () => {
  const base = {
    looseMatching: false,
    minTvMinutes: 10,
    minMovieMinutes: 60,
    excludeCount: 30,
    sonarrConnected: false,
    radarrConnected: false,
  };

  test('strict matching needs the episode marker and the movie year', () => {
    const text = describeMatching(base).join(' ');

    expect(text).toContain('S01E05');
    expect(text).toContain('its year');
    expect(text).toContain('30 excluded words');
    expect(text).toContain('shorter than 10 minutes');
    expect(text).toContain('shorter than 60 minutes');
    expect(text).not.toContain('runtime');
  });

  test('loose matching says what it gives up', () => {
    const text = describeMatching({ ...base, looseMatching: true }).join(' ');

    expect(text).toContain('even without a season');
    expect(text).toContain('without its year');
    expect(text).not.toContain('S01E05');
  });

  test('a Sonarr connection adds the episode title and replaces the minimum length', () => {
    const text = describeMatching({ ...base, sonarrConnected: true }).join(' ');

    expect(text).toContain("episode's name");
    expect(text).toContain('When Sonarr knows the runtime');
  });

  test('a Radarr connection adds the runtime check for movies', () => {
    const text = describeMatching({ ...base, radarrConnected: true }).join(' ');

    expect(text).toContain("movie's runtime");
    expect(text).not.toContain("episode's name");
  });

  test('one excluded word is not plural, and none drops the sentence', () => {
    expect(describeMatching({ ...base, excludeCount: 1 }).join(' ')).toContain('the 1 excluded word ');
    expect(describeMatching({ ...base, excludeCount: 0 }).join(' ')).not.toContain('excluded word');
  });
});

describe('GRAB_STATE_LABELS', () => {
  test('never claims an import it cannot know about', () => {
    expect(GRAB_STATE_LABELS['handed-off'].label).toBe('Taken by Sonarr/Radarr');
    expect(Object.values(GRAB_STATE_LABELS).map((entry) => entry.label)).not.toContain('Imported');
  });

  test('has a label for every state', () => {
    expect(Object.keys(GRAB_STATE_LABELS).sort()).toEqual(
      ['blocked', 'cancelled', 'downloading', 'failed', 'handed-off', 'ready', 'waiting']
    );
  });
});

describe('blockedGrabText', () => {
  const formatTime = (value: string) => `<${value}>`;
  const waiting = { blockedAt: '2025-06-10T10:02:00.000Z', nextTryAt: 'T', downloadsPaused: false };

  test('names the grab\'s own block and the next check', () => {
    expect(blockedGrabText(waiting, formatTime)).toBe('YouTube blocked this download. Youtarr checks again at <T>.');
  });

  test('names another grab\'s block for a grab that was not blocked itself', () => {
    expect(blockedGrabText({ ...waiting, blockedAt: null }, formatTime)).toBe(
      'YouTube blocked another grab, so this one waits too. Youtarr checks again at <T>.'
    );
  });

  test.each([
    ['no next check is set', null, formatTime],
    ['the time cannot be shown', 'T', () => ''],
  ])('says soon when %s', (_name, nextTryAt, format) => {
    expect(blockedGrabText({ ...waiting, nextTryAt }, format)).toBe(
      'YouTube blocked this download. Youtarr checks again soon.'
    );
  });

  test.each([['T'], [null]])('promises no time while downloads are paused (next check %p)', (nextTryAt) => {
    expect(blockedGrabText({ ...waiting, nextTryAt, downloadsPaused: true }, formatTime)).toBe(
      'YouTube blocked this download. Youtarr checks again when downloads resume.'
    );
  });
});

describe('requestedRetryNote', () => {
  test('is null when no try is asked for', () => {
    expect(requestedRetryNote({ retryRequested: false, downloadsPaused: true })).toBeNull();
  });

  test('says the try starts when downloads resume, while they are paused', () => {
    expect(requestedRetryNote({ retryRequested: true, downloadsPaused: true })).toBe(
      'Downloads are paused, so this will start when they resume.'
    );
  });

  test('says the try comes in a moment once downloads run again', () => {
    expect(requestedRetryNote({ retryRequested: true, downloadsPaused: false })).toBe(
      'Youtarr will try again in a moment.'
    );
  });
});

describe('grabRetryNote', () => {
  test('is null for a grab that was not tried', () => {
    expect(grabRetryNote({ state: 'blocked' }, undefined)).toBeNull();
  });

  test('is the note of the outcome while the grab is in the state the note is about', () => {
    expect(grabRetryNote({ state: 'downloading' }, 'started')).toBe('Trying again now.');
  });

  test('is null once the grab is in another state', () => {
    expect(grabRetryNote({ state: 'ready' }, 'started')).toBeNull();
  });

  test('is null for a try that waits for paused downloads: the server reports that one', () => {
    expect(grabRetryNote({ state: 'blocked' }, 'paused')).toBeNull();
  });

  test('says a try that could not start waits for the next check', () => {
    expect(grabRetryNote({ state: 'blocked' }, 'deferred')).toBe(
      'Youtarr could not start it right now. It waits for the next check.'
    );
  });
});

describe('GRAB_RETRY_NOTES', () => {
  test('has a note for every answer the server gives, except the one the server reports itself', () => {
    const noted = SERVER_RETRY_OUTCOMES.filter((outcome) => outcome !== 'paused');

    expect(noted.map((outcome) => grabRetryNote({ state: GRAB_RETRY_NOTES[outcome].state }, outcome))).not.toContain(null);
  });

  test('ties each note to a state the list knows', () => {
    const states = Object.keys(GRAB_STATE_LABELS);

    expect(Object.values(GRAB_RETRY_NOTES).every((note) => states.includes(note.state))).toBe(true);
  });
});

describe('removeAfterImportWarning', () => {
  test('says nothing when both apps are connected', () => {
    expect(removeAfterImportWarning({ sonarr: true, radarr: true })).toBeNull();
  });

  test('says no video is removed when neither app is connected', () => {
    expect(removeAfterImportWarning({ sonarr: false, radarr: false })).toBe(
      'Sonarr and Radarr are not connected in step 3. Youtarr cannot confirm an import without a connection, so it keeps every grabbed video.'
    );
  });

  test('names Sonarr when only Radarr is connected', () => {
    expect(removeAfterImportWarning({ sonarr: false, radarr: true })).toBe(
      'Sonarr is not connected in step 3. Youtarr cannot confirm its imports, so it keeps every video Sonarr grabs.'
    );
  });

  test('names Radarr when only Sonarr is connected', () => {
    expect(removeAfterImportWarning({ sonarr: true, radarr: false })).toBe(
      'Radarr is not connected in step 3. Youtarr cannot confirm its imports, so it keeps every video Radarr grabs.'
    );
  });
});
