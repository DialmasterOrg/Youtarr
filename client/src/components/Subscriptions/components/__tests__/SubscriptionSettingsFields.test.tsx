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

  test('disables every field when read-only', () => {
    renderFields({ disabled: true });

    expect(screen.getByLabelText('Video Quality')).toBeDisabled();
  });
});
