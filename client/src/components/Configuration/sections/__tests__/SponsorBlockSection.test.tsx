import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SponsorBlockSection } from '../SponsorBlockSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  ...overrides,
});

const createSectionProps = (
  overrides: Partial<React.ComponentProps<typeof SponsorBlockSection>> = {}
): React.ComponentProps<typeof SponsorBlockSection> => ({
  config: createConfig(),
  onConfigChange: jest.fn(),
  onMobileTooltipClick: jest.fn(),
  ...overrides,
});

// Helper to expand accordion
const expandAccordion = async (user: ReturnType<typeof userEvent.setup>) => {
  const accordionButton = screen.getByRole('button', { name: /SponsorBlock Integration/i });
  await user.click(accordionButton);
};

describe('SponsorBlockSection Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);
      expect(screen.getByText('SponsorBlock Integration')).toBeInTheDocument();
    });

    test('renders with ConfigurationAccordion wrapper', () => {
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);
      expect(screen.getByText('SponsorBlock Integration')).toBeInTheDocument();
    });

    test('displays "Disabled" chip when SponsorBlock is disabled', () => {
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });

    test('displays "Enabled" chip when SponsorBlock is enabled', () => {
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });

    test('accordion is collapsed by default', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<SponsorBlockSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /SponsorBlock Integration/i });
      expect(accordionButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('renders info alert with title and description', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('What is SponsorBlock?')).toBeInTheDocument();
      expect(screen.getByText(/SponsorBlock is a crowdsourced database/i)).toBeInTheDocument();
      expect(screen.getByText(/automatically remove or mark these segments/i)).toBeInTheDocument();
    });
  });

  describe('Enable SponsorBlock Checkbox', () => {
    test('renders Enable SponsorBlock checkbox', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Enable SponsorBlock/i })).toBeInTheDocument();
    });

    test('checkbox reflects sponsorblockEnabled state when false', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });
      expect(checkbox).not.toBeChecked();
    });

    test('checkbox reflects sponsorblockEnabled state when true', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });
      expect(checkbox).toBeChecked();
    });

    test('calls onConfigChange when checkbox is toggled on', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ sponsorblockEnabled: true });
    });

    test('calls onConfigChange when checkbox is toggled off', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({ sponsorblockEnabled: false });
    });
  });

  describe('Action for Segments Select - Visibility', () => {
    test('does not show action select when SponsorBlock is disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByText('Action for Segments')).not.toBeInTheDocument();
    });

    test('shows action select when SponsorBlock is enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const labels = screen.getAllByText('Action for Segments');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('does not show API URL field when SponsorBlock is disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByLabelText(/Custom API URL/i)).not.toBeInTheDocument();
    });

    test('shows API URL field when SponsorBlock is enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Custom API URL/i)).toBeInTheDocument();
    });

    test('does not show category checkboxes when SponsorBlock is disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByText(/Segment Categories to/i)).not.toBeInTheDocument();
    });

    test('shows category checkboxes when SponsorBlock is enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Segment Categories to Remove:/i)).toBeInTheDocument();
    });
  });

  describe('Action for Segments Select - Functionality', () => {
    test('displays current action value as "remove"', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'remove'
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Remove segments from video')).toBeInTheDocument();
    });

    test('displays current action value as "mark"', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'mark'
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Mark segments as chapters')).toBeInTheDocument();
    });

    test('calls onConfigChange when action is changed to "mark"', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'remove'
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('button', { name: /Remove segments from video/i });
      await user.click(selectButton);

      const markOption = await screen.findByRole('option', { name: 'Mark segments as chapters' });
      await user.click(markOption);

      expect(onConfigChange).toHaveBeenCalledWith({ sponsorblockAction: 'mark' });
    });

    test('calls onConfigChange when action is changed to "remove"', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'mark'
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('button', { name: /Mark segments as chapters/i });
      await user.click(selectButton);

      const removeOption = await screen.findByRole('option', { name: 'Remove segments from video' });
      await user.click(removeOption);

      expect(onConfigChange).toHaveBeenCalledWith({ sponsorblockAction: 'remove' });
    });

    test('displays both action options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const selectButton = screen.getByRole('button', { name: /Remove segments from video/i });
      await user.click(selectButton);

      expect(await screen.findByRole('option', { name: 'Remove segments from video' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Mark segments as chapters' })).toBeInTheDocument();
    });

    test('displays helper text about action types', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Remove: Cuts out segments entirely/i)).toBeInTheDocument();
      expect(screen.getByText(/Mark: Creates chapter markers for easy skipping/i)).toBeInTheDocument();
    });
  });

  describe('Custom API URL Field', () => {
    test('displays current API URL value', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockApiUrl: 'https://custom.api.url'
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i) as HTMLInputElement;
      expect(input).toHaveValue('https://custom.api.url');
    });

    test('displays empty string when API URL is not set', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockApiUrl: ''
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i) as HTMLInputElement;
      expect(input).toHaveValue('');
    });

    test('has correct placeholder text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i);
      expect(input).toHaveAttribute('placeholder', 'https://sponsor.ajay.app');
    });

    test('displays helper text', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText(/Leave empty to use the default SponsorBlock API/i)).toBeInTheDocument();
    });

    test('calls onConfigChange when API URL is changed', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true, sponsorblockApiUrl: '' }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i);
      await user.type(input, 'https://test.api');

      expect(onConfigChange).toHaveBeenCalled();
      const calls = onConfigChange.mock.calls;
      expect(calls[calls.length - 1][0]).toHaveProperty('sponsorblockApiUrl');
    });

    test('input has correct name attribute', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i);
      expect(input).toHaveAttribute('name', 'sponsorblockApiUrl');
    });
  });

  describe('Category Section Title', () => {
    test('displays "Remove" in title when action is "remove"', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'remove'
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Segment Categories to Remove:')).toBeInTheDocument();
    });

    test('displays "Mark" in title when action is "mark"', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'mark'
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Segment Categories to Mark:')).toBeInTheDocument();
    });
  });

  describe('Category Checkboxes - Rendering', () => {
    test('renders all 8 category checkboxes', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Sponsor')).toBeInTheDocument();
      expect(screen.getByText('Intro')).toBeInTheDocument();
      expect(screen.getByText('Outro')).toBeInTheDocument();
      expect(screen.getByText('Self-Promotion')).toBeInTheDocument();
      expect(screen.getByText('Preview/Recap')).toBeInTheDocument();
      expect(screen.getByText('Filler')).toBeInTheDocument();
      expect(screen.getByText('Interaction')).toBeInTheDocument();
      expect(screen.getByText('Music Off-Topic')).toBeInTheDocument();
    });

    test('displays descriptions for all categories', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Paid promotions, product placements')).toBeInTheDocument();
      expect(screen.getByText('Opening sequences, title cards')).toBeInTheDocument();
      expect(screen.getByText('End cards, credits')).toBeInTheDocument();
      expect(screen.getByText('Channel merch, Patreon, other videos')).toBeInTheDocument();
      expect(screen.getByText('"Coming up" or "Previously on" segments')).toBeInTheDocument();
      expect(screen.getByText('Tangential content, dead space')).toBeInTheDocument();
      expect(screen.getByText('"Like and subscribe" reminders')).toBeInTheDocument();
      expect(screen.getByText('Non-music content in music videos')).toBeInTheDocument();
    });
  });

  describe('Category Checkboxes - Default State', () => {
    test('sponsor checkbox is checked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const sponsorCheckbox = screen.getByTestId('category-sponsor-checkbox');
      expect(sponsorCheckbox).toBeChecked();
    });

    test('selfpromo checkbox is checked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const selfpromoCheckbox = screen.getByTestId('category-selfpromo-checkbox');
      expect(selfpromoCheckbox).toBeChecked();
    });

    test('intro checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const introCheckbox = screen.getByTestId('category-intro-checkbox');
      expect(introCheckbox).not.toBeChecked();
    });

    test('outro checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const outroCheckbox = screen.getByTestId('category-outro-checkbox');
      expect(outroCheckbox).not.toBeChecked();
    });

    test('preview checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const previewCheckbox = screen.getByTestId('category-preview-checkbox');
      expect(previewCheckbox).not.toBeChecked();
    });

    test('filler checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const fillerCheckbox = screen.getByTestId('category-filler-checkbox');
      expect(fillerCheckbox).not.toBeChecked();
    });

    test('interaction checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const interactionCheckbox = screen.getByTestId('category-interaction-checkbox');
      expect(interactionCheckbox).not.toBeChecked();
    });

    test('music_offtopic checkbox is unchecked by default', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const musicCheckbox = screen.getByTestId('category-music_offtopic-checkbox');
      expect(musicCheckbox).not.toBeChecked();
    });
  });

  describe('Category Checkboxes - Custom State', () => {
    test('reflects custom category state with all enabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: true,
            outro: true,
            selfpromo: true,
            preview: true,
            filler: true,
            interaction: true,
            music_offtopic: true,
          }
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const sponsorCheckbox = screen.getByTestId('category-sponsor-checkbox');
      const introCheckbox = screen.getByTestId('category-intro-checkbox');
      const outroCheckbox = screen.getByTestId('category-outro-checkbox');
      const selfpromoCheckbox = screen.getByTestId('category-selfpromo-checkbox');
      const previewCheckbox = screen.getByTestId('category-preview-checkbox');
      const fillerCheckbox = screen.getByTestId('category-filler-checkbox');
      const interactionCheckbox = screen.getByTestId('category-interaction-checkbox');
      const musicCheckbox = screen.getByTestId('category-music_offtopic-checkbox');

      expect(sponsorCheckbox).toBeChecked();
      expect(introCheckbox).toBeChecked();
      expect(outroCheckbox).toBeChecked();
      expect(selfpromoCheckbox).toBeChecked();
      expect(previewCheckbox).toBeChecked();
      expect(fillerCheckbox).toBeChecked();
      expect(interactionCheckbox).toBeChecked();
      expect(musicCheckbox).toBeChecked();
    });

    test('reflects custom category state with all disabled', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: false,
            intro: false,
            outro: false,
            selfpromo: false,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const sponsorCheckbox = screen.getByTestId('category-sponsor-checkbox');
      const introCheckbox = screen.getByTestId('category-intro-checkbox');
      const outroCheckbox = screen.getByTestId('category-outro-checkbox');
      const selfpromoCheckbox = screen.getByTestId('category-selfpromo-checkbox');
      const previewCheckbox = screen.getByTestId('category-preview-checkbox');
      const fillerCheckbox = screen.getByTestId('category-filler-checkbox');
      const interactionCheckbox = screen.getByTestId('category-interaction-checkbox');
      const musicCheckbox = screen.getByTestId('category-music_offtopic-checkbox');

      expect(sponsorCheckbox).not.toBeChecked();
      expect(introCheckbox).not.toBeChecked();
      expect(outroCheckbox).not.toBeChecked();
      expect(selfpromoCheckbox).not.toBeChecked();
      expect(previewCheckbox).not.toBeChecked();
      expect(fillerCheckbox).not.toBeChecked();
      expect(interactionCheckbox).not.toBeChecked();
      expect(musicCheckbox).not.toBeChecked();
    });
  });

  describe('Category Checkboxes - User Interaction', () => {
    test('calls onConfigChange when sponsor checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: false,
            outro: false,
            selfpromo: true,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const sponsorCheckbox = screen.getByTestId('category-sponsor-checkbox');
      await user.click(sponsorCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({
        sponsorblockCategories: {
          sponsor: false,
          intro: false,
          outro: false,
          selfpromo: true,
          preview: false,
          filler: false,
          interaction: false,
          music_offtopic: false,
        }
      });
    });

    test('calls onConfigChange when intro checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: false,
            outro: false,
            selfpromo: true,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const introCheckbox = screen.getByTestId('category-intro-checkbox');
      await user.click(introCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({
        sponsorblockCategories: {
          sponsor: true,
          intro: true,
          outro: false,
          selfpromo: true,
          preview: false,
          filler: false,
          interaction: false,
          music_offtopic: false,
        }
      });
    });

    test('calls onConfigChange when outro checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: false,
            outro: false,
            selfpromo: true,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const outroCheckbox = screen.getByTestId('category-outro-checkbox');
      await user.click(outroCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({
        sponsorblockCategories: {
          sponsor: true,
          intro: false,
          outro: true,
          selfpromo: true,
          preview: false,
          filler: false,
          interaction: false,
          music_offtopic: false,
        }
      });
    });

    test('calls onConfigChange when filler checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: false,
            outro: false,
            selfpromo: true,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const fillerCheckbox = screen.getByTestId('category-filler-checkbox');
      await user.click(fillerCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({
        sponsorblockCategories: {
          sponsor: true,
          intro: false,
          outro: false,
          selfpromo: true,
          preview: false,
          filler: true,
          interaction: false,
          music_offtopic: false,
        }
      });
    });

    test('calls onConfigChange when interaction checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: false,
            outro: false,
            selfpromo: true,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const interactionCheckbox = screen.getByTestId('category-interaction-checkbox');
      await user.click(interactionCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({
        sponsorblockCategories: {
          sponsor: true,
          intro: false,
          outro: false,
          selfpromo: true,
          preview: false,
          filler: false,
          interaction: true,
          music_offtopic: false,
        }
      });
    });

    test('calls onConfigChange when music_offtopic checkbox is toggled', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockCategories: {
            sponsor: true,
            intro: false,
            outro: false,
            selfpromo: true,
            preview: false,
            filler: false,
            interaction: false,
            music_offtopic: false,
          }
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const musicCheckbox = screen.getByTestId('category-music_offtopic-checkbox');
      await user.click(musicCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(1);
      expect(onConfigChange).toHaveBeenCalledWith({
        sponsorblockCategories: {
          sponsor: true,
          intro: false,
          outro: false,
          selfpromo: true,
          preview: false,
          filler: false,
          interaction: false,
          music_offtopic: true,
        }
      });
    });
  });

  describe('InfoTooltip Integration', () => {
    test('renders section with InfoTooltip support', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Enable SponsorBlock')).toBeInTheDocument();
    });

    test('works without onMobileTooltipClick prop', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({ onMobileTooltipClick: undefined });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('SponsorBlock Integration')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('enabling SponsorBlock shows configuration options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false })
      });
      const { rerender } = renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.queryByText('Action for Segments')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Custom API URL/i)).not.toBeInTheDocument();

      // Simulate enabling SponsorBlock
      rerender(
        <SponsorBlockSection
          {...props}
          config={createConfig({ sponsorblockEnabled: true })}
        />
      );

      const labels = screen.getAllByText('Action for Segments');
      expect(labels.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/Custom API URL/i)).toBeInTheDocument();
      expect(screen.getByText(/Segment Categories to Remove:/i)).toBeInTheDocument();
    });

    test('disabling SponsorBlock hides configuration options', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      const { rerender } = renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const labels = screen.getAllByText('Action for Segments');
      expect(labels.length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/Custom API URL/i)).toBeInTheDocument();

      // Simulate disabling SponsorBlock
      rerender(
        <SponsorBlockSection
          {...props}
          config={createConfig({ sponsorblockEnabled: false })}
        />
      );

      expect(screen.queryByText('Action for Segments')).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Custom API URL/i)).not.toBeInTheDocument();
    });

    test('changing action updates category section title', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'remove'
        })
      });
      const { rerender } = renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Segment Categories to Remove:')).toBeInTheDocument();

      // Change action to "mark"
      rerender(
        <SponsorBlockSection
          {...props}
          config={createConfig({
            sponsorblockEnabled: true,
            sponsorblockAction: 'mark'
          })}
        />
      );

      expect(screen.getByText('Segment Categories to Mark:')).toBeInTheDocument();
      expect(screen.queryByText('Segment Categories to Remove:')).not.toBeInTheDocument();
    });

    test('handles complete workflow: enable, configure action, set categories', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();

      // Start with SponsorBlock enabled to simplify the test
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockAction: 'remove'
        }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      // Change action to "mark"
      const selectButton = screen.getByRole('button', { name: /Remove segments from video/i });
      await user.click(selectButton);
      const markOption = await screen.findByRole('option', { name: 'Mark segments as chapters' });
      await user.click(markOption);
      expect(onConfigChange).toHaveBeenCalledWith({ sponsorblockAction: 'mark' });

      // Toggle a category
      onConfigChange.mockClear();
      const introCheckbox = screen.getByTestId('category-intro-checkbox');
      await user.click(introCheckbox);

      expect(onConfigChange).toHaveBeenCalled();
      const lastCall = onConfigChange.mock.calls[onConfigChange.mock.calls.length - 1][0];
      expect(lastCall.sponsorblockCategories.intro).toBe(true);
    });

    test('handles multiple category toggles', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      // Toggle intro
      const introCheckbox = screen.getByTestId('category-intro-checkbox');
      await user.click(introCheckbox);

      // Toggle outro
      const outroCheckbox = screen.getByTestId('category-outro-checkbox');
      await user.click(outroCheckbox);

      // Toggle filler
      const fillerCheckbox = screen.getByTestId('category-filler-checkbox');
      await user.click(fillerCheckbox);

      expect(onConfigChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty API URL', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockApiUrl: ''
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i) as HTMLInputElement;
      expect(input).toHaveValue('');
    });

    test('handles very long API URL', async () => {
      const user = userEvent.setup();
      const longUrl = 'https://very-long-custom-api-url-that-goes-on-and-on.example.com/api/sponsorblock/v1/endpoint';
      const props = createSectionProps({
        config: createConfig({
          sponsorblockEnabled: true,
          sponsorblockApiUrl: longUrl
        })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const input = screen.getByLabelText(/Custom API URL/i) as HTMLInputElement;
      expect(input).toHaveValue(longUrl);
    });

    test('handles rapid toggling of enable checkbox', async () => {
      const user = userEvent.setup();
      const onConfigChange = jest.fn();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: false }),
        onConfigChange
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const checkbox = screen.getByRole('checkbox', { name: /Enable SponsorBlock/i });

      // Rapidly toggle multiple times
      await user.click(checkbox);
      await user.click(checkbox);
      await user.click(checkbox);

      expect(onConfigChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    test('enable checkbox has accessible label', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByRole('checkbox', { name: /Enable SponsorBlock/i })).toBeInTheDocument();
    });

    test('action select has accessible label', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const labels = screen.getAllByText('Action for Segments');
      expect(labels.length).toBeGreaterThan(0);
    });

    test('API URL input has accessible label', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByLabelText(/Custom API URL/i)).toBeInTheDocument();
    });

    test('all category checkboxes have descriptive labels', async () => {
      const user = userEvent.setup();
      const props = createSectionProps({
        config: createConfig({ sponsorblockEnabled: true })
      });
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      expect(screen.getByText('Sponsor')).toBeInTheDocument();
      expect(screen.getByText('Intro')).toBeInTheDocument();
      expect(screen.getByText('Outro')).toBeInTheDocument();
      expect(screen.getByText('Self-Promotion')).toBeInTheDocument();
      expect(screen.getByText('Preview/Recap')).toBeInTheDocument();
      expect(screen.getByText('Filler')).toBeInTheDocument();
      expect(screen.getByText('Interaction')).toBeInTheDocument();
      expect(screen.getByText('Music Off-Topic')).toBeInTheDocument();
    });

    test('alert has proper role', async () => {
      const user = userEvent.setup();
      const props = createSectionProps();
      renderWithProviders(<SponsorBlockSection {...props} />);

      await expandAccordion(user);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    test('accordion has proper aria attributes', () => {
      const props = createSectionProps();
      const { container } = renderWithProviders(<SponsorBlockSection {...props} />);
      const accordionButton = within(container).getByRole('button', { name: /SponsorBlock Integration/i });
      expect(accordionButton).toHaveAttribute('aria-expanded');
    });
  });
});
