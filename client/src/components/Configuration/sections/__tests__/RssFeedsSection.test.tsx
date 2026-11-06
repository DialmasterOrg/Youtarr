import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RssFeedsSection } from '../RssFeedsSection';
import { renderWithProviders } from '../../../../test-utils';
import { ConfigState } from '../../types';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';

jest.mock('../../hooks/useDownloadsFeedToken', () => ({
  useDownloadsFeedToken: jest.fn(),
}));

const { useDownloadsFeedToken } = require('../../hooks/useDownloadsFeedToken');

const FEED_TOKEN = 'a'.repeat(64);
const FEED_URL = `${window.location.origin}/feeds/downloads.xml?token=${FEED_TOKEN}`;
const YOUTARR_TEMPLATE = `${window.location.origin}/videos?video={youtubeId}`;

const createConfig = (overrides: Partial<ConfigState> = {}): ConfigState => ({
  ...DEFAULT_CONFIG,
  downloadsFeedEnabled: true,
  ...overrides,
});

const setupSection = (overrides: Partial<React.ComponentProps<typeof RssFeedsSection>> = {}) => {
  const config = overrides.config ?? createConfig();
  const props: React.ComponentProps<typeof RssFeedsSection> = {
    token: 'session',
    config,
    savedConfig: config,
    onConfigChange: jest.fn(),
    setSnackbar: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<RssFeedsSection {...props} />);
  return props;
};

