import { MemoryRouter } from 'react-router-dom';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import React, { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import type { LibraryFoldersResponse } from '../../../../types/tvShows';
import type { LibraryCheckResponse } from '../../../../types/libraryCheck';
import type { MediaServerStatus } from '../../../../types/playlist';
import { CoreSettingsSection } from '../CoreSettingsSection';

const LIBRARY_FOLDERS: LibraryFoldersResponse = {
  folders: [
    {
      name: '', layout: 'videos', isDefault: true, hasFiles: true, channels: 2,
      channelsChosen: 0, channelsFollowing: 2, playlists: 1, titleShows: 0,
      layoutChangeNeedsReview: true, makeDefaultNeedsReview: false,
    },
    {
      name: 'Movies', layout: 'videos', isDefault: false, hasFiles: true, channels: 1,
      channelsChosen: 1, playlists: 0, titleShows: 0, layoutChangeNeedsReview: true, makeDefaultNeedsReview: false,
    },
    {
      name: 'Shows', layout: 'tv', isDefault: false, hasFiles: false, channels: 1,
      channelsChosen: 1, playlists: 0, titleShows: 0, layoutChangeNeedsReview: false, makeDefaultNeedsReview: true,
    },
  ],
};

const plexLibrary = (id: string, name: string, type: 'videos' | 'tv', location: string) => (
  { id, name, type, location, relation: 'exact' as const }
);

const LIBRARY_CHECK: LibraryCheckResponse = {
  servers: [{ serverType: 'plex', name: 'Plex', reachable: true, error: null, downloadsPath: '/data/youtube' }],
  folders: [
    {
      name: '', layout: 'videos', hasFiles: true, channels: 2,
      servers: [{ serverType: 'plex', status: 'ok', libraries: [plexLibrary('3', 'YouTube', 'videos', '/data/youtube')], issues: [] }],
    },
    {
      name: 'Movies', layout: 'videos', hasFiles: true, channels: 1,
      servers: [{ serverType: 'plex', status: 'ok', libraries: [plexLibrary('3', 'YouTube', 'videos', '/data/youtube')], issues: [] }],
    },
    {
      name: 'Shows', layout: 'tv', hasFiles: false, channels: 1,
      servers: [{
        serverType: 'plex', status: 'missing', libraries: [], issues: [],
        plexMapping: { mappedLibraryId: null, suggestedLibraryId: null },
      }],
    },
  ],
};

const MEDIA_SERVERS: MediaServerStatus = { plex: true, jellyfin: false, emby: false };

const meta: Meta<typeof CoreSettingsSection> = {
  title: 'Components/Configuration/Sections/CoreSettingsSection',
  component: CoreSettingsSection,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/library-folders', () => HttpResponse.json(LIBRARY_FOLDERS)),
        http.get('/api/library-folders/check', () => HttpResponse.json(LIBRARY_CHECK)),
        http.get('/api/mediaservers/status', () => HttpResponse.json(MEDIA_SERVERS)),
      ],
    },
  },
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      youtubeOutputDirectory: '/data/youtube',
      channelAutoDownload: false,
      channelDownloadFrequency: '0 0 * * *',
      channelFilesToDownload: 3,
      preferredResolution: '1080',
      videoCodec: 'default',
    });
    return (
      <CoreSettingsSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
  args: {
    token: 'storybook-token',
    deploymentEnvironment: { platform: null, isWsl: false },
    isPlatformManaged: { plexUrl: false, authEnabled: true, useTmpForDownloads: false, ytdlpUpdates: false },
    onMobileTooltipClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof CoreSettingsSection>;

export const ToggleAutoDownloads: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = await canvas.findByRole('checkbox', { name: 'Automatic downloads' });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();

    await expect(canvas.getByRole('link', { name: 'Edit schedule' })).toHaveAttribute(
      'href', '/settings/scheduling#channelDownloadFrequency'
    );
  },
};

export const ThemeSwitcher: Story = {};
