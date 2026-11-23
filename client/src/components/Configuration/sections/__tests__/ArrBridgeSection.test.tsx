import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ArrBridgeSection } from '../ArrBridgeSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

jest.mock('../../hooks/useArrBridgeKey', () => ({ useArrBridgeKey: jest.fn() }));
jest.mock('../../hooks/useArrBridgeConnections', () => ({ useArrBridgeConnections: jest.fn() }));
jest.mock('../../hooks/useArrBridgeGrabs', () => ({ useArrBridgeGrabs: jest.fn() }));
jest.mock('../../hooks/useArrBridgeGrabRetry', () => ({ useArrBridgeGrabRetry: jest.fn() }));
jest.mock('../../hooks/useArrBridgeSearches', () => ({ useArrBridgeSearches: jest.fn() }));
jest.mock('../../hooks/useArrBridgeFolderCheck', () => ({ useArrBridgeFolderCheck: jest.fn() }));
jest.mock('../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({ subfolders: [], loading: false, createSubfolder: jest.fn() }),
}));

const { useArrBridgeKey } = require('../../hooks/useArrBridgeKey');
const { useArrBridgeConnections } = require('../../hooks/useArrBridgeConnections');
const { useArrBridgeGrabs } = require('../../hooks/useArrBridgeGrabs');
const { useArrBridgeGrabRetry } = require('../../hooks/useArrBridgeGrabRetry');
const { useArrBridgeSearches } = require('../../hooks/useArrBridgeSearches');
const { useArrBridgeFolderCheck } = require('../../hooks/useArrBridgeFolderCheck');

const KEY = 'a'.repeat(64);
const IN_YOUTARR = '/usr/src/app/data/.arr-staging';
const STATUS = {
  enabled: true,
  stagingRoot: IN_YOUTARR,
  stagingClientPath: IN_YOUTARR,
  connections: {
    sonarr: { url: 'http://sonarr:8989', keySet: true },
    radarr: { url: null, keySet: false },
  },
};
const STEP_HEADINGS = [
  'Step 2: Add Youtarr to Sonarr and Radarr',
  'Step 3: Connect your Sonarr and Radarr (recommended)',
  'Step 4: Check the shared folder',
];

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  arrBridgeEnabled: true,
  youtubeOutputDirectory: '/mnt/media/youtube',
  ...overrides,
});

const mockConnections = (overrides = {}) => {
  const value = {
    status: STATUS,
    loading: false,
    error: null,
    busyApp: null,
    save: jest.fn().mockResolvedValue({ ok: false, message: 'Could not reach Radarr at that address.' }),
    test: jest.fn().mockResolvedValue({ ok: true, appName: 'Sonarr', version: '4.0.20' }),
    remove: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  useArrBridgeConnections.mockReturnValue(value);
  return value;
};

const SETUP_URL = '/settings/sonarr-radarr';
const ACTIVITY_URL = '/settings/sonarr-radarr?tab=activity';
const ACTIVITY_HEADINGS = ['Recent grabs', 'Recent searches'];

const pagedList = (overrides = {}) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: 10,
  query: '',
  loading: false,
  error: null,
  setPage: jest.fn(),
  setQuery: jest.fn(),
  refresh: jest.fn(),
  ...overrides,
});

const setupSection = (
  overrides: Partial<React.ComponentProps<typeof ArrBridgeSection>> = {},
  url: string = SETUP_URL
) => {
  const config = overrides.config ?? createConfig();
  const props: React.ComponentProps<typeof ArrBridgeSection> = {
    token: 'session',
    config,
    savedConfig: config,
    onConfigChange: jest.fn(),
    setSnackbar: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeSection {...props} />, { initialEntries: [url] });
  return props;
};

const tab = (name: string) => screen.getByRole('tab', { name });

