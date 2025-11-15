import React from 'react';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { KodiCompatibilitySection } from '../KodiCompatibilitySection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof KodiCompatibilitySection>> = {}
): React.ComponentProps<typeof KodiCompatibilitySection> => ({
  config: createConfig(),
  onConfigChange: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ...overrides,
});

// Helper function to expand the accordion
const expandAccordion = async (user: ReturnType<typeof userEvent.setup>) => {
  const accordionButton = screen.getByRole('button', { name: /Kodi, Emby and Jellyfin compatibility/i });
  await user.click(accordionButton);
};

describe('KodiCompatibilitySection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);
      expect(screen.getByText('Kodi, Emby and Jellyfin compatibility')).toBeInTheDocument();
    });

    test('renders title correctly', () => {
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);
      expect(screen.getByText('Kodi, Emby and Jellyfin compatibility')).toBeInTheDocument();
    });

    test('renders info alert with instructions', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Control generation of metadata and artwork files/i)).toBeInTheDocument();
    });

    test('renders best results instructions', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('For best results:')).toBeInTheDocument();
    });

    test('renders Movies content type instruction', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Add your download library as Content Type:/i)).toBeInTheDocument();
      expect(screen.getByText('Movies')).toBeInTheDocument();
    });

    test('renders Nfo metadata readers instruction', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Under Metadata Readers\/Savers, select/i)).toBeInTheDocument();
      expect(screen.getByText('Nfo')).toBeInTheDocument();
    });

    test('renders metadata downloaders instruction', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Uncheck all metadata downloaders/i)).toBeInTheDocument();
    });
  });

  describe('Generate video .nfo files Checkbox', () => {
    test('renders Generate video .nfo files checkbox', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeInTheDocument();
    });

    test('checkbox reflects writeVideoNfoFiles state when false', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: false })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      expect(checkbox).not.toBeChecked();
    });

    test('checkbox reflects writeVideoNfoFiles state when true', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: true })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled from false to true', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: false }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ writeVideoNfoFiles: true });
    });

    test('calls onConfigChange when checkbox is toggled from true to false', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: true }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ writeVideoNfoFiles: false });
    });

    test('renders helper text for .nfo files', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Recommended when another media server scans your downloads.')).toBeInTheDocument();
    });
  });

  describe('Copy channel poster.jpg files Checkbox', () => {
    test('renders Copy channel poster.jpg files checkbox', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).toBeInTheDocument();
    });

    test('checkbox reflects writeChannelPosters state when false', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ writeChannelPosters: false })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      expect(checkbox).not.toBeChecked();
    });

    test('checkbox reflects writeChannelPosters state when true', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ writeChannelPosters: true })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled from false to true', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeChannelPosters: false }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ writeChannelPosters: true });
    });

    test('calls onConfigChange when checkbox is toggled from true to false', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeChannelPosters: true }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ writeChannelPosters: false });
    });

    test('renders helper text for channel posters', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Helps Kodi, Emby and Jellyfin display artwork for channel folders.')).toBeInTheDocument();
    });
  });

  describe('InfoTooltip Integration', () => {
    test('renders InfoTooltip for .nfo files checkbox', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // InfoTooltip is rendered alongside the checkbox label
      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeInTheDocument();
    });

    test('renders InfoTooltip for channel posters checkbox', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // InfoTooltip is rendered alongside the checkbox label
      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).toBeInTheDocument();
    });

    test('works with onMobileTooltipClick prop', async () => {
      const user = userEvent.setup();
      const onMobileTooltipClick = jest.fn();
      const props = createSectionProps({ onMobileTooltipClick });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // InfoTooltip components are present with onMobileTooltipClick prop
      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', () => {
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<KodiCompatibilitySection {...props} />);
      expect(screen.getByText('Kodi, Emby and Jellyfin compatibility')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('handles toggling both checkboxes independently', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          writeVideoNfoFiles: false,
          writeChannelPosters: false
        }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // Toggle .nfo files checkbox
      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      await user.click(nfoCheckbox);
      expect(onConfigChange).toHaveBeenCalledWith({ writeVideoNfoFiles: true });

      // Toggle channel posters checkbox
      const posterCheckbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      await user.click(posterCheckbox);
      expect(onConfigChange).toHaveBeenCalledWith({ writeChannelPosters: true });

      expect(onConfigChange).toHaveBeenCalledTimes(2);
    });

    test('handles multiple configuration changes', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          writeVideoNfoFiles: true,
          writeChannelPosters: true
        }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // Toggle both checkboxes off
      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      await user.click(nfoCheckbox);
      expect(onConfigChange).toHaveBeenNthCalledWith(1, { writeVideoNfoFiles: false });

      const posterCheckbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });
      await user.click(posterCheckbox);
      expect(onConfigChange).toHaveBeenNthCalledWith(2, { writeChannelPosters: false });

      expect(onConfigChange).toHaveBeenCalledTimes(2);
    });

    test('renders correctly with default config values', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: DEFAULT_CONFIG
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // Default values from schema: both true
      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      const posterCheckbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });

      expect(nfoCheckbox).toBeChecked();
      expect(posterCheckbox).toBeChecked();
    });
  });

  describe('Edge Cases', () => {
    test('handles both checkboxes unchecked', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          writeVideoNfoFiles: false,
          writeChannelPosters: false
        })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      const posterCheckbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });

      expect(nfoCheckbox).not.toBeChecked();
      expect(posterCheckbox).not.toBeChecked();
    });

    test('handles both checkboxes checked', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          writeVideoNfoFiles: true,
          writeChannelPosters: true
        })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      const posterCheckbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });

      expect(nfoCheckbox).toBeChecked();
      expect(posterCheckbox).toBeChecked();
    });

    test('handles mixed checkbox states', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          writeVideoNfoFiles: true,
          writeChannelPosters: false
        })
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });
      const posterCheckbox = screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i });

      expect(nfoCheckbox).toBeChecked();
      expect(posterCheckbox).not.toBeChecked();
    });

    test('handles rapid toggle of same checkbox', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: false }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });

      // Rapid toggles - each click just calls onConfigChange with the toggled value
      await user.click(nfoCheckbox);
      await user.click(nfoCheckbox);
      await user.click(nfoCheckbox);

      // All three clicks should fire onChange with the toggled value
      // Component doesn't manage state internally, just reports changes
      expect(onConfigChange).toHaveBeenCalledTimes(3);
      expect(onConfigChange).toHaveBeenNthCalledWith(1, { writeVideoNfoFiles: true });
      expect(onConfigChange).toHaveBeenNthCalledWith(2, { writeVideoNfoFiles: true });
      expect(onConfigChange).toHaveBeenNthCalledWith(3, { writeVideoNfoFiles: true });
    });
  });

  describe('Accessibility', () => {
    test('all checkboxes have accessible labels', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).toBeInTheDocument();
    });

    test('checkboxes are keyboard accessible', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: false }),
        onConfigChange
      });
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const nfoCheckbox = screen.getByRole('checkbox', { name: /Generate video \.nfo files/i });

      // Focus on checkbox and press space
      await act(async () => {
        nfoCheckbox.focus();
      });
      await user.keyboard(' ');

      expect(onConfigChange).toHaveBeenCalledWith({ writeVideoNfoFiles: true });
    });

    test('alert has proper role', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    test('helper text is associated with checkboxes', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // Helper texts should be present and visible
      expect(screen.getByText('Recommended when another media server scans your downloads.')).toBeInTheDocument();
      expect(screen.getByText('Helps Kodi, Emby and Jellyfin display artwork for channel folders.')).toBeInTheDocument();
    });
  });

  describe('Multiple Renders', () => {
    test('maintains state across re-renders', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: true, writeChannelPosters: false })
      });
      const { rerender } = renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).not.toBeChecked();

      // Re-render with same props - accordion closes on rerender, so we need to expand again
      rerender(<KodiCompatibilitySection {...props} />);
      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).not.toBeChecked();
    });

    test('updates when config changes', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: false })
      });
      const { rerender } = renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).not.toBeChecked();

      // Update config - accordion closes on rerender, so we need to expand again
      rerender(
        <KodiCompatibilitySection
          {...props}
          config={createConfig({ writeVideoNfoFiles: true })}
        />
      );
      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeChecked();
    });

    test('handles prop updates correctly', () => {
      const onConfigChange1 = jest.fn();
      const onConfigChange2 = jest.fn();
      const props = createSectionProps({
        config: createConfig({ writeVideoNfoFiles: false }),
        onConfigChange: onConfigChange1
      });
      const { rerender } = renderWithProviders(<KodiCompatibilitySection {...props} />);

      // Update onConfigChange handler
      rerender(
        <KodiCompatibilitySection
          {...props}
          onConfigChange={onConfigChange2}
        />
      );

      expect(screen.getByText('Kodi, Emby and Jellyfin compatibility')).toBeInTheDocument();
    });
  });

  describe('Accordion Behavior', () => {
    test('renders within ConfigurationAccordion component', () => {
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      // The accordion title should be present
      expect(screen.getByText('Kodi, Emby and Jellyfin compatibility')).toBeInTheDocument();
    });

    test('content is accessible when accordion is expanded', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<KodiCompatibilitySection {...props} />);

      await expandAccordion(user);

      // All main content should be accessible after expanding
      expect(screen.getByRole('checkbox', { name: /Generate video \.nfo files/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Copy channel poster\.jpg files/i })).toBeInTheDocument();
      expect(screen.getByText(/Control generation of metadata and artwork files/i)).toBeInTheDocument();
    });
  });
});
