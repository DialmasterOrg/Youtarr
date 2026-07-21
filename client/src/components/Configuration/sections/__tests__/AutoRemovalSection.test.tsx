import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AutoRemovalSection } from '../AutoRemovalSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState, AutoRemovalDryRunResult } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

jest.mock('../../hooks/useAutoRemovalDryRun');

const mockUseAutoRemovalDryRun = require('../../hooks/useAutoRemovalDryRun') as {
  useAutoRemovalDryRun: jest.Mock;
};

const mockRunDryRun = jest.fn();

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof AutoRemovalSection>> = {}
): React.ComponentProps<typeof AutoRemovalSection> => ({
  token: 'test-token',
  config: createConfig(),
  storageAvailable: true,
  onConfigChange: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ...overrides,
});


const createDryRunResult = (
  overrides: Partial<AutoRemovalDryRunResult> = {}
): AutoRemovalDryRunResult => ({
  dryRun: true,
  success: true,
  errors: [],
  plan: {
    ageStrategy: {
      enabled: true,
      thresholdDays: 30,
      candidateCount: 2,
      estimatedFreedBytes: 4096,
      deletedCount: 0,
      failedCount: 0,
      sampleVideos: [
        {
          id: 1,
          youtubeId: 'abc123',
          title: 'Sample Video',
          channel: 'Example Channel',
          fileSize: 1048576,
          timeCreated: '2024-01-01T00:00:00Z',
        },
      ],
    },
    spaceStrategy: {
      enabled: true,
      threshold: '10GB',
      thresholdBytes: 10 * 1024 * 1024 * 1024,
      candidateCount: 0,
      estimatedFreedBytes: 0,
      deletedCount: 0,
      failedCount: 0,
      needsCleanup: false,
      sampleVideos: [],
    },
  },
  simulationTotals: {
    byAge: 2,
    bySpace: 0,
    total: 2,
    estimatedFreedBytes: 1048576,
  },
  ...overrides,
});

