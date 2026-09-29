import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { StorageLimitsSection, getPauseRemovalConflicts } from '../StorageLimitsSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { DownloadPauseStatus } from '../../../../types/downloadPause';

jest.mock('../../../../hooks/useDownloadPauseStatus', () => ({
  useDownloadPauseStatus: jest.fn(),
}));

const { useDownloadPauseStatus } = require('../../../../hooks/useDownloadPauseStatus');

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const makeStatus = (overrides: Partial<DownloadPauseStatus> = {}): DownloadPauseStatus => ({
  paused: false,
  pausedSince: null,
  reasons: [],
  usage: { limit: null, limitBytes: null, downloadedBytes: 5 * 1024 ** 3 },
  freeSpace: { limit: null, limitBytes: null, availableBytes: null },
  checkedAt: '2026-09-24T00:00:00.000Z',
  ...overrides,
});

const setupSection = (overrides: Partial<React.ComponentProps<typeof StorageLimitsSection>> = {}) => {
  const props: React.ComponentProps<typeof StorageLimitsSection> = {
    token: 'test-token',
    config: createConfig(),
    storageAvailable: true,
    onConfigChange: jest.fn(),
    onMobileTooltipClick: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<StorageLimitsSection {...props} />);
  return props;
};

describe('StorageLimitsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDownloadPauseStatus.mockReturnValue({ data: makeStatus(), loading: false, error: null, refresh: jest.fn() });
  });

  test('shows the current size of downloaded videos while running', () => {
    setupSection();

    expect(screen.getByText(/Downloaded videos currently use/)).toHaveTextContent(
      'Downloaded videos currently use 5.00 GB'
    );
  });

  test('shows the pause alert while downloads are paused', () => {
    useDownloadPauseStatus.mockReturnValue({
      data: makeStatus({
        paused: true,
        pausedSince: '2026-09-24T01:00:00.000Z',
        reasons: [{ type: 'usage', currentBytes: 2, limitBytes: 1, text: 'downloaded videos use 2 B, over the 1 B limit' }],
      }),
      loading: false,
      error: null,
      refresh: jest.fn(),
    });

    setupSection();

    expect(screen.getByTestId('download-pause-alert')).toBeInTheDocument();
  });

  test('saves a typed total size limit', () => {
    const props = setupSection();

    fireEvent.change(screen.getByTestId('download-pause-usage-limit-amount'), { target: { value: '800' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ downloadPauseUsageLimit: '800GB' });
  });

  test('saves a selected minimum free space', async () => {
    const props = setupSection();

    fireEvent.mouseDown(screen.getByLabelText('Pause when free space falls below'));
    await userEvent.click(await screen.findByRole('option', { name: '250 GB' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({ downloadPauseMinFreeSpace: '250GB' });
  });

  test('explains that the free space limit is unavailable without storage reporting', () => {
    setupSection({ storageAvailable: false });

    expect(screen.queryByLabelText('Pause when free space falls below')).not.toBeInTheDocument();
    expect(screen.getByText(/Storage reporting is not available/)).toBeInTheDocument();
  });

  test('offers to turn off a saved free-space minimum that cannot be checked', async () => {
    const props = setupSection({
      storageAvailable: false,
      config: createConfig({ downloadPauseMinFreeSpace: '50GB' }),
    });

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));

    expect(props.onConfigChange).toHaveBeenCalledWith({ downloadPauseMinFreeSpace: '' });
  });

  test('has no turn-off button when no free-space minimum is saved', () => {
    setupSection({ storageAvailable: false });

    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument();
  });

  test('does not mark the section enabled for a limit the server cannot use', () => {
    setupSection({ config: createConfig({ downloadPauseUsageLimit: 'lots' }) });

    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  test('marks the section enabled when a limit is set', () => {
    setupSection({ config: createConfig({ downloadPauseMinFreeSpace: '50GB' }) });

    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  test('warns when auto removal can never bring usage under the pause limit', () => {
    setupSection({
      config: createConfig({
        autoRemovalEnabled: true,
        autoRemovalUsageLimit: '1TB',
        downloadPauseUsageLimit: '500GB',
      }),
    });

    expect(screen.getByText(/The pause limit is lower than the Auto Removal total size limit/)).toBeInTheDocument();
  });
});

describe('getPauseRemovalConflicts', () => {
  test('reports nothing when auto removal is off', () => {
    expect(
      getPauseRemovalConflicts(
        createConfig({ autoRemovalUsageLimit: '1TB', downloadPauseUsageLimit: '500GB' })
      )
    ).toEqual([]);
  });

  test('allows a pause limit equal to the removal limit', () => {
    expect(
      getPauseRemovalConflicts(
        createConfig({ autoRemovalEnabled: true, autoRemovalUsageLimit: '500GB', downloadPauseUsageLimit: '500GB' })
      )
    ).toEqual([]);
  });

  test('flags a pause free-space minimum above the removal threshold', () => {
    const conflicts = getPauseRemovalConflicts(
      createConfig({ autoRemovalEnabled: true, autoRemovalFreeSpaceThreshold: '10GB', downloadPauseMinFreeSpace: '50GB' })
    );

    expect(conflicts).toHaveLength(1);
  });

  test('allows a pause free-space minimum below the removal threshold', () => {
    expect(
      getPauseRemovalConflicts(
        createConfig({ autoRemovalEnabled: true, autoRemovalFreeSpaceThreshold: '50GB', downloadPauseMinFreeSpace: '10GB' })
      )
    ).toEqual([]);
  });
});
