import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CoreSettingsSection } from '../CoreSettingsSection';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { PLEX_TV_SERIES_PRESET_PREFIX } from '../../../../utils/filenameTemplate/presets';
import type { ConfigState, DeploymentEnvironment, PlatformManagedState } from '../../types';

jest.mock('axios', () => ({ get: jest.fn() }));
const axios = require('axios');
jest.mock('../components/CoreFoldersSection', () => ({ CoreFoldersSection: () => {
  const React = require('react');
  return React.createElement('section', { id: 'folders', 'aria-label': 'Folders' });
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
      ['folders', 'downloads', 'media-server-files', 'naming', 'interface', 'advanced']
    );
  });

  test('the flat structure switch only changes after confirming', async () => {
    mockFlatCount({ count: 2, channelNames: ['A', 'B'] });
    const onConfigChange = jest.fn();
    renderCore({ onConfigChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Flat file structure by default' }));
    expect(onConfigChange).not.toHaveBeenCalled();
    expect(await screen.findByText('2 tracked channels follow the global setting and will be affected.')).toBeInTheDocument();
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

  test('explains the Jellyfin, Kodi and Emby library setup', () => {
    renderCore();
    expect(screen.getByText(/do not enable the Nfo saver/)).toBeInTheDocument();
  });

  test('turning off the channel name in the embedded title writes its config key', async () => {
    const onConfigChange = jest.fn();
    renderCore({ config: { prefixChannelNameInTitle: true }, onConfigChange });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Channel name in embedded title' }));
    expect(onConfigChange).toHaveBeenCalledWith({ prefixChannelNameInTitle: false });
  });

  test('the Plex TV Series template suggests turning off the channel name prefix while it is on', () => {
    renderCore({ config: { videoFilenamePrefix: PLEX_TV_SERIES_PRESET_PREFIX, prefixChannelNameInTitle: true } });
    expect(screen.getByTestId('tv-series-channel-prefix-tip')).toBeInTheDocument();
  });

  test('the automatic downloads row links to its schedule', () => {
    renderCore({ config: { channelAutoDownload: false } });
    expect(screen.getByRole('link', { name: 'Edit schedule' })).toHaveAttribute('href', '/settings/scheduling#channelDownloadFrequency');
    expect(screen.getByText('The schedule is idle until you turn this on.')).toBeInTheDocument();
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

  test('subtitle languages are hidden while subtitles are off', () => {
    renderCore({ config: { subtitlesEnabled: false } });
    expect(screen.queryByText('Videos without subtitles in these languages still download.')).not.toBeInTheDocument();
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
