import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../../test-utils';
import { DEFAULT_CONFIG } from '../../../../../config/configSchema';
import type { ConfigState, DeploymentEnvironment } from '../../../types';
import { CoreFoldersSection } from '../CoreFoldersSection';

jest.mock('axios', () => ({ get: jest.fn() }));
const axios = require('axios');

const mockCreateSubfolder = jest.fn(() => Promise.resolve());
jest.mock('../../../../../hooks/useSubfolders', () => ({
  useSubfolders: () => ({
    subfolders: ['__Sports', '__Music'],
    loading: false,
    error: null,
    refetch: jest.fn(),
    createSubfolder: mockCreateSubfolder,
    deleteSubfolder: jest.fn(() => Promise.resolve()),
  }),
}));

// Stands in for the Radix select: one button that picks "NewFolder"
jest.mock('../../../../shared/SubfolderAutocomplete', () => ({
  SubfolderAutocomplete: function MockSubfolderAutocomplete(props: { onChange: (value: string | null) => void }) {
    const React = require('react');
    return React.createElement('button', { type: 'button', onClick: () => props.onChange('NewFolder') }, 'Pick NewFolder');
  },
}));

function renderSection({ config = {}, deploymentEnvironment = {}, onConfigChange = jest.fn() }: {
  config?: Partial<ConfigState>; deploymentEnvironment?: Partial<DeploymentEnvironment>; onConfigChange?: jest.Mock;
} = {}) {
  return renderWithProviders(
    <CoreFoldersSection
      config={{ ...DEFAULT_CONFIG, youtubeOutputDirectory: '/data/youtube', ...config }}
      deploymentEnvironment={{ platform: null, isWsl: false, ...deploymentEnvironment }}
      onConfigChange={onConfigChange}
      token="token"
    />
  );
}

async function addSubfolderFromPage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add Subfolder' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(within(dialog).getByLabelText('Subfolder Name'), 'NewFolder');
  await user.click(within(dialog).getByRole('button', { name: 'Add Subfolder' }));
}

describe('CoreFoldersSection', () => {
  beforeEach(() => {
    // resetMocks wipes the implementations before each test
    mockCreateSubfolder.mockResolvedValue(undefined);
    axios.get.mockResolvedValue({ data: { count: 0, channelNames: [] } });
  });

  test('shows the downloads folder as a read-only path', () => {
    renderSection({ config: { youtubeOutputDirectory: '/custom/path' } });
    const input = screen.getByLabelText('Downloads folder');
    expect(input).toHaveValue('/custom/path');
    expect(input).toBeDisabled();
  });

  test('says the downloads folder is shown from YOUTUBE_OUTPUT_DIR but set by the volume mapping', () => {
    renderSection();
    expect(screen.getByLabelText('Downloads folder')).toHaveAccessibleDescription(
      'Shown from YOUTUBE_OUTPUT_DIR. The volume mapping for the downloads folder decides which folder Youtarr '
      + 'really uses: to move the library, change both and restart.'
    );
  });

  test('says the platform sets the downloads folder on Elfhosted, whatever the case', () => {
    renderSection({ deploymentEnvironment: { platform: 'ELFHOSTED' } });
    expect(screen.getByLabelText('Downloads folder'))
      .toHaveAccessibleDescription('This path is configured by your platform deployment and cannot be changed here.');
  });

  test('offers Add Subfolder and Manage Subfolders', () => {
    renderSection();
    expect(screen.getByRole('button', { name: 'Add Subfolder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Subfolders' })).toBeInTheDocument();
  });

  test('changes the default subfolder only after confirming', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderSection({ onConfigChange });
    await user.click(screen.getByRole('button', { name: 'Pick NewFolder' }));
    expect(await screen.findByText('Set Default Subfolder?')).toBeInTheDocument();
    expect(onConfigChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Set as Default' }));
    expect(onConfigChange).toHaveBeenCalledWith({ defaultSubfolder: 'NewFolder' });
  });

  test('cancelling leaves the default subfolder alone and closes the dialog', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderSection({ onConfigChange });
    await user.click(screen.getByRole('button', { name: 'Pick NewFolder' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onConfigChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Set Default Subfolder?')).not.toBeInTheDocument());
  });

  test('picking the current default asks nothing', async () => {
    const user = userEvent.setup();
    renderSection({ config: { defaultSubfolder: 'NewFolder' } });
    await user.click(screen.getByRole('button', { name: 'Pick NewFolder' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('saves a subfolder added from the page', async () => {
    const user = userEvent.setup();
    renderSection();
    await addSubfolderFromPage(user);
    await waitFor(() => expect(mockCreateSubfolder).toHaveBeenCalledWith('NewFolder'));
  });

  test('offers to make an added subfolder the default', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderSection({ onConfigChange });
    await addSubfolderFromPage(user);
    expect(await screen.findByText('Set New Subfolder as Default?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set as Default' }));
    expect(onConfigChange).toHaveBeenCalledWith({ defaultSubfolder: 'NewFolder' });
  });

  test('declining the default keeps the added subfolder without changing config', async () => {
    const user = userEvent.setup();
    const onConfigChange = jest.fn();
    renderSection({ onConfigChange });
    await addSubfolderFromPage(user);
    await user.click(await screen.findByRole('button', { name: "Don't Set as Default" }));
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(mockCreateSubfolder).toHaveBeenCalledWith('NewFolder');
  });
});
