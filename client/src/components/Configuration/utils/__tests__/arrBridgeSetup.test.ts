import {
  describeMatching,
  getArrBridgeSettingsError,
  getCategoriesError,
  getSetupValues,
  GRAB_STATE_LABELS,
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
      'Sonarr / Radarr: keep staged files for 1 to 365 days'
    );
  });

  test.each(['downloads/staging', '/data/../etc', '/', ' // ', `/${'x'.repeat(500)}`])('refuses the staging path %p', (stagingPath) => {
    expect(getArrBridgeSettingsError({ ...valid, arrBridgeStagingPath: stagingPath })).toMatch(
      /must be an absolute path/
    );
  });
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
      ['cancelled', 'downloading', 'failed', 'handed-off', 'ready', 'waiting']
    );
  });
});
