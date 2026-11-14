import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SubscriptionAddBar from '../SubscriptionAddBar';
import { renderWithProviders } from '../../../../test-utils';

const baseProps = {
  url: '',
  onUrlChange: jest.fn(),
  onAddChannel: jest.fn(),
  onAddPlaylist: jest.fn(),
  onImport: jest.fn(),
  isAddingChannel: false,
};

describe('SubscriptionAddBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('channels mode', () => {
    test('shows the channel input, Channel button, and Import button', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="x" />);

      expect(screen.getByPlaceholderText('Paste a channel URL or @handle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^channel$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^playlist$/i })).not.toBeInTheDocument();
    });

    test('calls onAddChannel when the Channel button is clicked', async () => {
      const user = userEvent.setup();
      const onAddChannel = jest.fn();
      renderWithProviders(
        <SubscriptionAddBar {...baseProps} mode="channels" url="https://youtube.com/@x" onAddChannel={onAddChannel} />
      );

      await user.click(screen.getByRole('button', { name: /^channel$/i }));
      expect(onAddChannel).toHaveBeenCalledTimes(1);
    });

    test('calls onImport when the Import button is clicked', async () => {
      const user = userEvent.setup();
      const onImport = jest.fn();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="x" onImport={onImport} />);

      await user.click(screen.getByRole('button', { name: /import/i }));
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    test('disables the Channel button when the input is empty', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="" />);
      expect(screen.getByRole('button', { name: /^channel$/i })).toBeDisabled();
    });

    test('shows a loading label and disables the button while looking up', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="x" isAddingChannel />);
      expect(screen.getByRole('button', { name: /looking up/i })).toBeDisabled();
    });

    test('explains the lookup while it runs', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="x" isAddingChannel />);
      expect(screen.getByRole('status')).toHaveTextContent(
        'Looking up channel on YouTube... this can take a few seconds.'
      );
    });

    test('shows no lookup status when idle', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="x" />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    test('labels the input as both search and add', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" />);
      expect(screen.getByLabelText('Search or add a channel')).toBeInTheDocument();
    });

    test('turns off browser spellcheck, since channel names are not dictionary words', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" />);
      expect(screen.getByLabelText('Search or add a channel')).toHaveAttribute('spellcheck', 'false');
    });

    test('submits an @handle on Enter', async () => {
      const user = userEvent.setup();
      const onAddChannel = jest.fn();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="@x" onAddChannel={onAddChannel} />);

      await user.type(screen.getByLabelText('Search or add a channel'), '{Enter}');
      expect(onAddChannel).toHaveBeenCalledTimes(1);
    });

    test('submits a channel URL on Enter', async () => {
      const user = userEvent.setup();
      const onAddChannel = jest.fn();
      renderWithProviders(
        <SubscriptionAddBar {...baseProps} mode="channels" url="https://youtube.com/@x" onAddChannel={onAddChannel} />
      );

      await user.type(screen.getByLabelText('Search or add a channel'), '{Enter}');
      expect(onAddChannel).toHaveBeenCalledTimes(1);
    });

    test('does not submit a bare word on Enter, since it may be a search', async () => {
      const user = userEvent.setup();
      const onAddChannel = jest.fn();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="linus" onAddChannel={onAddChannel} />);

      await user.type(screen.getByLabelText('Search or add a channel'), '{Enter}');
      expect(onAddChannel).not.toHaveBeenCalled();
    });

    test('adds a bare word as a handle when the Channel button is clicked', async () => {
      const user = userEvent.setup();
      const onAddChannel = jest.fn();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="linus" onAddChannel={onAddChannel} />);

      await user.click(screen.getByRole('button', { name: /^channel$/i }));
      expect(onAddChannel).toHaveBeenCalledTimes(1);
    });

    test('disables the Channel button for text that cannot be a channel', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="linus tech" />);
      expect(screen.getByRole('button', { name: /^channel$/i })).toBeDisabled();
    });
  });

  describe('playlists mode', () => {
    test('shows the playlist input and Playlist button, and hides Import', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="playlists" url="x" />);

      expect(screen.getByPlaceholderText('Paste a playlist URL')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^playlist$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /import/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^channel$/i })).not.toBeInTheDocument();
    });

    test('calls onAddPlaylist when the Playlist button is clicked', async () => {
      const user = userEvent.setup();
      const onAddPlaylist = jest.fn();
      renderWithProviders(
        <SubscriptionAddBar
          {...baseProps}
          mode="playlists"
          url="https://youtube.com/playlist?list=PL"
          onAddPlaylist={onAddPlaylist}
        />
      );

      await user.click(screen.getByRole('button', { name: /^playlist$/i }));
      expect(onAddPlaylist).toHaveBeenCalledTimes(1);
    });

    test('disables the Playlist button when the input is empty', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="playlists" url="" />);
      expect(screen.getByRole('button', { name: /^playlist$/i })).toBeDisabled();
    });

    test('submits a playlist on Enter', async () => {
      const user = userEvent.setup();
      const onAddPlaylist = jest.fn();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="playlists" url="x" onAddPlaylist={onAddPlaylist} />);

      await user.type(screen.getByPlaceholderText('Paste a playlist URL'), '{Enter}');
      expect(onAddPlaylist).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear button', () => {
    test('empties the input when clicked', async () => {
      const user = userEvent.setup();
      const onUrlChange = jest.fn();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="linus" onUrlChange={onUrlChange} />);

      await user.click(screen.getByRole('button', { name: 'Clear' }));
      expect(onUrlChange).toHaveBeenCalledWith('');
    });

    test('returns focus to the input so typing can continue', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="linus" />);

      await user.click(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.getByLabelText('Search or add a channel')).toHaveFocus();
    });

    test('is hidden while the input is empty', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="" />);
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    test('is hidden while a channel lookup runs', () => {
      renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" url="@x" isAddingChannel />);
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });
  });

  test('calls onUrlChange as the user types', async () => {
    const user = userEvent.setup();
    const onUrlChange = jest.fn();
    renderWithProviders(<SubscriptionAddBar {...baseProps} mode="channels" onUrlChange={onUrlChange} />);

    await user.type(screen.getByPlaceholderText('Paste a channel URL or @handle'), 'a');
    expect(onUrlChange).toHaveBeenCalled();
  });
});
