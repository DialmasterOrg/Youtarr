import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AddChannelSettingsDialog from '../AddChannelSettingsDialog';
import { PendingChannel } from '../../newChannelSettings';
import { renderWithProviders } from '../../../../test-utils';

jest.mock('../../../../hooks/useConfig', () => ({
  useConfig: jest.fn(),
}));
jest.mock('../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({
    subfolders: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    createSubfolder: jest.fn(),
    deleteSubfolder: jest.fn(),
  }),
}));

const { useConfig } = require('../../../../hooks/useConfig');

const channel: PendingChannel = {
  url: 'https://www.youtube.com/@example',
  uploader: 'Example Channel',
  channel_id: 'UC123',
  available_tabs: 'videos,shorts',
  auto_download_enabled_tabs: 'video',
  video_quality: null,
  audio_format: null,
  sub_folder: '##USE_GLOBAL_DEFAULT##',
  restored: false,
};

const renderDialog = (overrides: Partial<React.ComponentProps<typeof AddChannelSettingsDialog>> = {}) => {
  const props = {
    open: true,
    channel,
    mode: 'add' as const,
    token: 't',
    onConfirm: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  renderWithProviders(<AddChannelSettingsDialog {...props} />);
  return props;
};

describe('AddChannelSettingsDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConfig.mockReturnValue({
      config: { preferredResolution: '1080', defaultSubfolder: null, channelAutoDownload: true },
      loading: false,
    });
  });

  test('shows the channel being added', () => {
    renderDialog();

    expect(screen.getByText('Example Channel')).toBeInTheDocument();
  });

  test('continues with the default settings unchanged', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onConfirm).toHaveBeenCalledWith({
      auto_download_enabled_tabs: 'video',
      video_quality: null,
      audio_format: null,
      sub_folder: '##USE_GLOBAL_DEFAULT##',
    });
  });

  test('shows an auto-download switch for each detected tab', () => {
    renderDialog();

    expect(screen.getByLabelText('New Videos')).toBeChecked();
    expect(screen.getByLabelText('New Shorts')).not.toBeChecked();
    expect(screen.queryByLabelText('New Live/Streams')).not.toBeInTheDocument();
  });

  test('includes a tab the user turns on', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();

    await user.click(screen.getByLabelText('New Shorts'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ auto_download_enabled_tabs: 'video,short' }));
  });

  test('explains the default when no tabs were detected', () => {
    renderDialog({ channel: { ...channel, available_tabs: null } });

    expect(screen.queryByLabelText('New Videos')).not.toBeInTheDocument();
    expect(screen.getByText(/couldn't detect this channel's tabs/)).toBeInTheDocument();
  });

  test('notes that a previously subscribed channel keeps its saved settings', () => {
    renderDialog({ channel: { ...channel, restored: true } });

    expect(screen.getByText(/Previously subscribed/)).toBeInTheDocument();
  });

  test('warns when automatic downloads are turned off globally', () => {
    useConfig.mockReturnValue({
      config: { preferredResolution: '1080', defaultSubfolder: null, channelAutoDownload: false },
      loading: false,
    });

    renderDialog();

    expect(screen.getByText(/Automatic downloads are turned off/)).toBeInTheDocument();
  });

  test('does not warn about automatic downloads while settings load', () => {
    useConfig.mockReturnValue({
      config: { preferredResolution: '1080', defaultSubfolder: null, channelAutoDownload: false },
      loading: true,
    });

    renderDialog();

    expect(screen.queryByText(/Automatic downloads are turned off/)).not.toBeInTheDocument();
  });

  test('cancel closes without adding the channel', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('edit mode saves changes to the pending channel', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ mode: 'edit' });

    expect(screen.getByText('Edit pending channel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onConfirm).toHaveBeenCalled();
  });
});
