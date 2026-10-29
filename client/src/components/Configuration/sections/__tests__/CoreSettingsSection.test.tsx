import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CoreSettingsSection } from '../CoreSettingsSection';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import type { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../../types';

jest.mock('axios', () => ({ get: jest.fn() }));
const axios = require('axios');
jest.mock('../components/LibraryFoldersCard', () => ({ LibraryFoldersCard: () => {
  const React = require('react');
  return React.createElement('section', { 'aria-label': 'Library folders card' });
} }));
jest.mock('../../hooks/useFilenamePreview', () => ({
  useFilenamePreview: () => ({ run: jest.fn(), loading: false, error: null, data: null, isStale: () => false }),
}));

function renderCore({ config = {}, onConfigChange = jest.fn(), isPlatformManaged = {}, deploymentEnvironment = {}, route = '/settings/core' }: {
  config?: Partial<ConfigState>; onConfigChange?: jest.Mock; isPlatformManaged?: Partial<PlatformManagedState>;
  deploymentEnvironment?: Partial<DeploymentEnvironment>; route?: string;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <CoreSettingsSection
        config={{ ...DEFAULT_CONFIG, ...config }}
        onConfigChange={onConfigChange}
        isPlatformManaged={{ plexUrl: false, authEnabled: true, useTmpForDownloads: false, ytdlpUpdates: false, ...isPlatformManaged }}
        deploymentEnvironment={{ isWsl: false, ...deploymentEnvironment }}
        token="token"
      />
    </MemoryRouter>
  );
}

const mockFlatCount = (data: { count: number; channelNames: string[] }) => axios.get.mockResolvedValue({ data });

describe('CoreSettingsSection', () => {
  test('renders the sections in order with their anchors', () => {
    renderCore();
    expect(screen.getAllByRole('region').map((region) => region.id).filter(Boolean)).toEqual(
      ['downloads', 'media-server-files', 'naming', 'interface', 'advanced']
    );
  });

  test('no longer edits the default folder or lists library folders', () => {
    renderCore();
    expect(screen.queryByLabelText(/Default Subfolder/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Manage Subfolders/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Jellyfin / Kodi / Emby Setting Information')).not.toBeInTheDocument();
  });

  test('the flat structure switch only changes after confirming, and names TV folders', async () => {
    mockFlatCount({ count: 2, channelNames: ['A', 'B'] });
    const onConfigChange = jest.fn();
    renderCore({ onConfigChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Flat file structure by default' }));
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(await screen.findByText("Channels in TV shows folders aren't affected: their episodes always go straight into Season folders.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfigChange).toHaveBeenCalledWith({ defaultSkipVideoFolder: true });
  });

  test('cancelling the flat structure confirm leaves the setting alone', async () => {
    mockFlatCount({ count: 0, channelNames: [] });
    const onConfigChange = jest.fn();
    renderCore({ onConfigChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Flat file structure by default' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onConfigChange).not.toHaveBeenCalled();
  });

  test('turning the flat structure off sends false after confirming', async () => {
    mockFlatCount({ count: 0, channelNames: [] });
    const onConfigChange = jest.fn();
    renderCore({ config: { defaultSkipVideoFolder: true }, onConfigChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Flat file structure by default' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfigChange).toHaveBeenCalledWith({ defaultSkipVideoFolder: false });
  });

  test('a media server file switch writes its own config key', async () => {
    const onConfigChange = jest.fn();
    renderCore({ config: { writeVideoNfoFiles: false }, onConfigChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Video .nfo files' }));
    expect(onConfigChange).toHaveBeenCalledWith({ writeVideoNfoFiles: true });
  });

  test('4K shows the VP9/AV1 resolution warning', () => {
    renderCore({ config: { preferredResolution: '2160' } });
    expect(screen.getByText(/1440p and 4K come as VP9 or AV1/)).toBeInTheDocument();
  });

  test('1080p shows no resolution warning', () => {
    renderCore({ config: { preferredResolution: '1080' } });
    expect(screen.queryByText(/1440p and 4K come as VP9 or AV1/)).not.toBeInTheDocument();
  });

  test('the codec info note is always shown', () => {
    renderCore();
    expect(screen.getByText(/H\.264 direct-plays on the most devices/)).toBeInTheDocument();
  });

  test('selects are described by their row description', () => {
    renderCore();
    expect(screen.getByRole('button', { name: 'Preferred resolution' }))
      .toHaveAccessibleDescription('Youtarr takes the closest resolution YouTube has.');
  });

  test('the videos per channel tab select stores a number', async () => {
    const onConfigChange = jest.fn();
    renderCore({ config: { channelFilesToDownload: 3 }, onConfigChange });
    await userEvent.click(screen.getByRole('button', { name: 'Videos per channel tab and playlist' }));
    await userEvent.click(await screen.findByRole('option', { name: '7 videos' }));
    expect(onConfigChange).toHaveBeenCalledWith({ channelFilesToDownload: 7 });
  });

  test('subtitle languages nest under the switch', () => {
    renderCore({ config: { subtitlesEnabled: true } });
    expect(screen.getByText('Videos without subtitles in these languages still download.')).toBeInTheDocument();
  });

  test('the temp directory switch is disabled and badged when platform managed', () => {
    renderCore({ isPlatformManaged: { useTmpForDownloads: true }, deploymentEnvironment: { platform: 'elfhosted' } });
    expect(screen.getByRole('checkbox', { name: 'External temp directory' })).toBeDisabled();
    expect(screen.getByText('Managed by Elfhosted')).toBeInTheDocument();
  });

  test('scrolls to the section named in the URL hash', () => {
    // jest.setup.ts stubs scrollIntoView on HTMLElement.prototype, which shadows Element.prototype
    const scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
    try {
      renderCore({ route: '/settings/core#naming' });
      expect(scrollIntoView.mock.instances[0]).toBe(screen.getByRole('region', { name: 'Naming' }));
    } finally {
      scrollIntoView.mockRestore();
    }
  });
});
