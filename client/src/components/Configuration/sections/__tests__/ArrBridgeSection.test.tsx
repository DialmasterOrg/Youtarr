import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrBridgeSection } from '../ArrBridgeSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

jest.mock('../../hooks/useArrBridgeKey', () => ({ useArrBridgeKey: jest.fn() }));
jest.mock('../../hooks/useArrBridgeConnections', () => ({ useArrBridgeConnections: jest.fn() }));
jest.mock('../../hooks/useArrBridgeGrabs', () => ({ useArrBridgeGrabs: jest.fn() }));
jest.mock('../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({ subfolders: [], loading: false, createSubfolder: jest.fn() }),
}));

const { useArrBridgeKey } = require('../../hooks/useArrBridgeKey');
const { useArrBridgeConnections } = require('../../hooks/useArrBridgeConnections');
const { useArrBridgeGrabs } = require('../../hooks/useArrBridgeGrabs');

const KEY = 'a'.repeat(64);
const STATUS = {
  enabled: true,
  stagingRoot: '/usr/src/app/data/.arr-staging',
  stagingClientPath: '/usr/src/app/data/.arr-staging',
  connections: {
    sonarr: { url: 'http://sonarr:8989', keySet: true },
    radarr: { url: null, keySet: false },
  },
};

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  arrBridgeEnabled: true,
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

const setupSection = (overrides: Partial<React.ComponentProps<typeof ArrBridgeSection>> = {}) => {
  const config = overrides.config ?? createConfig();
  const props: React.ComponentProps<typeof ArrBridgeSection> = {
    token: 'session',
    config,
    savedConfig: config,
    onConfigChange: jest.fn(),
    setSnackbar: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<ArrBridgeSection {...props} />);
  return props;
};

describe('ArrBridgeSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useArrBridgeKey.mockReturnValue({
      bridgeKey: KEY, loading: false, error: null, regenerating: false, regenerate: jest.fn(),
    });
    useArrBridgeGrabs.mockReturnValue({ grabs: [], loading: false, error: null, refresh: jest.fn() });
    mockConnections();
  });

  describe('while the bridge is off', () => {
    const off = () => setupSection({ config: createConfig({ arrBridgeEnabled: false }) });

    test('shows only the switch', () => {
      off();

      expect(screen.getByRole('checkbox', { name: 'Enable the Sonarr / Radarr bridge' })).not.toBeChecked();
      expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Matching' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Recent grabs' })).not.toBeInTheDocument();
    });

    test('asks the server for nothing, because the key request would create a key', () => {
      off();

      expect(useArrBridgeKey).toHaveBeenCalledWith('session', false);
      expect(useArrBridgeConnections).toHaveBeenCalledWith(null);
      expect(useArrBridgeGrabs).toHaveBeenCalledWith('session', false);
    });

    test('turning it on reports the switch', () => {
      const props = off();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Enable the Sonarr / Radarr bridge' }));

      expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeEnabled: true });
    });
  });

  test('shows every part of the page while the bridge is on', () => {
    setupSection();

    expect(screen.getByLabelText('API key')).toHaveValue(KEY);
    expect(screen.getByRole('heading', { name: 'Matching' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Categories and shared folder' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Sonarr connection' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Radarr connection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent grabs' })).toBeInTheDocument();
    expect(useArrBridgeConnections).toHaveBeenCalledWith('session');
  });

  test('says the values work after a save until the saved config has the bridge on', () => {
    const config = createConfig();
    setupSection({ config, savedConfig: { ...config, arrBridgeEnabled: false } });

    expect(screen.getByText('These values start working after you save.')).toBeInTheDocument();
  });

  test('tells the matching summary which apps are connected', () => {
    setupSection();

    expect(screen.getByText(/With your Sonarr connection/)).toBeInTheDocument();
    expect(screen.queryByText(/With your Radarr connection/)).not.toBeInTheDocument();
  });

  test('shows where the staging folder is and reports the staging settings', () => {
    const props = setupSection();

    expect(screen.getByText('/usr/src/app/data/.arr-staging')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('The same folder as Sonarr and Radarr see it'), {
      target: { value: '/downloads/.arr-staging' },
    });
    fireEvent.change(screen.getByLabelText('Keep staged files for (days)'), { target: { value: '14' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeStagingPath: '/downloads/.arr-staging' });
    expect(props.onConfigChange).toHaveBeenCalledWith({ arrBridgeStagingRetentionDays: 14 });
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
