import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NewPlaylistSettings, { NewPlaylistSettingsValues } from '../NewPlaylistSettings';
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

const values: NewPlaylistSettingsValues = {
  auto_download: false,
  video_quality: null,
  audio_format: null,
  sub_folder: '##USE_GLOBAL_DEFAULT##',
};

const renderSettings = (overrides: Partial<React.ComponentProps<typeof NewPlaylistSettings>> = {}) => {
  const onChange = jest.fn();
  renderWithProviders(<NewPlaylistSettings token="t" values={values} onChange={onChange} {...overrides} />);
  return { onChange };
};

describe('NewPlaylistSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useConfig.mockReturnValue({
      config: { preferredResolution: '1080', defaultSubfolder: null, channelAutoDownload: true },
      loading: false,
    });
  });

  test('turns automatic downloads on', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSettings();

    await user.click(screen.getByLabelText('Automatically download new videos'));

    expect(onChange).toHaveBeenCalledWith({ auto_download: true });
  });

  test('explains that only videos added from now on download automatically', () => {
    renderSettings({ values: { ...values, auto_download: true } });

    expect(screen.getByText(/Only videos added to the playlist from now on/)).toBeInTheDocument();
  });

  test('warns when automatic downloads are turned off globally', () => {
    useConfig.mockReturnValue({
      config: { preferredResolution: '1080', defaultSubfolder: null, channelAutoDownload: false },
      loading: false,
    });

    renderSettings({ values: { ...values, auto_download: true } });

    expect(screen.getByText(/Automatic downloads are turned off/)).toBeInTheDocument();
  });

  test('mentions music playlists for MP3 Only downloads', () => {
    renderSettings({ values: { ...values, audio_format: 'mp3_only' } });

    expect(screen.getByText(/sync to media servers as music playlists/)).toBeInTheDocument();
  });

  test('shows saved settings without letting them change when read-only', () => {
    renderSettings({ readOnly: true });

    expect(screen.getByLabelText('Automatically download new videos')).toBeDisabled();
    expect(screen.getByLabelText('Video Quality')).toBeDisabled();
  });
});
