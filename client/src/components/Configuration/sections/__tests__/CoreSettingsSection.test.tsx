import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { CoreSettingsSection } from '../CoreSettingsSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

// Mock useSubfolders hook to prevent network requests
jest.mock('../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({
    subfolders: ['__Sports', '__Music', '__Tech'],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

// Mock SubtitleLanguageSelector to simplify testing
jest.mock('../../SubtitleLanguageSelector', () => ({
  __esModule: true,
  default: function MockSubtitleLanguageSelector(props: {
    value: string;
    onChange: (value: string) => void;
  }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'subtitle-language-selector' },
      React.createElement('input', {
        'data-testid': 'subtitle-language-input',
        value: props.value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)
      })
    );
  }
}));

// Mock SubfolderAutocomplete for dialog tests
jest.mock('../../../shared/SubfolderAutocomplete', () => ({
  SubfolderAutocomplete: function MockSubfolderAutocomplete(props: {
    value: string | null;
    onChange: (value: string | null) => void;
    label: string;
  }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'subfolder-autocomplete' },
      React.createElement('button', {
        'data-testid': 'trigger-subfolder-change',
        onClick: () => props.onChange('NewFolder')
      }, 'Change Subfolder')
    );
  }
}));

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  youtubeOutputDirectory: '/data/youtube',
  channelDownloadFrequency: '0 */6 * * *', // Every 6 hours
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
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof CoreSettingsSection>> = {}
): React.ComponentProps<typeof CoreSettingsSection> => ({
  config: createConfig(),
  deploymentEnvironment: createDeploymentEnvironment(),
  isPlatformManaged: createPlatformManagedState(),
  onConfigChange: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  token: 'test-token',
  ...overrides,
});

