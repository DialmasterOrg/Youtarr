import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { YtdlpUpdateSection } from '../YtdlpUpdateSection';
import { renderWithProviders } from '../../../../test-utils';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../../types';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createDeploymentEnvironment = (
  overrides: Partial<DeploymentEnvironment> = {}
): DeploymentEnvironment => ({
  platform: null,
  isWsl: false,
  ...overrides,
});

const createPlatformManagedState = (
  overrides: Partial<PlatformManagedState> = {}
): PlatformManagedState => ({
  plexUrl: false,
  authEnabled: false,
  useTmpForDownloads: false,
  ytdlpUpdates: false,
  ...overrides,
});

const versionInfo = {
  currentVersion: '2026.08.05',
  latestVersion: '2026.08.10',
  updateAvailable: true,
};

const createProps = (
  overrides: Partial<React.ComponentProps<typeof YtdlpUpdateSection>> = {}
): React.ComponentProps<typeof YtdlpUpdateSection> => ({
  config: createConfig(),
  deploymentEnvironment: createDeploymentEnvironment(),
  isPlatformManaged: createPlatformManagedState(),
  onConfigChange: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ytDlpVersionInfo: versionInfo,
  ytDlpUpdateStatus: 'idle',
  onYtDlpUpdate: jest.fn(),
  ...overrides,
});