const mockToken = (overrides = {}) => {
  const value = {
    feedToken: FEED_TOKEN,
    loading: false,
    error: null,
    regenerating: false,
    regenerate: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
  useDownloadsFeedToken.mockReturnValue(value);
  return value;
};

const chooseOption = async (fieldLabel: string, optionName: string) => {
  fireEvent.mouseDown(screen.getByLabelText(fieldLabel));
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
};

describe('RssFeedsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToken();
  });

  describe('turning the feed on', () => {
    test('shows only the switch while the feed is off', () => {
      setupSection({ config: createConfig({ downloadsFeedEnabled: false }) });

      expect(screen.getByRole('checkbox', { name: /enable the download feed/i })).not.toBeChecked();
      expect(screen.queryByLabelText('Feed URL')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Videos in the feed')).not.toBeInTheDocument();
    });

    test('tells the token hook whether the feed is on', () => {
      setupSection({ config: createConfig({ downloadsFeedEnabled: false }) });

      expect(useDownloadsFeedToken).toHaveBeenCalledWith('session', false);
    });

    test('saves the switch', async () => {
      const props = setupSection({ config: createConfig({ downloadsFeedEnabled: false }) });

      await userEvent.click(screen.getByRole('checkbox', { name: /enable the download feed/i }));

      expect(props.onConfigChange).toHaveBeenCalledWith({ downloadsFeedEnabled: true });
    });
  });

  describe('feed URL', () => {
    test('shows the URL with the token', () => {
      setupSection();

      expect(screen.getByLabelText('Feed URL')).toHaveValue(FEED_URL);
    });

    test('says the URL starts working after saving when the feed is only on locally', () => {
      setupSection({
        config: createConfig(),
        savedConfig: createConfig({ downloadsFeedEnabled: false }),
      });

      expect(screen.getByText(/starts working after you save/i)).toBeInTheDocument();
    });

    test('does not mention saving once the feed is saved as on', () => {
      setupSection();

      expect(screen.queryByText(/starts working after you save/i)).not.toBeInTheDocument();
    });

    test('warns that anyone with the URL can read the feed', () => {
      setupSection();

      expect(screen.getByText(/treat it like a password/i)).toBeInTheDocument();
    });

    test('explains the login proxy exception', () => {
      setupSection();

      expect(screen.getByText(/add an exception for/i)).toHaveTextContent('/feeds/');
    });

    test('says when the URL is still loading', () => {
      mockToken({ feedToken: null, loading: true });

      setupSection();

      expect(screen.getByText(/loading the feed URL/i)).toBeInTheDocument();
      expect(screen.queryByLabelText('Feed URL')).not.toBeInTheDocument();
    });

    test('shows the error when the URL cannot be loaded', () => {
      mockToken({ feedToken: null, error: 'Could not load the feed URL.' });

      setupSection();

      expect(screen.getByText('Could not load the feed URL.')).toBeInTheDocument();
      expect(screen.queryByLabelText('Feed URL')).not.toBeInTheDocument();
    });
  });

  describe('copying the URL', () => {
    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });

    test('copies the URL and confirms', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      const props = setupSection();

      fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(FEED_URL));
      await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Feed URL copied',
        severity: 'success',
      }));
    });

    test('explains what to do without a clipboard, which browsers hide on plain http', async () => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
      const props = setupSection();

      fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));

      await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Your browser blocked copying. Select the URL and copy it yourself.',
        severity: 'warning',
      }));
    });
  });

  describe('creating a new URL', () => {
    test('does nothing until confirmed', async () => {
      const { regenerate } = mockToken();
      setupSection();

      await userEvent.click(screen.getByRole('button', { name: 'Create new URL' }));

      expect(screen.getByText(/the current URL stops working/i)).toBeInTheDocument();
      expect(regenerate).not.toHaveBeenCalled();
    });

    test('keeps the URL when cancelled', async () => {
      const { regenerate } = mockToken();
      setupSection();

      await userEvent.click(screen.getByRole('button', { name: 'Create new URL' }));
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(regenerate).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByText(/the current URL stops working/i)).not.toBeInTheDocument());
    });

    test('creates the URL once confirmed', async () => {
      const { regenerate } = mockToken();
      const props = setupSection();

      await userEvent.click(screen.getByRole('button', { name: 'Create new URL' }));
      await userEvent.click(screen.getByRole('button', { name: 'Replace URL' }));

      expect(regenerate).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Created a new feed URL. Update it in your RSS reader.',
        severity: 'success',
      }));
    });

    test('reports a failure', async () => {
      mockToken({ regenerate: jest.fn().mockResolvedValue(false) });
      const props = setupSection();

      await userEvent.click(screen.getByRole('button', { name: 'Create new URL' }));
      await userEvent.click(screen.getByRole('button', { name: 'Replace URL' }));

      await waitFor(() => expect(props.setSnackbar).toHaveBeenCalledWith({
        open: true,
        message: 'Could not create a new feed URL.',
        severity: 'error',
      }));
    });
  });

  describe('number of videos', () => {
    test('saves the selected number as a number', async () => {
      const props = setupSection();

      await chooseOption('Videos in the feed', '100 videos');

      expect(props.onConfigChange).toHaveBeenCalledWith({ downloadsFeedItemLimit: 100 });
    });

    test('offers a hand-edited number that is not one of the standard choices', async () => {
      setupSection({ config: createConfig({ downloadsFeedItemLimit: 75 }) });

      fireEvent.mouseDown(screen.getByLabelText('Videos in the feed'));

      expect(await screen.findByRole('option', { name: '75 videos' })).toBeInTheDocument();
    });
  });

  describe('video types', () => {
    test('removes a type', async () => {
      const props = setupSection();

      await userEvent.click(screen.getByRole('checkbox', { name: 'Shorts' }));

      expect(props.onConfigChange).toHaveBeenCalledWith({ downloadsFeedMediaTypes: ['video', 'livestream'] });
    });

    test('adds a type back in the standard order, so saved and current lists compare equal', async () => {
      const props = setupSection({ config: createConfig({ downloadsFeedMediaTypes: ['video', 'livestream'] }) });

      await userEvent.click(screen.getByRole('checkbox', { name: 'Shorts' }));

      expect(props.onConfigChange).toHaveBeenCalledWith({
        downloadsFeedMediaTypes: ['video', 'short', 'livestream'],
      });
    });

    test('keeps the last selected type from being turned off', () => {
      setupSection({ config: createConfig({ downloadsFeedMediaTypes: ['short'] }) });

      expect(screen.getByRole('checkbox', { name: 'Shorts' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'Videos' })).toBeEnabled();
    });
  });

  describe('item link', () => {
    test('opens YouTube by default, with no custom link field', () => {
      setupSection();

      expect(screen.getByLabelText('Clicking an item opens')).toHaveTextContent('YouTube');
      expect(screen.queryByLabelText('Custom link')).not.toBeInTheDocument();
    });

    test('saves this Youtarr as a link template', async () => {
      const props = setupSection();

      await chooseOption('Clicking an item opens', 'This Youtarr');

      expect(props.onConfigChange).toHaveBeenCalledWith({ downloadsFeedLinkTemplate: YOUTARR_TEMPLATE });
    });

    test('recognizes a saved link to this Youtarr', () => {
      setupSection({ config: createConfig({ downloadsFeedLinkTemplate: YOUTARR_TEMPLATE }) });

      expect(screen.getByLabelText('Clicking an item opens')).toHaveTextContent('This Youtarr');
    });

    test('clears the template when going back to YouTube', async () => {
      const props = setupSection({ config: createConfig({ downloadsFeedLinkTemplate: YOUTARR_TEMPLATE }) });

      await chooseOption('Clicking an item opens', 'YouTube');

      expect(props.onConfigChange).toHaveBeenCalledWith({ downloadsFeedLinkTemplate: '' });
    });

    test('shows the custom link field when custom is chosen', async () => {
      const props = setupSection();

      await chooseOption('Clicking an item opens', 'A custom link');

      expect(screen.getByLabelText('Custom link')).toBeInTheDocument();
      expect(props.onConfigChange).not.toHaveBeenCalled();
    });

    test('shows a saved custom link in the custom field', () => {
      const template = 'https://plex.example.com/search?id={youtubeId}';
      setupSection({ config: createConfig({ downloadsFeedLinkTemplate: template }) });

      expect(screen.getByLabelText('Clicking an item opens')).toHaveTextContent('A custom link');
      expect(screen.getByLabelText('Custom link')).toHaveValue(template);
    });

    test('saves a typed custom link', () => {
      const props = setupSection({ config: createConfig({ downloadsFeedLinkTemplate: 'https://a.example.com/{youtubeId}' }) });

      fireEvent.change(screen.getByLabelText('Custom link'), { target: { value: 'https://b.example.com/{youtubeId}' } });

      expect(props.onConfigChange).toHaveBeenCalledWith({ downloadsFeedLinkTemplate: 'https://b.example.com/{youtubeId}' });
    });

    test('shows why a custom link is invalid', () => {
      setupSection({ config: createConfig({ downloadsFeedLinkTemplate: 'plex.example.com/{youtubeId}' }) });

      expect(screen.getByText(/must be a full URL/i)).toBeInTheDocument();
    });
  });
});
