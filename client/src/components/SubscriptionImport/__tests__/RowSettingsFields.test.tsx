import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RowSettingsFields from '../components/RowSettingsFields';
import { DEFAULT_ROW_SETTINGS } from '../../../types/subscriptionImport';

const showFields = (dispatch: jest.Mock = jest.fn()) => {
  render(
    <RowSettingsFields
      channelId="ch1"
      rowState={{ selected: true, settings: { ...DEFAULT_ROW_SETTINGS } }}
      dispatch={dispatch}
      subfolders={[]}
      createSubfolder={jest.fn(() => Promise.resolve())}
      defaultSubfolderDisplay={null}
    />
  );
};

describe('RowSettingsFields', () => {
  test('shows the four settings controls', () => {
    showFields();

    expect(screen.getByLabelText('Auto-download enabled')).toBeInTheDocument();
    expect(screen.getByLabelText('Video Quality')).toBeInTheDocument();
    expect(screen.getByLabelText('Subfolder')).toBeInTheDocument();
    expect(screen.getByLabelText('Content Rating')).toBeInTheDocument();
  });

  test('updates the row it belongs to when a setting changes', () => {
    const dispatch = jest.fn();
    showFields(dispatch);

    fireEvent.click(screen.getByLabelText('Auto-download enabled'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_ROW_SETTINGS',
      payload: { channelId: 'ch1', settings: { autoDownloadEnabled: !DEFAULT_ROW_SETTINGS.autoDownloadEnabled } },
    });
  });
});
