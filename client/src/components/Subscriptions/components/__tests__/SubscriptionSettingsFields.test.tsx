import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SubscriptionSettingsFields, { SubscriptionSettingsValues } from '../SubscriptionSettingsFields';
import { renderWithProviders } from '../../../../test-utils';

jest.mock('../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({
    subfolders: ['__Kids'],
    loading: false,
    error: null,
    refetch: jest.fn(),
    createSubfolder: jest.fn(),
    deleteSubfolder: jest.fn(),
  }),
}));

// Library folders named here have the TV layout ('' = main folder).
let mockTvFolders: string[] = [];
jest.mock('../../../../hooks/useLibraryFolders', () => ({
  useLibraryFolders: () => ({
    folders: [],
    loading: false,
    error: null,
    layoutOf: (name: string) => (mockTvFolders.includes(name) ? 'tv' : 'videos'),
  }),
}));

const values: SubscriptionSettingsValues = {
  video_quality: null,
  audio_format: null,
  sub_folder: '##USE_GLOBAL_DEFAULT##',
};

const renderFields = (overrides: Partial<React.ComponentProps<typeof SubscriptionSettingsFields>> = {}) => {
  const onChange = jest.fn();
  renderWithProviders(
    <SubscriptionSettingsFields
      token="t"
      values={values}
      onChange={onChange}
      globalQuality="1080"
      defaultSubfolder={null}
      subfolderLabel="Subfolder"
      subfolderHelperText="Where videos are saved"
      {...overrides}
    />
  );
  return { onChange };
};

describe('SubscriptionSettingsFields', () => {
  beforeEach(() => {
    mockTvFolders = [];
  });

  test('shows the global quality in the default option', async () => {
    renderFields();

    fireEvent.mouseDown(screen.getByLabelText('Video Quality'));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Using Global Setting (1080p)' })).toBeInTheDocument();
    });
  });

  test('reports a quality change', async () => {
    const { onChange } = renderFields();

    fireEvent.mouseDown(screen.getByLabelText('Video Quality'));
    fireEvent.click(await screen.findByRole('option', { name: '720p (HD)' }));

    expect(onChange).toHaveBeenCalledWith({ video_quality: '720' });
  });

  test('reports a download type change', async () => {
    const { onChange } = renderFields();

    fireEvent.mouseDown(screen.getByLabelText('Download Type'));
    fireEvent.click(await screen.findByRole('option', { name: 'MP3 Only' }));

    expect(onChange).toHaveBeenCalledWith({ audio_format: 'mp3_only' });
  });

  test('explains MP3 output when an MP3 download type is chosen', () => {
    renderFields({ values: { ...values, audio_format: 'video_mp3' } });

    expect(screen.getByText(/MP3 files are saved at 192kbps/)).toBeInTheDocument();
  });

  describe('TV folders', () => {
    const tvValues = { ...values, sub_folder: 'Kids' };
    const tvShowCaption = 'Saved as a TV show (season folders and episode NFO files).';

    beforeEach(() => {
      mockTvFolders = ['Kids'];
    });

    test('hides the MP3 download types for a TV folder', async () => {
      renderFields({ values: tvValues });

      fireEvent.mouseDown(screen.getByLabelText('Download Type'));

      expect(await screen.findByRole('option', { name: 'Video Only (default)' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'MP3 Only' })).not.toBeInTheDocument();
    });

    test('explains that TV folders are video-only', () => {
      renderFields({ values: tvValues });

      expect(screen.getByText('TV folders are video-only.')).toBeInTheDocument();
    });

    test('resolves the global default folder through the default subfolder', () => {
      renderFields({ defaultSubfolder: 'Kids' });

      expect(screen.getByText('TV folders are video-only.')).toBeInTheDocument();
    });

    test('labels TV folders in the folder picker', () => {
      renderFields({ values: tvValues });

      expect(screen.getByLabelText('Subfolder')).toHaveValue('__Kids (TV)');
    });

    test('notes that a channel in a TV folder is saved as a TV show', () => {
      renderFields({ values: tvValues, showTvShowCaption: true });

      expect(screen.getByText(tvShowCaption)).toBeInTheDocument();
    });

    test('omits the TV show note when not requested', () => {
      renderFields({ values: tvValues });

      expect(screen.queryByText(tvShowCaption)).not.toBeInTheDocument();
    });

    test('omits the TV show note for a Videos folder', () => {
      mockTvFolders = [];
      renderFields({ values: tvValues, showTvShowCaption: true });

      expect(screen.queryByText(tvShowCaption)).not.toBeInTheDocument();
    });
  });

  test('disables every field when read-only', () => {
    renderFields({ disabled: true });

    expect(screen.getByLabelText('Video Quality')).toBeDisabled();
  });
});
