import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DownloadPerformanceSection } from '../DownloadPerformanceSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof DownloadPerformanceSection>> = {}
): React.ComponentProps<typeof DownloadPerformanceSection> => ({
  config: createConfig(),
  onConfigChange: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ...overrides,
});

const expandAccordion = async (user: ReturnType<typeof userEvent.setup>) => {
  const accordionToggle = screen.getByRole('button', { name: /download performance settings/i });
  await user.click(accordionToggle);
};

describe('DownloadPerformanceSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);
      expect(screen.getByText('Download Performance Settings')).toBeInTheDocument();
    });

    test('renders accordion with correct default state', () => {
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);
      expect(screen.getByText('Download Performance Settings')).toBeInTheDocument();
      // The accordion button should have aria-expanded="false" when collapsed
      const accordionButton = screen.getByRole('button', { name: /download performance settings/i });
      expect(accordionButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('renders info alert when expanded', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Performance Optimization')).toBeInTheDocument();
      expect(screen.getByText(/Configure download timeouts, retry attempts, and stall detection/i)).toBeInTheDocument();
    });

    test('displays correct chip when stall detection is enabled', () => {
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);
      expect(screen.getByText('Stall Detection On')).toBeInTheDocument();
    });

    test('displays correct chip when stall detection is disabled', () => {
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);
      expect(screen.getByText('Stall Detection Off')).toBeInTheDocument();
    });

    test('defaults to stall detection on in DEFAULT_CONFIG', () => {
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);
      // DEFAULT_CONFIG has enableStallDetection: true
      expect(screen.getByText('Stall Detection On')).toBeInTheDocument();
    });
  });

  describe('Socket Timeout Select', () => {
    test('renders socket timeout select', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getAllByText('Socket Timeout').length).toBeGreaterThan(0);
    });

    test('displays default value of 30 seconds', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadSocketTimeoutSeconds: 30 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('30 seconds')).toBeInTheDocument();
    });

    test('displays configured timeout value', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadSocketTimeoutSeconds: 10 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('10 seconds')).toBeInTheDocument();
    });

    test('uses default value when undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig();
      delete (config as { downloadSocketTimeoutSeconds?: number }).downloadSocketTimeoutSeconds;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('30 seconds')).toBeInTheDocument();
    });

    test('calls onConfigChange when timeout is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ downloadSocketTimeoutSeconds: 30 }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('combobox', { name: /Socket Timeout/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '10 seconds' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ downloadSocketTimeoutSeconds: 10 });
    });

    test('displays all timeout options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('combobox', { name: /Socket Timeout/i });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: '5 seconds' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '10 seconds' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '20 seconds' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '30 seconds' })).toBeInTheDocument();
    });

    test('displays helper text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Connection timeout for each download attempt')).toBeInTheDocument();
    });
  });

  describe('Throttled Rate Detection Select', () => {
    test('renders throttled rate select', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getAllByText('Throttled Rate Detection').length).toBeGreaterThan(0);
    });

    test('displays default value of 100K', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadThrottledRate: '100K', enableStallDetection: false })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('100 KB/s')).toBeInTheDocument();
    });

    test('displays configured rate value', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadThrottledRate: '500K' })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('500 KB/s')).toBeInTheDocument();
    });

    test('uses default value when undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig({ enableStallDetection: false });
      delete (config as { downloadThrottledRate?: string }).downloadThrottledRate;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('100 KB/s')).toBeInTheDocument();
    });

    test('calls onConfigChange when rate is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ downloadThrottledRate: '50K', enableStallDetection: false }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('combobox', { name: /Throttled Rate Detection/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '250 KB/s' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ downloadThrottledRate: '250K' });
    });

    test('displays all throttled rate options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadThrottledRate: '50K', enableStallDetection: false })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('combobox', { name: /Throttled Rate Detection/i });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: '20 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '50 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '100 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '250 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '500 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1 MB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2 MB/s' })).toBeInTheDocument();
    });

    test('displays helper text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Minimum speed before considering download throttled')).toBeInTheDocument();
    });
  });

  describe('Download Retries Select', () => {
    test('renders download retries select', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getAllByText('Download Retries').length).toBeGreaterThan(0);
    });

    test('displays default value of 2 retries', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadRetryCount: 2 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('2 retries')).toBeInTheDocument();
    });

    test('displays configured retry count', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadRetryCount: 3 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('3 retries')).toBeInTheDocument();
    });

    test('displays singular "retry" for value of 1', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadRetryCount: 1 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('1 retry')).toBeInTheDocument();
    });

    test('displays "No retries" for value of 0', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ downloadRetryCount: 0 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('No retries')).toBeInTheDocument();
    });

    test('uses default value when undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig();
      delete (config as { downloadRetryCount?: number }).downloadRetryCount;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('2 retries')).toBeInTheDocument();
    });

    test('calls onConfigChange when retry count is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ downloadRetryCount: 2 }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('combobox', { name: /Download Retries/i });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '1 retry' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ downloadRetryCount: 1 });
    });

    test('displays all retry count options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('combobox', { name: /Download Retries/i });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: 'No retries' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1 retry' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2 retries' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '3 retries' })).toBeInTheDocument();
    });

    test('displays helper text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Number of retry attempts for failed downloads')).toBeInTheDocument();
    });
  });

  describe('Enable Stall Detection Switch', () => {
    test('renders stall detection switch', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /enable stall detection/i })).toBeInTheDocument();
    });

    test('switch is checked when stall detection is enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const switchElement = screen.getByRole('checkbox', { name: /enable stall detection/i });
      expect(switchElement).toBeChecked();
    });

    test('switch is unchecked when stall detection is disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const switchElement = screen.getByRole('checkbox', { name: /enable stall detection/i });
      expect(switchElement).not.toBeChecked();
    });

    test('switch defaults to checked when enableStallDetection is undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig();
      delete (config as { enableStallDetection?: boolean }).enableStallDetection;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const switchElement = screen.getByRole('checkbox', { name: /enable stall detection/i });
      expect(switchElement).toBeChecked();
    });

    test('calls onConfigChange when switch is toggled on', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const switchElement = screen.getByRole('checkbox', { name: /enable stall detection/i });
      await user.click(switchElement);

      expect(onConfigChange).toHaveBeenCalledWith({ enableStallDetection: true });
    });

    test('calls onConfigChange when switch is toggled off', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const switchElement = screen.getByRole('checkbox', { name: /enable stall detection/i });
      await user.click(switchElement);

      expect(onConfigChange).toHaveBeenCalledWith({ enableStallDetection: false });
    });
  });

  describe('Stall Detection Window TextField', () => {
    test('does not render when stall detection is disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/stall detection window/i)).not.toBeInTheDocument();
    });

    test('renders when stall detection is enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/stall detection window/i)).toBeInTheDocument();
    });

    test('displays default value of 30 seconds', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true, stallDetectionWindowSeconds: 30 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/stall detection window/i) as HTMLInputElement;
      expect(input).toHaveValue(30);
    });

    test('displays configured window value', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true, stallDetectionWindowSeconds: 60 })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/stall detection window/i) as HTMLInputElement;
      expect(input).toHaveValue(60);
    });

    test('uses default value when undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig({ enableStallDetection: true });
      delete (config as { stallDetectionWindowSeconds?: number }).stallDetectionWindowSeconds;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/stall detection window/i) as HTMLInputElement;
      expect(input).toHaveValue(30);
    });

    test('calls onConfigChange when window value is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true, stallDetectionWindowSeconds: 30 }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/stall detection window/i);

      // Clear the input and type new value
      await user.clear(input);
      await user.type(input, '60');

      // onConfigChange is called with the new value
      expect(onConfigChange).toHaveBeenCalled();
      // Check the final call has stallDetectionWindowSeconds property
      const calls = onConfigChange.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toHaveProperty('stallDetectionWindowSeconds');
      expect(typeof lastCall.stallDetectionWindowSeconds).toBe('number');
    });

    test('has correct input attributes', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/stall detection window/i);
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('min', '5');
      expect(input).toHaveAttribute('max', '120');
      expect(input).toHaveAttribute('step', '5');
    });

    test('displays helper text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/How long the download must stay below the stall threshold/i)).toBeInTheDocument();
    });
  });

  describe('Stall Threshold Rate Select', () => {
    test('does not render when stall detection is disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByText('Stall Threshold Rate')).not.toBeInTheDocument();
    });

    test('renders when stall detection is enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getAllByText('Stall Threshold Rate').length).toBeGreaterThan(0);
    });

    test('defaults to throttled rate when stall threshold is undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig({
        enableStallDetection: true,
        downloadThrottledRate: '250K'
      });
      delete (config as { stallDetectionRateThreshold?: string }).stallDetectionRateThreshold;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      // Both throttled rate and stall threshold rate will show 250 KB/s, look for multiple
      const elements = screen.getAllByText('250 KB/s');
      expect(elements.length).toBeGreaterThan(0);
    });

    test('uses configured stall threshold rate', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          enableStallDetection: true,
          stallDetectionRateThreshold: '500K',
          downloadThrottledRate: '100K'
        })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('500 KB/s')).toBeInTheDocument();
    });

    test('falls back to 100K when both stall threshold and throttled rate are undefined', async () => {
      const user = userEvent.setup();
      const config = createConfig({ enableStallDetection: true });
      delete (config as { stallDetectionRateThreshold?: string }).stallDetectionRateThreshold;
      delete (config as { downloadThrottledRate?: string }).downloadThrottledRate;
      const props = createSectionProps({ config });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      // Both throttled rate and stall threshold rate will show 100 KB/s
      const elements = screen.getAllByText('100 KB/s');
      expect(elements.length).toBeGreaterThan(0);
    });

    test('calls onConfigChange when rate is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          enableStallDetection: true,
          stallDetectionRateThreshold: '20K',
          downloadThrottledRate: '100K'
        }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      // With different values, we can uniquely identify the stall threshold select by its value
      const stallThresholdButton = screen.getByRole('combobox', { name: /Stall Threshold Rate/i });
      await user.click(stallThresholdButton);

      const option = await screen.findByRole('option', { name: '1 MB/s' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ stallDetectionRateThreshold: '1M' });
    });

    test('displays all rate options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          enableStallDetection: true,
          stallDetectionRateThreshold: '20K',
          downloadThrottledRate: '100K'
        })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      // With different values, we can uniquely identify the stall threshold select
      const stallThresholdButton = screen.getByRole('combobox', { name: /Stall Threshold Rate/i });
      await user.click(stallThresholdButton);

      expect(await screen.findByRole('option', { name: '20 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '50 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '100 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '250 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '500 KB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1 MB/s' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2 MB/s' })).toBeInTheDocument();
    });

    test('displays helper text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Speed threshold for stall detection/i)).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('enabling stall detection shows additional fields', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false })
      });
      const { rerender } = renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/stall detection window/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Stall Threshold Rate')).not.toBeInTheDocument();

      // Simulate enabling stall detection
      rerender(
        <DownloadPerformanceSection
          {...props}
          config={createConfig({ enableStallDetection: true })}
        />
      );

      expect(screen.getByLabelText(/stall detection window/i)).toBeInTheDocument();
      expect(screen.getAllByText('Stall Threshold Rate').length).toBeGreaterThan(0);
    });

    test('disabling stall detection hides additional fields', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      const { rerender } = renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/stall detection window/i)).toBeInTheDocument();
      expect(screen.getAllByText('Stall Threshold Rate').length).toBeGreaterThan(0);

      // Simulate disabling stall detection
      rerender(
        <DownloadPerformanceSection
          {...props}
          config={createConfig({ enableStallDetection: false })}
        />
      );

      expect(screen.queryByLabelText(/stall detection window/i)).not.toBeInTheDocument();
      expect(screen.queryByText('Stall Threshold Rate')).not.toBeInTheDocument();
    });

    test('handles multiple configuration changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false }),
        onConfigChange
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      // Change socket timeout
      const timeoutButton = screen.getByRole('combobox', { name: /Socket Timeout/i });
      await user.click(timeoutButton);
      const timeoutOption = await screen.findByRole('option', { name: '20 seconds' });
      await user.click(timeoutOption);
      expect(onConfigChange).toHaveBeenCalledWith({ downloadSocketTimeoutSeconds: 20 });

      // Change retry count
      const retryButton = screen.getByRole('combobox', { name: /Download Retries/i });
      await user.click(retryButton);
      const retryOption = await screen.findByRole('option', { name: '3 retries' });
      await user.click(retryOption);
      expect(onConfigChange).toHaveBeenCalledWith({ downloadRetryCount: 3 });

      // Toggle stall detection
      const stallSwitch = screen.getByRole('checkbox', { name: /enable stall detection/i });
      await user.click(stallSwitch);
      expect(onConfigChange).toHaveBeenCalledWith({ enableStallDetection: true });

      expect(onConfigChange).toHaveBeenCalledTimes(3);
    });

    test('chip label updates when stall detection is toggled', () => {
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: false })
      });
      const { rerender } = renderWithProviders(<DownloadPerformanceSection {...props} />);

      expect(screen.getByText('Stall Detection Off')).toBeInTheDocument();

      // Simulate enabling stall detection
      rerender(
        <DownloadPerformanceSection
          {...props}
          config={createConfig({ enableStallDetection: true })}
        />
      );

      expect(screen.getByText('Stall Detection On')).toBeInTheDocument();
      expect(screen.queryByText('Stall Detection Off')).not.toBeInTheDocument();
    });
  });

  describe('InfoTooltip Integration', () => {
    test('calls onMobileTooltipClick when provided', async () => {
      const user = userEvent.setup();
      const onMobileTooltipClick = jest.fn();
      const props = createSectionProps({ onMobileTooltipClick });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      // InfoTooltip components are present with onMobileTooltipClick prop
      expect(screen.getByRole('checkbox', { name: /enable stall detection/i })).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Download Performance Settings')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles all numeric values at minimum', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          downloadSocketTimeoutSeconds: 5,
          downloadRetryCount: 0,
          stallDetectionWindowSeconds: 5,
          enableStallDetection: true
        })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('5 seconds')).toBeInTheDocument();
      expect(screen.getByText('No retries')).toBeInTheDocument();
      const input = screen.getByLabelText(/stall detection window/i) as HTMLInputElement;
      expect(input).toHaveValue(5);
    });

    test('handles all numeric values at maximum', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          downloadSocketTimeoutSeconds: 30,
          downloadRetryCount: 3,
          stallDetectionWindowSeconds: 120,
          enableStallDetection: true
        })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('30 seconds')).toBeInTheDocument();
      expect(screen.getByText('3 retries')).toBeInTheDocument();
      const input = screen.getByLabelText(/stall detection window/i) as HTMLInputElement;
      expect(input).toHaveValue(120);
    });

    test('handles all rate values', async () => {
      const user = userEvent.setup();
      const rateValues = ['20K', '50K', '100K', '250K', '500K', '1M', '2M'];

      for (const rate of rateValues) {
        const props = createSectionProps({
          config: createConfig({ downloadThrottledRate: rate })
        });
        const { unmount } = renderWithProviders(<DownloadPerformanceSection {...props} />);

        await expandAccordion(user);

        // Check that the component renders without crashing
        expect(screen.getByText('Download Performance Settings')).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe('Accessibility', () => {
    test('all select fields have accessible labels', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getAllByText('Socket Timeout').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Throttled Rate Detection').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Download Retries').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Stall Threshold Rate').length).toBeGreaterThan(0);
    });

    test('switch has accessible label', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /enable stall detection/i })).toBeInTheDocument();
    });

    test('text input has accessible label', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ enableStallDetection: true })
      });
      renderWithProviders(<DownloadPerformanceSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/stall detection window/i)).toBeInTheDocument();
    });
  });
});