describe('ArrBridgeSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useArrBridgeKey.mockReturnValue({
      bridgeKey: KEY, loading: false, error: null, regenerating: false, regenerate: jest.fn(),
    });
    useArrBridgeGrabs.mockReturnValue(pagedList());
    useArrBridgeGrabRetry.mockReturnValue({ retry: jest.fn(), busyId: null, outcomes: {} });
    useArrBridgeSearches.mockReturnValue(pagedList());
    useArrBridgeFolderCheck.mockReturnValue({
      results: { sonarr: { ok: true, visible: true, path: IN_YOUTARR } }, checking: false, recheck: jest.fn(),
    });
    mockConnections();
  });

  describe('while the bridge is off', () => {
    const off = () => setupSection({ config: createConfig({ arrBridgeEnabled: false }) });

    test('shows the switch and what to expect, and none of the later steps', () => {
      off();

      expect(screen.getByRole('checkbox', { name: 'Enable the Sonarr / Radarr bridge' })).not.toBeChecked();
      expect(screen.getByText(/does not announce new uploads/)).toBeInTheDocument();
      expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
      for (const heading of [...STEP_HEADINGS, 'Downloads', 'Matching', ...ACTIVITY_HEADINGS]) {
        expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
      }
    });

    test('has no tabs, and a link to the activity still shows the switch', () => {
      setupSection({ config: createConfig({ arrBridgeEnabled: false }) }, ACTIVITY_URL);

      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Enable the Sonarr / Radarr bridge' })).toBeVisible();
      expect(screen.queryByRole('heading', { name: 'Recent grabs' })).not.toBeInTheDocument();
    });

    test('asks the server for nothing, because the key request would create a key', () => {
      off();

      expect(useArrBridgeKey).toHaveBeenCalledWith('session', false);
      expect(useArrBridgeConnections).toHaveBeenCalledWith(null);
      expect(useArrBridgeGrabs).toHaveBeenCalledWith('session', false);
      expect(useArrBridgeSearches).toHaveBeenCalledWith('session', false);
      expect(useArrBridgeFolderCheck.mock.calls[0][0]).toBeNull();
    });

    test('turning it on reports the switch', () => {
      const props = off();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Enable the Sonarr / Radarr bridge' }));

      expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeEnabled: true });
    });
  });

  test('lays the setup out as numbered steps, with the settings after them', () => {
    setupSection();

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    const order = [...STEP_HEADINGS, 'Downloads', 'Matching'].map((name) => headings.indexOf(name));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(screen.getByText('Step 1: Turn it on and save')).toBeInTheDocument();
  });

  describe('switched on but not saved yet', () => {
    const unsaved = (url?: string) => {
      const config = createConfig();
      return setupSection({ config, savedConfig: { ...config, arrBridgeEnabled: false } }, url);
    };

    test('has no tabs yet', () => {
      unsaved();

      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: STEP_HEADINGS[0] })).toBeVisible();
    });

    test('a link to the activity keeps the switch and the steps on screen', () => {
      unsaved(ACTIVITY_URL);

      expect(screen.getByRole('checkbox', { name: 'Enable the Sonarr / Radarr bridge' })).toBeVisible();
      expect(screen.getByText('Step 1: Turn it on and save')).toBeVisible();
      expect(screen.queryByRole('heading', { name: 'Recent grabs' })).not.toBeInTheDocument();
      expect(useArrBridgeGrabs).toHaveBeenLastCalledWith('session', false);
    });
  });

  describe('the Setup and Activity tabs', () => {
    const SEARCH = {
      id: 1,
      at: '2025-06-10T10:00:00.000Z',
      firstAt: '2025-06-10T10:00:00.000Z',
      count: 1,
      kind: 'tv',
      shape: 'episode',
      asked: {
        text: 'Beyblade', textSource: 'title', season: 1, episode: 29, year: null, month: null, day: null, limit: 100,
      },
      outcome: 'nothing',
      offered: 0,
      note: null,
      titleStageSkipped: null,
      stages: [],
    };

    test('opens on Setup, with the lists neither shown nor loaded', () => {
      setupSection();

      expect(tab('Setup')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Activity')).toHaveAttribute('aria-selected', 'false');
      for (const heading of ACTIVITY_HEADINGS) {
        expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument();
      }
      expect(useArrBridgeGrabs).toHaveBeenLastCalledWith('session', false);
      expect(useArrBridgeSearches).toHaveBeenLastCalledWith('session', false);
    });

    test('Activity shows and loads the two lists in place of the setup', async () => {
      setupSection();

      await userEvent.click(tab('Activity'));

      expect(tab('Activity')).toHaveAttribute('aria-selected', 'true');
      for (const heading of ACTIVITY_HEADINGS) {
        expect(screen.getByRole('heading', { name: heading })).toBeVisible();
      }
      expect(screen.queryByRole('heading', { name: STEP_HEADINGS[0] })).not.toBeInTheDocument();
      expect(screen.getByText('Step 1: Turn it on and save')).not.toBeVisible();
      expect(useArrBridgeGrabs).toHaveBeenLastCalledWith('session', true);
      expect(useArrBridgeSearches).toHaveBeenLastCalledWith('session', true);
    });

    test('a link with ?tab=activity opens on the lists', () => {
      useArrBridgeSearches.mockReturnValue(pagedList({ items: [SEARCH], total: 1 }));
      setupSection({}, ACTIVITY_URL);

      expect(tab('Activity')).toHaveAttribute('aria-selected', 'true');
      const list = screen.getByRole('list', { name: 'Recent searches' });
      expect(within(list).getByText('Beyblade S01E29')).toBeInTheDocument();
      expect(within(list).getByText('Nothing offered')).toBeInTheDocument();
    });

    test('Try again on a blocked grab tries it, and the grab list is loaded again afterwards', () => {
      const grabs = pagedList({
        items: [{
          id: 'g1',
          releaseTitle: 'Beyblade.S01E29.1080p.YT.WEB-DL-X',
          youtubeId: 'g7VYYfoNaf0',
          videoTitle: null,
          channelName: null,
          kind: 'tv',
          category: 'tv',
          state: 'blocked',
          failMessage: null,
          blockedAt: '2025-06-10T10:02:00.000Z',
          nextTryAt: null,
          retryRequested: false,
          downloadsPaused: false,
          hiddenUntil: null,
          libraryCopy: null,
          createdAt: '2025-06-10T10:00:00.000Z',
          completedAt: null,
          removedAt: null,
        }],
        total: 1,
      });
      useArrBridgeGrabs.mockReturnValue(grabs);
      const retry = jest.fn();
      useArrBridgeGrabRetry.mockReturnValue({ retry, busyId: null, outcomes: {} });
      setupSection({}, ACTIVITY_URL);

      fireEvent.click(screen.getByRole('button', { name: /^Try again/ }));

      expect(retry).toHaveBeenCalledWith('g1');
      expect(useArrBridgeGrabRetry).toHaveBeenLastCalledWith('session', grabs.refresh);
    });

    test('Refresh on a list asks for it again', () => {
      const searches = pagedList({ items: [SEARCH], total: 1 });
      useArrBridgeSearches.mockReturnValue(searches);
      setupSection({}, ACTIVITY_URL);

      const refreshButtons = screen.getAllByRole('button', { name: 'Refresh' });
      fireEvent.click(refreshButtons[refreshButtons.length - 1]);

      expect(searches.refresh).toHaveBeenCalledTimes(1);
    });

    test('Setup brings the steps back', async () => {
      setupSection({}, ACTIVITY_URL);

      await userEvent.click(tab('Setup'));

      expect(screen.getByRole('heading', { name: STEP_HEADINGS[0] })).toBeVisible();
      expect(screen.queryByRole('heading', { name: 'Recent grabs' })).not.toBeInTheDocument();
    });

    test('a key typed into a connection is still there after a look at the activity', async () => {
      setupSection();
      const keyField = () => within(screen.getByRole('group', { name: 'Radarr connection', hidden: true }))
        .getByLabelText('Radarr API key');
      fireEvent.change(keyField(), { target: { value: 'typed-key' } });

      await userEvent.click(tab('Activity'));
      await userEvent.click(tab('Setup'));

      expect(keyField()).toHaveValue('typed-key');
    });
  });

  test('shows every part of the page while the bridge is on', () => {
    setupSection();

    expect(screen.getByLabelText('API key')).toHaveValue(KEY);
    expect(screen.getByRole('group', { name: 'Sonarr connection' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Radarr connection' })).toBeInTheDocument();
    expect(useArrBridgeConnections).toHaveBeenCalledWith('session');
  });

  test('says the values work after a save until the saved config has the bridge on', () => {
    const config = createConfig();
    setupSection({ config, savedConfig: { ...config, arrBridgeEnabled: false } });

    expect(screen.getByText('These values start working after you save.')).toBeInTheDocument();
  });

  test('says why the connection matters instead of calling it optional', () => {
    setupSection();

    expect(screen.getByText(/Without it, most official uploads are not found/)).toBeInTheDocument();
    expect(screen.queryByText(/\(optional\)/)).not.toBeInTheDocument();
  });

  test('tells the matching summary which apps are connected', () => {
    setupSection();

    expect(screen.getByText(/With your Sonarr connection/)).toBeInTheDocument();
    expect(screen.queryByText(/With your Radarr connection/)).not.toBeInTheDocument();
  });

  describe('the shared folder step', () => {
    test('names the folder inside the user\'s downloads folder, never the path inside Youtarr', () => {
      setupSection();

      expect(screen.getByText('/mnt/media/youtube/.arr-staging')).toBeInTheDocument();
      expect(screen.queryByText(IN_YOUTARR)).not.toBeInTheDocument();
      expect(screen.queryByText(/Staging folder in Youtarr/)).not.toBeInTheDocument();
    });

    test('shows what each connected app answered', () => {
      setupSection();

      expect(screen.getByText('Sonarr can see the folder.')).toBeInTheDocument();
      expect(screen.getByText(/Connect Radarr in step 3/)).toBeInTheDocument();
    });

    test('asks only the connected apps, and again when the saved path or a connection changes', () => {
      const config = createConfig({ arrBridgeStagingPath: '/downloads/staging' });
      setupSection({ config });

      expect(useArrBridgeFolderCheck).toHaveBeenLastCalledWith(
        'session',
        { sonarr: true, radarr: false },
        '/downloads/staging|http://sonarr:8989|'
      );
    });

    test('does not ask before the bridge is saved as on', () => {
      const config = createConfig();
      setupSection({ config, savedConfig: { ...config, arrBridgeEnabled: false } });

      expect(useArrBridgeFolderCheck.mock.calls[0][0]).toBeNull();
    });

    test('checks the saved path, and says so while another one is typed', () => {
      const saved = createConfig({ arrBridgeStagingPath: '/downloads/staging' });
      setupSection({ config: { ...saved, arrBridgeStagingPath: '/downloads/other' }, savedConfig: saved });

      expect(useArrBridgeFolderCheck.mock.calls[0][2]).toBe('/downloads/staging|http://sonarr:8989|');
      expect(screen.getByText(/Save to check this path/)).toBeInTheDocument();
    });

    test('reports the folder settings', () => {
      const props = setupSection({ config: createConfig({ arrBridgeStagingPath: '/downloads/staging' }) });

      fireEvent.change(screen.getByLabelText("The folder's path inside Sonarr and Radarr"), {
        target: { value: '/downloads/.arr-staging' },
      });
      fireEvent.change(screen.getByLabelText('Remove files nobody imported after (days)'), { target: { value: '14' } });

      expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeStagingPath: '/downloads/.arr-staging' });
      expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeStagingRetentionDays: 14 });
    });
  });

  describe('the downloads settings', () => {
    test('hold the resolution and where grabs are saved', () => {
      setupSection({ config: createConfig({ preferredResolution: '720' }) });

      expect(screen.getByRole('button', { name: 'Resolution' })).toHaveTextContent('Same as Preferred Resolution (720p)');
      expect(screen.getByText('TV grabs are saved to')).toBeInTheDocument();
      expect(screen.getByText('Movie grabs are saved to')).toBeInTheDocument();
    });

    test('show the stored label limit and report a new one', async () => {
      const user = userEvent.setup();
      const props = setupSection({ config: createConfig({ arrBridgeLabelLimit: '1080' }) });
      const labelLimit = screen.getByRole('button', { name: 'Offer releases as' });
      expect(labelLimit).toHaveTextContent('1080p at most');

      await user.click(labelLimit);
      await user.click(await screen.findByRole('option', { name: '480p at most' }));

      expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeLabelLimit: '480' });
    });

    test('the setup step names the download resolution as the highest quality the profile needs', () => {
      setupSection({ config: createConfig({ preferredResolution: '480', arrBridgeResolution: '1080' }) });

      expect(screen.getByText(/The highest label is currently 1080p: it follows/)).toBeInTheDocument();
    });

    test('the setup step names the label limit when it is below the download resolution', () => {
      setupSection({
        config: createConfig({ preferredResolution: '480', arrBridgeResolution: '1080', arrBridgeLabelLimit: '720' }),
      });

      expect(screen.getByText(/The highest label is currently 720p: it follows/)).toBeInTheDocument();
    });

    test('keep Youtarr\'s copy of a grab unless removing it after the import is switched on', () => {
      const props = setupSection();
      const remove = screen.getByRole('checkbox', { name: 'Remove a video from Youtarr after Sonarr or Radarr imports it' });

      expect(remove).not.toBeChecked();
      fireEvent.click(remove);

      expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeRemoveAfterImport: true });
    });

    test('say that removing after the import needs the connection in step 3', () => {
      setupSection();

      expect(screen.getByText(/This needs the connection in step 3/)).toBeInTheDocument();
    });

    test('warn about an app that is not connected while removing after the import is on', () => {
      setupSection({ config: createConfig({ arrBridgeRemoveAfterImport: true }) });

      expect(
        screen.getByText('Radarr is not connected in step 3. Youtarr cannot confirm its imports, so it keeps every video Radarr grabs.')
      ).toBeInTheDocument();
    });

    test('do not warn while removing after the import is off', () => {
      setupSection();

      expect(screen.queryByText(/is not connected in step 3/)).not.toBeInTheDocument();
    });

    test('do not warn before the connections are known', () => {
      mockConnections({ status: null });
      setupSection({ config: createConfig({ arrBridgeRemoveAfterImport: true }) });

      expect(screen.queryByText(/not connected in step 3/)).not.toBeInTheDocument();
    });
  });

  describe('what to expect', () => {
    const expectations = () => within(screen.getByRole('group', { name: 'What to expect' }));

    test('says a grab stays in the Youtarr library by default', () => {
      setupSection();

      expect(expectations().getByText(/stays in your Youtarr library/)).toBeInTheDocument();
    });

    test('says a grab is a one-off download outside the subscriptions', () => {
      setupSection();

      expect(expectations().getByText(/does not subscribe to the channel/)).toBeInTheDocument();
      expect(expectations().getByText(/nothing is added to your Channels page/)).toBeInTheDocument();
    });

    test('says where a kept grab shows up in Youtarr', () => {
      setupSection();

      expect(expectations().getByText(/shows in Download History and on the Videos page/)).toBeInTheDocument();
    });

    test('says a grab leaves the Youtarr library when removing after the import is on', () => {
      setupSection({ config: createConfig({ arrBridgeRemoveAfterImport: true }) });

      expect(expectations().getByText(/Youtarr removes its own copy/)).toBeInTheDocument();
      expect(expectations().queryByText(/stays in your Youtarr library/)).not.toBeInTheDocument();
    });

    test('recommends a YouTube API key, with a link to its page, while none is set', () => {
      setupSection({ config: createConfig({ youtubeApiKey: '' }) });

      expect(expectations().getByText(/A YouTube API key is recommended/)).toBeInTheDocument();
      expect(expectations().getByRole('link', { name: 'Add a YouTube API key' }))
        .toHaveAttribute('href', '/settings/youtube-api');
    });

    test('does not recommend a YouTube API key once one is set', () => {
      setupSection({ config: createConfig({ youtubeApiKey: 'AIza-key' }) });

      expect(expectations().queryByText(/A YouTube API key is recommended/)).not.toBeInTheDocument();
      expect(expectations().queryByRole('link', { name: 'Add a YouTube API key' })).not.toBeInTheDocument();
    });
  });

  test('saving a connection goes to the connections hook for that app', async () => {
    const connections = mockConnections();
    setupSection();
    const radarr = within(screen.getByRole('group', { name: 'Radarr connection' }));

    fireEvent.change(radarr.getByLabelText('Radarr address'), { target: { value: 'http://radarr:7878' } });
    fireEvent.change(radarr.getByLabelText('Radarr API key'), { target: { value: 'the-key' } });
    fireEvent.click(radarr.getByRole('button', { name: 'Test and save' }));

    expect(connections.save).toHaveBeenCalledWith('radarr', 'http://radarr:7878', 'the-key');
    expect(await radarr.findByText('Could not reach Radarr at that address.')).toBeInTheDocument();
  });

  test('shows an error in place of the connection cards when they cannot be loaded', () => {
    mockConnections({ status: null, error: 'Could not load the Sonarr and Radarr connections.' });
    setupSection();

    expect(screen.getByText('Could not load the Sonarr and Radarr connections.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Sonarr connection' })).not.toBeInTheDocument();
  });
});