describe('YtdlpUpdateSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the current version and the channel select defaulting to Stable', () => {
    renderWithProviders(<YtdlpUpdateSection {...createProps()} />);
    expect(screen.getByText('2026.08.05')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stable \(recommended\)/i })).toBeInTheDocument();
  });

  test('selecting Nightly reports the channel change', async () => {
    const user = userEvent.setup();
    const props = createProps();
    renderWithProviders(<YtdlpUpdateSection {...props} />);

    await user.click(screen.getByRole('button', { name: /stable \(recommended\)/i }));
    await user.click(await screen.findByRole('option', { name: 'Nightly' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({ ytdlpUpdateChannel: 'nightly' });
  });

  test('renders a saved nightly channel as the current selection', () => {
    const props = createProps({ config: createConfig({ ytdlpUpdateChannel: 'nightly' }) });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByRole('button', { name: /nightly/i })).toBeInTheDocument();
  });

  test('renders the daily auto-update toggle and reports changes', async () => {
    const user = userEvent.setup();
    const props = createProps();
    renderWithProviders(<YtdlpUpdateSection {...props} />);

    const toggle = screen.getByRole('checkbox', { name: /automatically update yt-dlp daily/i });
    await user.click(toggle);

    expect(props.onConfigChange).toHaveBeenCalledWith({ autoUpdateYtdlp: true });
  });

  test('renders the channel picker even when version info has not loaded', () => {
    renderWithProviders(<YtdlpUpdateSection {...createProps({ ytDlpVersionInfo: undefined })} />);
    expect(screen.getByRole('button', { name: /stable \(recommended\)/i })).toBeInTheDocument();
  });

  test('shows the update dialog and calls onYtDlpUpdate on confirm', async () => {
    const user = userEvent.setup();
    const props = createProps();
    renderWithProviders(<YtdlpUpdateSection {...props} />);

    await user.click(screen.getByRole('button', { name: 'Update' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Update' }));

    expect(props.onYtDlpUpdate).toHaveBeenCalled();
  });

  test('hides channel picker and toggle when yt-dlp updates are platform managed', () => {
    const props = createProps({
      isPlatformManaged: createPlatformManagedState({ ytdlpUpdates: true }),
      deploymentEnvironment: createDeploymentEnvironment({ platform: 'elfhosted' }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);

    expect(
      screen.getByText(/yt-dlp is managed by elfhosted and cannot be updated from youtarr/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /stable \(recommended\)/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: /automatically update yt-dlp daily/i })
    ).not.toBeInTheDocument();
  });

  test('renders the last-checked status line', () => {
    const props = createProps({
      config: createConfig({
        ytdlpLastChecked: '2026-08-17T04:00:00.000Z',
        ytdlpLastResult: { status: 'up-to-date' },
      }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText(/last checked:/i)).toBeInTheDocument();
  });

  test('reflects a false autoUpdateYtdlp as unchecked', () => {
    const props = createProps({ config: createConfig({ autoUpdateYtdlp: false }) });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    const toggle = screen.getByRole('checkbox', { name: /automatically update yt-dlp daily/i });
    expect(toggle).not.toBeChecked();
  });

  test('reflects a true autoUpdateYtdlp as checked', () => {
    const props = createProps({ config: createConfig({ autoUpdateYtdlp: true }) });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    const toggle = screen.getByRole('checkbox', { name: /automatically update yt-dlp daily/i });
    expect(toggle).toBeChecked();
  });

  test('toggling off an enabled auto-update reports autoUpdateYtdlp false', async () => {
    const user = userEvent.setup();
    const props = createProps({ config: createConfig({ autoUpdateYtdlp: true }) });
    renderWithProviders(<YtdlpUpdateSection {...props} />);

    const toggle = screen.getByRole('checkbox', { name: /automatically update yt-dlp daily/i });
    await user.click(toggle);

    expect(props.onConfigChange).toHaveBeenCalledWith({ autoUpdateYtdlp: false });
  });

  test('does not render the status caption when no checks have run yet', () => {
    renderWithProviders(<YtdlpUpdateSection {...createProps()} />);
    expect(screen.queryByText(/last checked:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/last updated:/i)).not.toBeInTheDocument();
  });

  test('renders "updated to <version>" caption and the last updated timestamp on a real update', () => {
    const props = createProps({
      config: createConfig({
        ytdlpLastChecked: '2026-04-25T04:00:00.000Z',
        ytdlpLastUpdated: '2026-04-25T04:00:00.000Z',
        ytdlpLastResult: { status: 'updated', version: '2026.04.20' },
      }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText(/updated to 2026\.04\.20/i)).toBeInTheDocument();
    expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
  });

  test('renders "skipped" caption when an auto-update was skipped', () => {
    const props = createProps({
      config: createConfig({
        ytdlpLastChecked: '2026-04-25T04:00:00.000Z',
        ytdlpLastResult: { status: 'skipped', message: 'Cannot update while downloads are in progress.' },
      }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText(/skipped:.*downloads are in progress/i)).toBeInTheDocument();
  });

  test('renders "update failed" caption with message on error', () => {
    const props = createProps({
      config: createConfig({
        ytdlpLastChecked: '2026-04-25T04:00:00.000Z',
        ytdlpLastResult: { status: 'error', message: 'Permission denied' },
      }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText(/update failed: Permission denied/i)).toBeInTheDocument();
  });

  test('hides the manual Update button when yt-dlp is platform-managed', () => {
    const props = createProps({
      isPlatformManaged: createPlatformManagedState({ ytdlpUpdates: true }),
      deploymentEnvironment: createDeploymentEnvironment({ platform: 'elfhosted' }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.queryByRole('button', { name: /^Update$/i })).not.toBeInTheDocument();
  });

  test('shows the Elfhosted-specific managed message and chip', () => {
    const props = createProps({
      isPlatformManaged: createPlatformManagedState({ ytdlpUpdates: true }),
      deploymentEnvironment: createDeploymentEnvironment({ platform: 'elfhosted' }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText('Managed by Elfhosted')).toBeInTheDocument();
    expect(
      screen.getByText(/yt-dlp is managed by Elfhosted and cannot be updated from Youtarr/i)
    ).toBeInTheDocument();
  });

  test('shows a generic platform-managed message and chip when platform is not Elfhosted', () => {
    const props = createProps({
      isPlatformManaged: createPlatformManagedState({ ytdlpUpdates: true }),
      deploymentEnvironment: createDeploymentEnvironment({ platform: null }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText('Platform Managed')).toBeInTheDocument();
    expect(
      screen.getByText(/yt-dlp is managed by the platform and cannot be updated from Youtarr/i)
    ).toBeInTheDocument();
  });

  test('still shows the current yt-dlp version when platform-managed', () => {
    const props = createProps({
      isPlatformManaged: createPlatformManagedState({ ytdlpUpdates: true }),
      deploymentEnvironment: createDeploymentEnvironment({ platform: 'elfhosted' }),
    });
    renderWithProviders(<YtdlpUpdateSection {...props} />);
    expect(screen.getByText('2026.08.05')).toBeInTheDocument();
  });
});