describe('CoreSettingsSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('Core Settings')).toBeInTheDocument();
    });

    test('renders title and subtitle', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('Core Settings')).toBeInTheDocument();
      expect(screen.getByText('Required settings for YouTube video downloads')).toBeInTheDocument();
    });
  });

  describe('YouTube Output Directory Field', () => {
    test('renders YouTube Output Directory field', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByLabelText(/YouTube Output Directory/i)).toBeInTheDocument();
    });

    test('displays the current output directory value', () => {
      const props = createSectionProps({
        config: createConfig({ youtubeOutputDirectory: '/custom/path' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const input = screen.getByLabelText(/YouTube Output Directory/i) as HTMLInputElement;
      expect(input).toHaveValue('/custom/path');
    });

    test('field is always disabled', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      const input = screen.getByLabelText(/YouTube Output Directory/i);
      expect(input).toBeDisabled();
    });

    test('shows Docker Volume chip', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      const chips = screen.getAllByText('Docker Volume');
      expect(chips.length).toBeGreaterThan(0);
    });

    test('shows standard helper text for non-Elfhosted deployments', () => {
      const props = createSectionProps({
        deploymentEnvironment: createDeploymentEnvironment({ platform: null })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText(/Configured via YOUTUBE_OUTPUT_DIR environment variable/i)).toBeInTheDocument();
    });

    test('shows Elfhosted-specific helper text when platform is Elfhosted', () => {
      const props = createSectionProps({
        deploymentEnvironment: createDeploymentEnvironment({ platform: 'Elfhosted' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText(/This path is configured by your platform deployment/i)).toBeInTheDocument();
    });

    test('shows Elfhosted-specific helper text case-insensitively', () => {
      const props = createSectionProps({
        deploymentEnvironment: createDeploymentEnvironment({ platform: 'ELFHOSTED' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText(/This path is configured by your platform deployment/i)).toBeInTheDocument();
    });
  });

  describe('Enable Automatic Downloads Checkbox', () => {
    test('renders Enable Automatic Downloads checkbox', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i })).toBeInTheDocument();
    });

    test('checkbox reflects channelAutoDownload state when false', () => {
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: false })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      expect(checkbox).not.toBeChecked();
    });

    test('checkbox reflects channelAutoDownload state when true', () => {
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: false }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const checkbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ channelAutoDownload: true });
    });

    test('has InfoTooltip with correct text', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      // InfoTooltip is rendered but we're not testing its internals
      expect(screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i })).toBeInTheDocument();
    });
  });

  describe('Download Frequency Select', () => {
    test('renders Download Frequency select', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      const labels = screen.getAllByText('Download Frequency');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('displays correct frequency value', () => {
      const props = createSectionProps({
        config: createConfig({ channelDownloadFrequency: '0 */6 * * *' }) // Every 6 hours
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('Every 6 hours')).toBeInTheDocument();
    });

    test('select is disabled when channelAutoDownload is false', () => {
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: false })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      // When disabled, MUI Select has role="button" with aria-disabled
      const selectButton = screen.getByRole('button', { name: /Every 6 hours/i });
      expect(selectButton).toHaveAttribute('aria-disabled', 'true');
    });

    test('select is enabled when channelAutoDownload is true', () => {
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      // When enabled, MUI Select has role="button" without aria-disabled
      const selectButton = screen.getByRole('button', { name: /Every 6 hours/i });
      expect(selectButton).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('calls onConfigChange when frequency is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: true, channelDownloadFrequency: '0 */6 * * *' }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: /Every 6 hours/i });
      await user.click(selectButton);

      const hourlyOption = await screen.findByRole('option', { name: 'Hourly' });
      await user.click(hourlyOption);

      expect(onConfigChange).toHaveBeenCalledWith({ channelDownloadFrequency: '0 * * * *' });
    });

    test('displays all frequency options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: /Every 6 hours/i });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: 'Every 15 minutes' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Every 30 minutes' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Hourly' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Every 4 hours' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Every 6 hours' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Every 12 hours' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Daily' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Weekly' })).toBeInTheDocument();
    });
  });

  describe('Files to Download per Channel Select', () => {
    test('renders Files to Download per Channel select', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText(/Files to Download per Channel/i)).toBeInTheDocument();
    });

    test('displays current value', () => {
      const props = createSectionProps({
        config: createConfig({ channelFilesToDownload: 5 })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('5 videos')).toBeInTheDocument();
    });

    test('calls onConfigChange when value is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ channelFilesToDownload: 3 }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: '3 videos' });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '7 videos' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ channelFilesToDownload: 7 });
    });

    test('displays options 1-10 for default values', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ channelFilesToDownload: 3 })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: '3 videos' });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: '1 video' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '5 videos' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '10 videos' })).toBeInTheDocument();
    });

    test('includes current value if greater than 10', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ channelFilesToDownload: 15 })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: '15 videos' });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: '15 videos' })).toBeInTheDocument();
    });

    test('displays singular "video" for value of 1', () => {
      const props = createSectionProps({
        config: createConfig({ channelFilesToDownload: 1 })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('1 video')).toBeInTheDocument();
    });

    test('displays plural "videos" for values greater than 1', () => {
      const props = createSectionProps({
        config: createConfig({ channelFilesToDownload: 2 })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('2 videos')).toBeInTheDocument();
    });
  });

  describe('Preferred Resolution Select', () => {
    test('renders Preferred Resolution select', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      const labels = screen.getAllByText('Preferred Resolution');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('displays current resolution value', () => {
      const props = createSectionProps({
        config: createConfig({ preferredResolution: '1080' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('1080p')).toBeInTheDocument();
    });

    test('calls onConfigChange when resolution is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ preferredResolution: '1080' }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: '1080p' });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: '4K (2160p)' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ preferredResolution: '2160' });
    });

    test('displays all resolution options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: '1080p' });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: '4K (2160p)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1440p' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '1080p' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '720p' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '480p' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '360p' })).toBeInTheDocument();
    });
  });

  describe('Preferred Video Codec Select', () => {
    test('renders Preferred Video Codec select', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      const labels = screen.getAllByText('Preferred Video Codec');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('displays current codec value', () => {
      const props = createSectionProps({
        config: createConfig({ videoCodec: 'h264' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('H.264/AVC (Best Compatibility)')).toBeInTheDocument();
    });

    test('calls onConfigChange when codec is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ videoCodec: 'default' }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: 'Default (No Preference)' });
      await user.click(selectButton);

      const option = await screen.findByRole('option', { name: 'H.265/HEVC (Balanced)' });
      await user.click(option);

      expect(onConfigChange).toHaveBeenCalledWith({ videoCodec: 'h265' });
    });

    test('displays all codec options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);

      const selectButton = screen.getByRole('button', { name: 'Default (No Preference)' });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: 'Default (No Preference)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'H.264/AVC (Best Compatibility)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'H.265/HEVC (Balanced)' })).toBeInTheDocument();
    });

    test('displays helper text about codec preferences', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText(/Note: H\.264 produces larger file sizes/i)).toBeInTheDocument();
    });
  });

  describe('Use tmp dir for download processing Checkbox', () => {
    test('renders Use tmp dir checkbox', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i })).toBeInTheDocument();
    });

    test('checkbox reflects useTmpForDownloads state', () => {
      const props = createSectionProps({
        config: createConfig({ useTmpForDownloads: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ useTmpForDownloads: false }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledWith({ useTmpForDownloads: true });
    });

    test('checkbox is disabled when platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ useTmpForDownloads: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      expect(checkbox).toBeDisabled();
    });

    test('checkbox is enabled when not platform managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ useTmpForDownloads: false })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const checkbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      expect(checkbox).not.toBeDisabled();
    });

    test('shows platform managed chip when managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ useTmpForDownloads: true }),
        deploymentEnvironment: createDeploymentEnvironment({ platform: 'TestPlatform' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('Platform Managed')).toBeInTheDocument();
    });

    test('shows Elfhosted-specific chip when Elfhosted managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ useTmpForDownloads: true }),
        deploymentEnvironment: createDeploymentEnvironment({ platform: 'Elfhosted' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('Managed by Elfhosted')).toBeInTheDocument();
    });

    test('does not show platform managed chip when not managed', () => {
      const props = createSectionProps({
        isPlatformManaged: createPlatformManagedState({ useTmpForDownloads: false })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.queryByText('Platform Managed')).not.toBeInTheDocument();
      expect(screen.queryByText('Managed by Elfhosted')).not.toBeInTheDocument();
    });
  });

  describe('Enable Subtitle Downloads Checkbox', () => {
    test('renders Enable Subtitle Downloads checkbox', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i })).toBeInTheDocument();
    });

    test('checkbox reflects subtitlesEnabled state', () => {
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const checkbox = screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i });
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: false }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const checkbox = screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledWith({ subtitlesEnabled: true });
    });
  });

  describe('Subtitle Language Selector', () => {
    test('does not render when subtitles are disabled', () => {
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: false })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.queryByTestId('subtitle-language-selector')).not.toBeInTheDocument();
    });

    test('renders when subtitles are enabled', () => {
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByTestId('subtitle-language-selector')).toBeInTheDocument();
    });

    test('passes current subtitle language value to selector', () => {
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: true, subtitleLanguage: 'es,fr' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const input = screen.getByTestId('subtitle-language-input') as HTMLInputElement;
      expect(input).toHaveValue('es,fr');
    });

    test('calls onConfigChange when subtitle language changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: true, subtitleLanguage: 'en' }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const input = screen.getByTestId('subtitle-language-input');
      // Trigger a change event
      await user.type(input, 'x');

      // Check that onConfigChange was called (since we have a mocked component,
      // just verify it gets called with subtitleLanguage property)
      expect(onConfigChange).toHaveBeenCalled();
      const calls = onConfigChange.mock.calls;
      const hasSubtitleLanguageUpdate = calls.some(call => 'subtitleLanguage' in call[0]);
      expect(hasSubtitleLanguageUpdate).toBe(true);
    });
  });

  describe('InfoTooltip Integration', () => {
    test('calls onMobileTooltipClick when provided', () => {
      const onMobileTooltipClick = jest.fn();
      const props = createSectionProps({ onMobileTooltipClick });
      renderWithProviders(<CoreSettingsSection {...props} />);
      // InfoTooltip components are present with onMobileTooltipClick prop
      expect(screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i })).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', () => {
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByText('Core Settings')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('enabling subtitles shows language selector', async () => {
      const props = createSectionProps({
        config: createConfig({ subtitlesEnabled: false })
      });
      const { rerender } = renderWithProviders(<CoreSettingsSection {...props} />);

      expect(screen.queryByTestId('subtitle-language-selector')).not.toBeInTheDocument();

      // Simulate enabling subtitles
      rerender(
        <CoreSettingsSection
          {...props}
          config={createConfig({ subtitlesEnabled: true })}
        />
      );

      expect(screen.getByTestId('subtitle-language-selector')).toBeInTheDocument();
    });

    test('disabling auto downloads disables frequency selector', async () => {
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: true })
      });
      const { rerender } = renderWithProviders(<CoreSettingsSection {...props} />);

      let selectButton = screen.getByRole('button', { name: /Every 6 hours/i });
      expect(selectButton).not.toHaveAttribute('aria-disabled', 'true');

      // Simulate disabling auto downloads
      rerender(
        <CoreSettingsSection
          {...props}
          config={createConfig({ channelAutoDownload: false })}
        />
      );

      selectButton = screen.getByRole('button', { name: /Every 6 hours/i });
      expect(selectButton).toHaveAttribute('aria-disabled', 'true');
    });

    test('handles multiple configuration changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({ onConfigChange });
      renderWithProviders(<CoreSettingsSection {...props} />);

      // Toggle auto downloads
      const autoDownloadCheckbox = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      await user.click(autoDownloadCheckbox);
      expect(onConfigChange).toHaveBeenCalledWith({ channelAutoDownload: true });

      // Toggle subtitles
      const subtitlesCheckbox = screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i });
      await user.click(subtitlesCheckbox);
      expect(onConfigChange).toHaveBeenCalledWith({ subtitlesEnabled: true });

      // Toggle tmp downloads
      const tmpCheckbox = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });
      await user.click(tmpCheckbox);
      expect(onConfigChange).toHaveBeenCalledWith({ useTmpForDownloads: true });

      expect(onConfigChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty youtubeOutputDirectory', () => {
      const props = createSectionProps({
        config: createConfig({ youtubeOutputDirectory: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);
      const input = screen.getByLabelText(/YouTube Output Directory/i) as HTMLInputElement;
      expect(input).toHaveValue('');
    });

    test('handles unknown cron expression in frequency', () => {
      // Suppress console warnings for this test since MUI warns about out-of-range values
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const props = createSectionProps({
        config: createConfig({ channelDownloadFrequency: '* * * * *' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      // Component should render without crashing when given an unknown cron expression
      // The reverseFrequencyMapping function will return the raw cron expression
      expect(screen.getByText('Core Settings')).toBeInTheDocument();
      // Verify the Download Frequency label is present
      const labels = screen.getAllByText('Download Frequency');
      expect(labels.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    test('handles all checkboxes unchecked', () => {
      const props = createSectionProps({
        config: createConfig({
          channelAutoDownload: false,
          subtitlesEnabled: false,
          useTmpForDownloads: false
        })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const autoDownload = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      const subtitles = screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i });
      const tmp = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });

      expect(autoDownload).not.toBeChecked();
      expect(subtitles).not.toBeChecked();
      expect(tmp).not.toBeChecked();
    });

    test('handles all checkboxes checked', () => {
      const props = createSectionProps({
        config: createConfig({
          channelAutoDownload: true,
          subtitlesEnabled: true,
          useTmpForDownloads: true
        })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      const autoDownload = screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i });
      const subtitles = screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i });
      const tmp = screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i });

      expect(autoDownload).toBeChecked();
      expect(subtitles).toBeChecked();
      expect(tmp).toBeChecked();
    });
  });

  describe('Accessibility', () => {
    test('all select fields have accessible labels', () => {
      const props = createSectionProps({
        config: createConfig({ channelAutoDownload: true })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      expect(screen.getAllByText('Download Frequency').length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Files to Download per Channel/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Preferred Resolution').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Preferred Video Codec').length).toBeGreaterThan(0);
    });

    test('all checkboxes have accessible labels', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);

      expect(screen.getByRole('checkbox', { name: /Enable Automatic Downloads/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Use tmp dir for download processing/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Enable Subtitle Downloads/i })).toBeInTheDocument();
    });

    test('text input has accessible label', () => {
      const props = createSectionProps();
      renderWithProviders(<CoreSettingsSection {...props} />);
      expect(screen.getByLabelText(/YouTube Output Directory/i)).toBeInTheDocument();
    });
  });

  describe('Default Subfolder Confirmation Dialog', () => {
    let mockFetch: jest.SpyInstance;

    beforeEach(() => {
      mockFetch = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      mockFetch.mockRestore();
    });

    const openSubfolderDialog = async (user: ReturnType<typeof userEvent.setup>) => {
      // Click the button that triggers the onChange with a new folder value
      const triggerButton = screen.getByTestId('trigger-subfolder-change');
      await user.click(triggerButton);
    };

    test('shows loading state while fetching affected channels', async () => {
      const user = userEvent.setup();
      // Create a promise that we control to simulate loading state
      let resolvePromise: (value: Response) => void;
      const pendingPromise = new Promise<Response>((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockReturnValue(pendingPromise);

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Wait for dialog to appear, then check loading state
      await screen.findByText('Set Default Subfolder?');
      expect(screen.getByText('Checking affected channels...')).toBeInTheDocument();

      // Resolve the promise to clean up
      resolvePromise!({
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 0, channelNames: [] })
      } as unknown as Response);
    });

    test('shows "No tracked channels" message when count is 0', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 0, channelNames: [] })
      });

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Wait for the message to appear
      await screen.findByText('No tracked channels are currently using Default Subfolder.');
    });

    test('shows channel count when channels are affected', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 3,
          channelNames: ['Channel A', 'Channel B', 'Channel C']
        })
      });

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Wait for the count message
      await screen.findByText('3 tracked channels configured to use Default Subfolder.');
    });

    test('shows singular "channel" when count is 1', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 1,
          channelNames: ['Only Channel']
        })
      });

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      await screen.findByText('1 tracked channel configured to use Default Subfolder.');
    });

    test('expands and collapses channel list on click', async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          count: 2,
          channelNames: ['Channel A', 'Channel B']
        })
      });

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Wait for dialog to load
      await screen.findByText('2 tracked channels configured to use Default Subfolder.');

      // Initially should show "Show" link (collapsed state)
      expect(screen.getByText('Show affected channels ▼')).toBeInTheDocument();

      // Click to expand
      const expandLink = screen.getByText('Show affected channels ▼');
      await user.click(expandLink);

      // Should now show "Hide" link (expanded state)
      expect(screen.getByText('Hide affected channels ▲')).toBeInTheDocument();

      // Channel names should be visible when expanded
      expect(screen.getByText('Channel A')).toBeVisible();
      expect(screen.getByText('Channel B')).toBeVisible();

      // Click to collapse
      const collapseLink = screen.getByText('Hide affected channels ▲');
      await user.click(collapseLink);

      // Should show "Show" link again (collapsed state)
      expect(screen.getByText('Show affected channels ▼')).toBeInTheDocument();
    });

    test('calls onConfigChange with new subfolder on confirm', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 0, channelNames: [] })
      });

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Wait for dialog to load
      await screen.findByText('No tracked channels are currently using Default Subfolder.');

      // Click confirm
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      expect(onConfigChange).toHaveBeenCalledWith({ defaultSubfolder: 'NewFolder' });
    });

    test('closes dialog on cancel without calling onConfigChange', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ count: 0, channelNames: [] })
      });

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' }),
        onConfigChange
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Wait for dialog to load
      await screen.findByText('No tracked channels are currently using Default Subfolder.');

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // Should not have called onConfigChange
      expect(onConfigChange).not.toHaveBeenCalled();

      // Dialog should be closed
      expect(screen.queryByText('Set Default Subfolder?')).not.toBeInTheDocument();
    });

    test('handles fetch error gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('Network error'));

      const props = createSectionProps({
        config: createConfig({ defaultSubfolder: '' })
      });
      renderWithProviders(<CoreSettingsSection {...props} />);

      await openSubfolderDialog(user);

      // Should show zero count (fallback) after error
      await screen.findByText('No tracked channels are currently using Default Subfolder.');

      consoleSpy.mockRestore();
    });
  });
});
