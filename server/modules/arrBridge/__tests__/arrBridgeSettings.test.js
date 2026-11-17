/* eslint-env jest */
const { ArrUnavailableError } = require('../arrClient');
const { createArrBridgeSettings } = require('../arrBridgeSettings');

const SONARR_KEY = '5p1ke0000000000000000000000000ab';
const RADARR_KEY = 'r4d4rr00000000000000000000000000';

function setup(config = {}, {
  status, folderNames, parse, mappings, clientHosts, hostDownloadsFolder = null,
} = {}) {
  const configModule = {
    config,
    getConfig: () => configModule.config,
    updateConfig: jest.fn((next) => {
      configModule.config = next;
    }),
  };
  const client = {
    fetchStatus: jest.fn(status || (async () => ({ appName: 'Sonarr', version: '4.0.20.3014' }))),
    fetchFolderNames: jest.fn(folderNames || (async () => ['movies', 'tv'])),
    fetchRemotePathMappings: jest.fn(mappings || (async () => [])),
    fetchBridgeClientHosts: jest.fn(clientHosts || (async () => ['youtarr'])),
    fetchParsedEpisode: jest.fn(parse || (async () => ({ series: null, episodes: [] }))),
    fetchParsedMovie: jest.fn(parse || (async () => null)),
  };
  const staging = {
    stagingRoot: () => '/data/.arr-staging',
    clientPath: (localPath) => (configModule.config.arrBridgeStagingPath || localPath),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const settings = createArrBridgeSettings({
    configModule, client, staging, getHostDownloadsFolder: () => hostDownloadsFolder, logger,
  });
  return { settings, configModule, client, logger };
}

const { PLACEHOLDER_TITLES } = require('../searchService');

const logged = (logger) => JSON.stringify(
  [logger.info, logger.warn, logger.error, logger.debug].map((method) => method.mock.calls)
);

describe('arrBridgeSettings', () => {
  describe('the bridge key', () => {
    test('creates the key the first time it is asked for, keeping the rest of the config', () => {
      const { settings, configModule } = setup({ plexApiKey: 'keep-me' });

      const key = settings.getOrCreateKey();

      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(configModule.config).toEqual({ plexApiKey: 'keep-me', arrBridgeApiKey: key });
    });

    test('returns the stored key afterwards without saving again', () => {
      const { settings, configModule } = setup({ arrBridgeApiKey: 'a'.repeat(64) });

      expect(settings.getOrCreateKey()).toBe('a'.repeat(64));
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('regenerate replaces the key', () => {
      const { settings, configModule } = setup({ arrBridgeApiKey: 'a'.repeat(64) });

      const key = settings.regenerateKey();

      expect(key).toMatch(/^[0-9a-f]{64}$/);
      expect(key).not.toBe('a'.repeat(64));
      expect(configModule.config.arrBridgeApiKey).toBe(key);
    });

    test('never writes a key to the log', () => {
      const { settings, logger } = setup({});

      const first = settings.getOrCreateKey();
      const second = settings.regenerateKey();

      expect(logged(logger)).not.toContain(first);
      expect(logged(logger)).not.toContain(second);
    });
  });

  describe('getStatus', () => {
    test('shows each connection as its normalized URL and whether a key is stored, never the key', () => {
      const { settings } = setup({
        arrBridgeEnabled: true,
        arrBridgeSonarrUrl: 'http://sonarr:8989/',
        arrBridgeSonarrApiKey: SONARR_KEY,
      });

      const status = settings.getStatus();

      expect(status).toEqual({
        enabled: true,
        stagingRoot: '/data/.arr-staging',
        stagingClientPath: '/data/.arr-staging',
        connections: {
          sonarr: { url: 'http://sonarr:8989', keySet: true },
          radarr: { url: null, keySet: false },
        },
      });
      expect(JSON.stringify(status)).not.toContain(SONARR_KEY);
    });

    test('a hand-edited URL with credentials shows as not set', () => {
      const { settings } = setup({
        arrBridgeSonarrUrl: 'http://admin:hunter2@sonarr:8989',
        arrBridgeSonarrApiKey: SONARR_KEY,
      });

      const status = settings.getStatus();

      expect(status.connections.sonarr).toEqual({ url: null, keySet: false });
      expect(JSON.stringify(status)).not.toContain('hunter2');
    });

    test('shows the staging folder as Sonarr and Radarr see it', () => {
      const { settings } = setup({ arrBridgeStagingPath: '/downloads/youtarr-staging' });

      expect(settings.getStatus().stagingClientPath).toBe('/downloads/youtarr-staging');
    });
  });

  describe('saveConnection', () => {
    test('saves the URL and the key together once the app answers', async () => {
      const { settings, configModule, client } = setup({ plexApiKey: 'keep-me' });

      const result = await settings.saveConnection('sonarr', { url: ' http://sonarr:8989/ ', apiKey: ` ${SONARR_KEY} ` });

      expect(client.fetchStatus).toHaveBeenCalledWith({ url: 'http://sonarr:8989', apiKey: SONARR_KEY });
      expect(result).toEqual({
        ok: true,
        appName: 'Sonarr',
        version: '4.0.20.3014',
        connection: { url: 'http://sonarr:8989', keySet: true },
      });
      expect(configModule.config).toEqual({
        plexApiKey: 'keep-me',
        arrBridgeSonarrUrl: 'http://sonarr:8989',
        arrBridgeSonarrApiKey: SONARR_KEY,
      });
    });

    test('saves a Radarr connection in its own fields', async () => {
      const { settings, configModule } = setup({}, {
        status: async () => ({ appName: 'Radarr', version: '6.4.4.10685' }),
      });

      await settings.saveConnection('radarr', { url: 'http://radarr:7878', apiKey: RADARR_KEY });

      expect(configModule.config).toEqual({
        arrBridgeRadarrUrl: 'http://radarr:7878',
        arrBridgeRadarrApiKey: RADARR_KEY,
      });
    });

    test.each([
      ['unreachable', 'Could not reach Sonarr at that address.'],
      ['unauthorized', 'Sonarr rejected the API key.'],
      ['redirect', 'The address answers with a redirect. Use the address it redirects to.'],
      ['not-json', 'The address did not answer like Sonarr. It may be a login page or another app.'],
    ])('saves nothing when the app is %s', async (reason, message) => {
      const { settings, configModule } = setup({}, {
        status: async () => {
          throw new ArrUnavailableError(reason);
        },
      });

      const result = await settings.saveConnection('sonarr', { url: 'http://sonarr:8989', apiKey: SONARR_KEY });

      expect(result).toEqual({ ok: false, reason, message });
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    // "Could not reach" alone does not say what to change. These three are
    // what a Docker setup runs into, and each has a different fix.
    describe('says why the app could not be reached', () => {
      const attempt = async (url, code) => {
        const { settings, configModule } = setup({}, {
          status: async () => {
            throw new ArrUnavailableError('unreachable', { code });
          },
        });
        const result = await settings.saveConnection('sonarr', { url, apiKey: SONARR_KEY });
        expect(configModule.updateConfig).not.toHaveBeenCalled();
        return result;
      };

      test.each(['ENOTFOUND', 'EAI_AGAIN'])('a name that does not resolve (%s)', async (code) => {
        expect(await attempt('http://sonarr4:8989', code)).toEqual({
          ok: false,
          reason: 'unreachable',
          message: 'Youtarr could not find a server called "sonarr4". From Docker, another container\'s name only works when both containers are on the same network.',
        });
      });

      test.each(['http://localhost:8989', 'http://127.0.0.1:8989', 'http://[::1]:8989'])(
        'nothing listening at %s, which is Youtarr itself',
        async (url) => {
          expect(await attempt(url, 'ECONNREFUSED')).toEqual({
            ok: false,
            reason: 'unreachable',
            message: 'Nothing answers at that address. Youtarr runs in a container, where localhost is Youtarr itself: use the name or IP address of the machine Sonarr runs on.',
          });
        }
      );

      test('nothing listening at another address', async () => {
        expect(await attempt('http://192.168.1.20:8990', 'ECONNREFUSED')).toEqual({
          ok: false,
          reason: 'unreachable',
          message: 'Nothing answers at that address. Check the port, and that Sonarr is running.',
        });
      });

      test.each(['ERR_CANCELED', 'ECONNABORTED', 'ETIMEDOUT'])('no answer in time (%s)', async (code) => {
        expect(await attempt('http://192.168.1.174:8989', code)).toEqual({
          ok: false,
          reason: 'unreachable',
          message: 'Sonarr did not answer in time. Check that Youtarr\'s container can reach that address: a port published only on the host\'s localhost cannot be reached from a container.',
        });
      });

      test('a localhost address that times out is still explained as Youtarr itself', async () => {
        const result = await attempt('http://localhost:8989', 'ERR_CANCELED');

        expect(result.message).toMatch(/localhost is Youtarr itself/);
      });

      test('the stored test explains it the same way', async () => {
        const { settings } = setup(
          { arrBridgeRadarrUrl: 'http://radarr:7878', arrBridgeRadarrApiKey: RADARR_KEY },
          {
            status: async () => {
              throw new ArrUnavailableError('unreachable', { code: 'ENOTFOUND' });
            },
          }
        );

        const result = await settings.testStoredConnection('radarr');

        expect(result.message).toMatch(/^Youtarr could not find a server called "radarr"\./);
      });
    });

    describe('the lookup', () => {
      const failingParse = async () => {
        throw new ArrUnavailableError('not-json');
      };

      test('asks Sonarr to parse the placeholder name and passes when it does not know it', async () => {
        const { settings, client } = setup();

        const result = await settings.saveConnection('sonarr', { url: 'http://sonarr:8989', apiKey: SONARR_KEY });

        expect(client.fetchParsedEpisode).toHaveBeenCalledWith(
          { url: 'http://sonarr:8989', apiKey: SONARR_KEY },
          PLACEHOLDER_TITLES.tv
        );
        expect(client.fetchParsedMovie).not.toHaveBeenCalled();
        expect(result).toMatchObject({ ok: true, appName: 'Sonarr' });
      });

      test('asks Radarr to parse the placeholder movie name', async () => {
        const { settings, client } = setup({}, {
          status: async () => ({ appName: 'Radarr', version: '6.4.4.10685' }),
        });

        const result = await settings.saveConnection('radarr', { url: 'http://radarr:7878', apiKey: RADARR_KEY });

        expect(client.fetchParsedMovie).toHaveBeenCalledWith(
          { url: 'http://radarr:7878', apiKey: RADARR_KEY },
          PLACEHOLDER_TITLES.movie
        );
        expect(client.fetchParsedEpisode).not.toHaveBeenCalled();
        expect(result).toMatchObject({ ok: true, appName: 'Radarr' });
      });

      test('fails with lookup-failed, saves nothing and echoes nothing of the failure', async () => {
        const { settings, configModule, logger } = setup({}, { parse: failingParse });

        const result = await settings.saveConnection('sonarr', { url: 'http://sonarr:8989', apiKey: SONARR_KEY });

        expect(result).toEqual({
          ok: false,
          reason: 'lookup-failed',
          message: 'Sonarr answered, but could not look up a title. Check that the address points at Sonarr itself and that its version is current.',
        });
        expect(configModule.updateConfig).not.toHaveBeenCalled();
        expect(logged(logger)).not.toContain(SONARR_KEY);
      });

      test('names Radarr in both places for a Radarr whose lookup fails', async () => {
        const { settings } = setup({
          arrBridgeRadarrUrl: 'http://radarr:7878',
          arrBridgeRadarrApiKey: RADARR_KEY,
        }, {
          status: async () => ({ appName: 'Radarr', version: '6.4.4.10685' }),
          parse: failingParse,
        });

        const result = await settings.testStoredConnection('radarr');

        expect(result.message).toBe('Radarr answered, but could not look up a title. Check that the address points at Radarr itself and that its version is current.');
      });

      test('is not asked when the status check already failed or named the other app', async () => {
        const wrong = setup({}, { status: async () => ({ appName: 'Radarr', version: '6' }) });
        await wrong.settings.testStoredConnection('sonarr');
        const down = setup({ arrBridgeSonarrUrl: 'http://sonarr:8989', arrBridgeSonarrApiKey: SONARR_KEY }, {
          status: async () => {
            throw new ArrUnavailableError('unauthorized');
          },
        });
        await down.settings.testStoredConnection('sonarr');

        expect(wrong.client.fetchParsedEpisode).not.toHaveBeenCalled();
        expect(down.client.fetchParsedEpisode).not.toHaveBeenCalled();
      });
    });

    test('saves nothing when the address belongs to the other app', async () => {
      const { settings, configModule } = setup({}, {
        status: async () => ({ appName: 'Radarr', version: '6.4.4.10685' }),
      });

      const result = await settings.saveConnection('sonarr', { url: 'http://radarr:7878', apiKey: RADARR_KEY });

      expect(result).toEqual({
        ok: false,
        reason: 'wrong-app',
        message: 'That address belongs to Radarr, not Sonarr.',
      });
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('an app that is neither Sonarr nor Radarr is not named back', async () => {
      const { settings } = setup({}, {
        status: async () => ({ appName: '<script>alert(1)</script>', version: '1.0' }),
      });

      const result = await settings.saveConnection('sonarr', { url: 'http://other:80', apiKey: SONARR_KEY });

      expect(result).toEqual({
        ok: false,
        reason: 'wrong-app',
        message: 'That address belongs to another app, not Sonarr.',
      });
    });

    // The stored key must never be sent to an address the caller chose.
    test('an address without a key is refused before any request, even when a key is stored', async () => {
      const { settings, configModule, client } = setup({
        arrBridgeSonarrUrl: 'http://sonarr:8989',
        arrBridgeSonarrApiKey: SONARR_KEY,
      });

      const result = await settings.saveConnection('sonarr', { url: 'http://elsewhere.example:8989' });

      expect(result).toEqual({ error: 'Enter the API key' });
      expect(client.fetchStatus).not.toHaveBeenCalled();
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('an address that is not plain http(s) is refused before any request', async () => {
      const { settings, client } = setup({});

      const result = await settings.saveConnection('sonarr', { url: 'file:///etc/passwd', apiKey: SONARR_KEY });

      expect(result).toEqual({
        error: 'Enter the address as http:// or https://, without a username, password or query',
      });
      expect(client.fetchStatus).not.toHaveBeenCalled();
    });

    test('a version that is not digits and dots is dropped', async () => {
      const { settings } = setup({}, { status: async () => ({ appName: 'Sonarr', version: '<b>4</b>' }) });

      const result = await settings.saveConnection('sonarr', { url: 'http://sonarr:8989', apiKey: SONARR_KEY });

      expect(result).toMatchObject({ ok: true, version: '' });
    });

    test('an unexpected failure reads as unreachable and logs neither the error object nor the key', async () => {
      const failure = new Error('socket hang up');
      failure.config = { headers: { 'X-Api-Key': SONARR_KEY } };
      const { settings, logger } = setup({}, {
        status: async () => {
          throw failure;
        },
      });

      const result = await settings.saveConnection('sonarr', { url: 'http://sonarr:8989', apiKey: SONARR_KEY });

      expect(result).toMatchObject({ ok: false, reason: 'unreachable' });
      expect(logged(logger)).not.toContain(SONARR_KEY);
    });
  });

  describe('checkSharedFolder', () => {
    const SONARR = { arrBridgeSonarrUrl: 'http://sonarr:8989', arrBridgeSonarrApiKey: SONARR_KEY };

    test('the app sees the folder when it lists one of the category folders Youtarr keeps there', async () => {
      const { settings, client } = setup(SONARR);

      const result = await settings.checkSharedFolder('sonarr');

      expect(client.fetchFolderNames).toHaveBeenCalledWith(
        { url: 'http://sonarr:8989', apiKey: SONARR_KEY },
        '/data/.arr-staging'
      );
      expect(result).toEqual({ ok: true, visible: true, path: '/data/.arr-staging' });
    });

    test('asks about the folder under the path Sonarr and Radarr are told', async () => {
      const { settings, client } = setup({ ...SONARR, arrBridgeStagingPath: '/downloads/youtarr-staging' });

      const result = await settings.checkSharedFolder('sonarr');

      expect(client.fetchFolderNames.mock.calls[0][1]).toBe('/downloads/youtarr-staging');
      expect(result.path).toBe('/downloads/youtarr-staging');
    });

    test('a second instance\'s category counts too', async () => {
      const { settings } = setup(
        { ...SONARR, arrBridgeCategories: [{ name: 'tv-4k', subfolder: null }] },
        { folderNames: async () => ['tv-4k'] }
      );

      expect((await settings.checkSharedFolder('sonarr')).visible).toBe(true);
    });

    test.each([
      ['a folder that is not there lists nothing', []],
      ['another folder that happens to exist at that path', ['Season 1', 'Season 2']],
    ])('the app does not see it: %s', async (_label, names) => {
      const { settings } = setup(SONARR, { folderNames: async () => names });

      expect(await settings.checkSharedFolder('sonarr'))
        .toEqual({ ok: true, visible: false, path: '/data/.arr-staging' });
    });

    test('passes on nothing of what the app listed', async () => {
      const { settings } = setup(SONARR, { folderNames: async () => ['tv', 'private-folder-name'] });

      expect(JSON.stringify(await settings.checkSharedFolder('sonarr'))).not.toContain('private-folder-name');
    });

    test('reports why the app could not be asked', async () => {
      const { settings } = setup(SONARR, {
        folderNames: async () => {
          throw new ArrUnavailableError('unauthorized');
        },
      });

      expect(await settings.checkSharedFolder('sonarr'))
        .toEqual({ ok: false, reason: 'unauthorized', message: 'Sonarr rejected the API key.' });
    });

    test('without a stored connection nothing is asked', async () => {
      const { settings, client } = setup({});

      expect(await settings.checkSharedFolder('radarr'))
        .toEqual({ ok: false, reason: 'not-configured', message: 'No Radarr connection is saved.' });
      expect(client.fetchFolderNames).not.toHaveBeenCalled();
    });

    test('never writes the key to the log', async () => {
      const { settings, logger } = setup(SONARR, {
        folderNames: async () => {
          throw new ArrUnavailableError('unreachable', { code: 'ECONNREFUSED' });
        },
      });

      await settings.checkSharedFolder('sonarr');

      expect(logged(logger)).not.toContain(SONARR_KEY);
    });

    test('asks nothing more of an app that sees the folder', async () => {
      const { settings, client } = setup(SONARR);

      await settings.checkSharedFolder('sonarr');

      expect(client.fetchFolderNames).toHaveBeenCalledTimes(1);
      expect(client.fetchStatus).not.toHaveBeenCalled();
      expect(client.fetchRemotePathMappings).not.toHaveBeenCalled();
      expect(client.fetchBridgeClientHosts).not.toHaveBeenCalled();
    });

    describe('an app that does not see the folder under the path it is told', () => {
      const WINDOWS_PATH = 'E:\\Youtube16TB\\.arr-staging';
      const onWindows = async () => ({ appName: 'Sonarr', version: '4.0.20.3014', isDocker: false, isWindows: true });
      const inDocker = async () => ({ appName: 'Sonarr', version: '4.0.20.3014', isDocker: true, isWindows: false });
      // The app lists the category folders only at these paths.
      const seesAt = (...paths) => async (_connection, folderPath) => (paths.includes(folderPath) ? ['movies', 'tv'] : []);
      const mapping = (overrides = {}) => ({
        host: 'youtarr', remotePath: '/data/.arr-staging/', localPath: `${WINDOWS_PATH}\\`, ...overrides,
      });

      describe('with a Remote Path Mapping', () => {
        test('passes when the mapping leads to the folder, and says so', async () => {
          const { settings, client } = setup(SONARR, {
            folderNames: seesAt(WINDOWS_PATH), mappings: async () => [mapping()], status: onWindows,
          });

          expect(await settings.checkSharedFolder('sonarr'))
            .toEqual({ ok: true, visible: true, path: '/data/.arr-staging', via: 'mapping' });
          expect(client.fetchFolderNames.mock.calls.map((call) => call[1])).toEqual(['/data/.arr-staging', WINDOWS_PATH]);
        });

        test('matches the download client\'s host without case', async () => {
          const { settings } = setup(SONARR, {
            folderNames: seesAt(WINDOWS_PATH), mappings: async () => [mapping({ host: 'YOUTARR' })],
          });

          expect((await settings.checkSharedFolder('sonarr')).via).toBe('mapping');
        });

        test('never passes on the mapping\'s Local Path, which the app named', async () => {
          const { settings } = setup(SONARR, {
            folderNames: seesAt('Z:\\secret\\place'),
            mappings: async () => [mapping({ localPath: 'Z:\\secret\\place\\' })],
          });

          const result = await settings.checkSharedFolder('sonarr');

          expect(result.visible).toBe(true);
          expect(JSON.stringify(result)).not.toContain('secret');
        });

        test.each([
          ['made for another download client', { mappings: async () => [mapping({ host: 'real-sabnzbd' })] }],
          ['for another folder', { mappings: async () => [mapping({ remotePath: '/downloads/' })] }],
          ['that leads to a folder without the category folders', { mappings: async () => [mapping({ localPath: 'D:\\other\\' })] }],
          ['when the app has no download client for the bridge', { mappings: async () => [mapping()], clientHosts: async () => [] }],
        ])('does not pass through a mapping %s', async (_name, overrides) => {
          const { settings } = setup(SONARR, { folderNames: seesAt(WINDOWS_PATH), ...overrides });

          expect(await settings.checkSharedFolder('sonarr')).toMatchObject({ ok: true, visible: false });
        });

        test('mappings that cannot be read are no mapping, and no failed check', async () => {
          const { settings, logger } = setup(SONARR, {
            folderNames: seesAt(),
            mappings: async () => {
              throw new ArrUnavailableError('timeout', { code: 'ETIMEDOUT' });
            },
          });

          expect(await settings.checkSharedFolder('sonarr'))
            .toEqual({ ok: true, visible: false, path: '/data/.arr-staging' });
          expect(logged(logger)).not.toContain(SONARR_KEY);
        });

        test('stops asking after a question fails, so a slow app is not asked again and again', async () => {
          const { settings, client } = setup(SONARR, {
            folderNames: seesAt(),
            hostDownloadsFolder: '/mnt/user/youtube',
            clientHosts: async () => {
              throw new ArrUnavailableError('timeout', { code: 'ETIMEDOUT' });
            },
          });

          await settings.checkSharedFolder('sonarr');

          expect(client.fetchRemotePathMappings).not.toHaveBeenCalled();
          expect(client.fetchStatus).not.toHaveBeenCalled();
          expect(client.fetchFolderNames).toHaveBeenCalledTimes(1);
        });
      });

      describe('where the app runs', () => {
        test.each([
          ['docker', inDocker],
          ['windows', onWindows],
          ['other', async () => ({ appName: 'Sonarr', version: '4.0.20.3014', isDocker: false, isWindows: false })],
        ])('says %s', async (runsIn, status) => {
          const { settings } = setup(SONARR, { folderNames: seesAt(), status });

          expect(await settings.checkSharedFolder('sonarr'))
            .toEqual({ ok: true, visible: false, path: '/data/.arr-staging', runsIn });
        });

        test('says nothing when the app does not tell', async () => {
          const { settings } = setup(SONARR, { folderNames: seesAt() });

          expect(await settings.checkSharedFolder('sonarr')).not.toHaveProperty('runsIn');
        });
      });

      describe('a path the app does see the folder under', () => {
        test('an app on Windows: the downloads folder of the host, as a drive path', async () => {
          const { settings, client } = setup(SONARR, {
            folderNames: seesAt(WINDOWS_PATH), status: onWindows, hostDownloadsFolder: '/e/Youtube16TB',
          });

          expect(await settings.checkSharedFolder('sonarr')).toEqual({
            ok: true, visible: false, path: '/data/.arr-staging', runsIn: 'windows', suggestedPath: WINDOWS_PATH,
          });
          expect(client.fetchFolderNames.mock.calls.map((call) => call[1])).toEqual(['/data/.arr-staging', WINDOWS_PATH]);
        });

        test('an app in Docker that mounts the folder where the host has it', async () => {
          const { settings } = setup(SONARR, {
            folderNames: seesAt('/mnt/user/youtube/.arr-staging'), status: inDocker, hostDownloadsFolder: '/mnt/user/youtube',
          });

          expect(await settings.checkSharedFolder('sonarr')).toMatchObject({
            visible: false, runsIn: 'docker', suggestedPath: '/mnt/user/youtube/.arr-staging',
          });
        });

        test('Youtarr\'s own path, when the path entered is the wrong one', async () => {
          const { settings } = setup(
            { ...SONARR, arrBridgeStagingPath: '/wrong/.arr-staging' },
            { folderNames: seesAt('/data/.arr-staging'), status: inDocker }
          );

          expect(await settings.checkSharedFolder('sonarr')).toMatchObject({
            visible: false, path: '/wrong/.arr-staging', suggestedPath: '/data/.arr-staging',
          });
        });

        test('none, when the app sees the folder at no path Youtarr can tell', async () => {
          const { settings } = setup(SONARR, {
            folderNames: seesAt('/somewhere/else'), status: onWindows, hostDownloadsFolder: '/e/Youtube16TB',
          });

          expect(await settings.checkSharedFolder('sonarr')).not.toHaveProperty('suggestedPath');
        });

        test('a same-named folder without the category folders is not the folder', async () => {
          const { settings } = setup(SONARR, {
            folderNames: async (_connection, folderPath) => (folderPath === WINDOWS_PATH ? ['Season 1'] : []),
            status: onWindows,
            hostDownloadsFolder: '/e/Youtube16TB',
          });

          expect(await settings.checkSharedFolder('sonarr')).not.toHaveProperty('suggestedPath');
        });
      });
    });
  });

  describe('testStoredConnection', () => {
    test('asks the stored address with the stored key', async () => {
      const { settings, client } = setup({
        arrBridgeSonarrUrl: 'http://sonarr:8989',
        arrBridgeSonarrApiKey: SONARR_KEY,
      });

      const result = await settings.testStoredConnection('sonarr');

      expect(client.fetchStatus).toHaveBeenCalledWith({ url: 'http://sonarr:8989', apiKey: SONARR_KEY });
      expect(result).toEqual({ ok: true, appName: 'Sonarr', version: '4.0.20.3014' });
    });

    test('reports why a stored connection does not work, and changes nothing', async () => {
      const { settings, configModule } = setup(
        { arrBridgeSonarrUrl: 'http://sonarr:8989', arrBridgeSonarrApiKey: SONARR_KEY },
        {
          status: async () => {
            throw new ArrUnavailableError('unauthorized');
          },
        }
      );

      const result = await settings.testStoredConnection('sonarr');

      expect(result).toEqual({ ok: false, reason: 'unauthorized', message: 'Sonarr rejected the API key.' });
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('without a stored connection nothing is asked', async () => {
      const { settings, client } = setup({ arrBridgeRadarrUrl: 'http://radarr:7878' });

      const result = await settings.testStoredConnection('radarr');

      expect(result).toEqual({ ok: false, reason: 'not-configured', message: 'No Radarr connection is saved.' });
      expect(client.fetchStatus).not.toHaveBeenCalled();
    });
  });

  describe('removeConnection', () => {
    test('clears the URL and the key of that app only', () => {
      const { settings, configModule } = setup({
        arrBridgeSonarrUrl: 'http://sonarr:8989',
        arrBridgeSonarrApiKey: SONARR_KEY,
        arrBridgeRadarrUrl: 'http://radarr:7878',
        arrBridgeRadarrApiKey: RADARR_KEY,
      });

      const connection = settings.removeConnection('sonarr');

      expect(connection).toEqual({ url: null, keySet: false });
      expect(configModule.config).toEqual({
        arrBridgeRadarrUrl: 'http://radarr:7878',
        arrBridgeRadarrApiKey: RADARR_KEY,
      });
    });
  });

  test('isApp accepts only sonarr and radarr', () => {
    const { settings } = setup({});

    expect(settings.isApp('sonarr')).toBe(true);
    expect(settings.isApp('radarr')).toBe(true);
    expect(settings.isApp('prowlarr')).toBe(false);
    expect(settings.isApp('__proto__')).toBe(false);
    expect(settings.isApp(undefined)).toBe(false);
  });
});