describe('AutoRemovalSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunDryRun.mockReset();
    mockUseAutoRemovalDryRun.useAutoRemovalDryRun.mockReturnValue({
      runDryRun: mockRunDryRun,
    });
  });

  test('calls onConfigChange when toggling the auto removal switch', async () => {
    const user = userEvent.setup();
    const props = createSectionProps();
    renderWithProviders(<AutoRemovalSection {...props} />);

    const toggle = screen.getByRole('checkbox', { name: /Enable Automatic Video Removal/i });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(props.onConfigChange).toHaveBeenCalledTimes(1);
    expect(props.onConfigChange).toHaveBeenCalledWith({ autoRemovalEnabled: true });
  });

  test('shows requirement warning and disables preview with no thresholds configured', async () => {
    const user = userEvent.setup();
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
    });

    renderWithProviders(<AutoRemovalSection {...props} />);

    expect(
      screen.getByText(/Enable at least one removal rule/i)
    ).toBeInTheDocument();

    const previewButton = screen.getByRole('button', { name: /Preview Automatic Removal/i });
    expect(previewButton).toBeDisabled();
    expect(screen.getByText(/Enable at least one rule to run a preview/i)).toBeInTheDocument();
  });

  test('presents the rules as alternatives joined by OR', () => {
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
    });
    renderWithProviders(<AutoRemovalSection {...props} />);

    expect(
      screen.getByText(/Videos are removed when they match any enabled rule below/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('OR')).toHaveLength(2);
  });

  test('renders storage unavailable warning when free-space data is missing', async () => {
    const user = userEvent.setup();
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
      storageAvailable: false,
    });

    renderWithProviders(<AutoRemovalSection {...props} />);

    expect(screen.getByText(/Space-Based Removal Unavailable/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('When free space falls below')).not.toBeInTheDocument();
  });

  test('calls onConfigChange when selecting space and age thresholds', async () => {
    const user = userEvent.setup();
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
    });

    renderWithProviders(<AutoRemovalSection {...props} />);

    const freeSpaceSelect = screen.getByLabelText('When free space falls below');
    fireEvent.mouseDown(freeSpaceSelect);

    const freeSpaceOption = await screen.findByRole('option', { name: '1 GB' });
    await user.click(freeSpaceOption);

    const ageSelect = screen.getByLabelText('Delete videos older than');
    fireEvent.mouseDown(ageSelect);

    const ageOption = await screen.findByRole('option', { name: '30 days' });
    await user.click(ageOption);

    expect(props.onConfigChange).toHaveBeenCalledWith({ autoRemovalFreeSpaceThreshold: '1GB' });
    expect(props.onConfigChange).toHaveBeenCalledWith({ autoRemovalVideoAgeThreshold: '30' });
    expect(props.onConfigChange).toHaveBeenCalledTimes(2);
  });

  test('runs dry run hook and renders preview summary with sample data', async () => {
    const user = userEvent.setup();
    const dryRunResult = createDryRunResult();
    mockRunDryRun.mockResolvedValue(dryRunResult);

    const config = createConfig({
      autoRemovalEnabled: true,
      autoRemovalVideoAgeThreshold: '30',
    });
    const props = createSectionProps({ config });

    renderWithProviders(<AutoRemovalSection {...props} />);

    const previewButton = screen.getByRole('button', { name: /Preview Automatic Removal/i });
    await user.click(previewButton);

    expect(mockRunDryRun).toHaveBeenCalledWith({
      autoRemovalEnabled: true,
      autoRemovalFreeSpaceThreshold: '',
      autoRemovalVideoAgeThreshold: '30',
      autoRemovalWatchedEnabled: false,
      autoRemovalWatchedMinDaysSinceWatched: '',
      autoRemovalWatchedMinVideoAgeDays: '',
      autoRemovalKeepRecentCount: 0,
    });

    expect(await screen.findByText('Preview Summary')).toBeInTheDocument();
    expect(screen.getByText(/Would remove/i)).toHaveTextContent('Would remove 2 videos (~1.00 MB).');
    expect(screen.getByText(/Sample videos/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample Video/)).toHaveTextContent('Sample Video (abc123) • 1.00 MB');
    expect(
      screen.getByText(/Storage is currently above the free space threshold/i)
    ).toBeInTheDocument();
  });

  test('shows error alert when the dry run hook rejects', async () => {
    const user = userEvent.setup();
    mockRunDryRun.mockRejectedValue(new Error('Preview failed'));

    const config = createConfig({
      autoRemovalEnabled: true,
      autoRemovalVideoAgeThreshold: '14',
    });
    const props = createSectionProps({ config });

    renderWithProviders(<AutoRemovalSection {...props} />);

    const previewButton = screen.getByRole('button', { name: /Preview Automatic Removal/i });
    await user.click(previewButton);

    expect(await screen.findByText('Preview failed')).toBeInTheDocument();
  });

  test('notes that protected videos are never removed', () => {
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
    });
    renderWithProviders(<AutoRemovalSection {...props} />);

    expect(
      screen.getByText(/Videos marked as Protected are never automatically removed/i)
    ).toBeInTheDocument();
  });

  test('toggling watched removal calls onConfigChange', async () => {
    const user = userEvent.setup();
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
    });
    renderWithProviders(<AutoRemovalSection {...props} />);

    const toggle = screen.getByRole('checkbox', { name: /Remove watched videos/i });
    await user.click(toggle);

    expect(props.onConfigChange).toHaveBeenCalledWith({ autoRemovalWatchedEnabled: true });
  });

  test('watched-only configuration counts as a removal strategy', () => {
    const props = createSectionProps({
      config: createConfig({
        autoRemovalEnabled: true,
        autoRemovalWatchedEnabled: true,
      }),
    });
    renderWithProviders(<AutoRemovalSection {...props} />);

    expect(
      screen.queryByText(/Enable at least one removal rule/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Preview Automatic Removal/i })
    ).toBeEnabled();
  });

  test('updates the keep recent count', () => {
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true }),
    });
    renderWithProviders(<AutoRemovalSection {...props} />);

    const input = screen.getByLabelText(/Keep this many newest downloads/i);
    fireEvent.change(input, { target: { value: '25' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ autoRemovalKeepRecentCount: 25 });
  });

  test('clearing the keep recent count disables the guard', () => {
    const props = createSectionProps({
      config: createConfig({ autoRemovalEnabled: true, autoRemovalKeepRecentCount: 25 }),
    });
    renderWithProviders(<AutoRemovalSection {...props} />);

    const input = screen.getByLabelText(/Keep this many newest downloads/i);
    fireEvent.change(input, { target: { value: '' } });

    expect(props.onConfigChange).toHaveBeenCalledWith({ autoRemovalKeepRecentCount: 0 });
  });

  test('clears dry run results when relevant configuration values change', async () => {
    const user = userEvent.setup();
    mockRunDryRun.mockResolvedValue(createDryRunResult());

    const config = createConfig({
      autoRemovalEnabled: true,
      autoRemovalVideoAgeThreshold: '30',
    });
    const props = createSectionProps({ config });

    const { rerender } = renderWithProviders(<AutoRemovalSection {...props} />);

    const previewButton = screen.getByRole('button', { name: /Preview Automatic Removal/i });
    await user.click(previewButton);

    expect(await screen.findByText('Preview Summary')).toBeInTheDocument();

    const updatedConfig = {
      ...config,
      autoRemovalVideoAgeThreshold: '60',
    };

    rerender(
      <AutoRemovalSection
        {...props}
        config={updatedConfig}
      />
    );

    await waitFor(() =>
      expect(screen.queryByText('Preview Summary')).not.toBeInTheDocument()
    );
  });
});
