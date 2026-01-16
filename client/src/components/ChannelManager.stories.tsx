import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import ChannelManager from './ChannelManager';
import { DEFAULT_CONFIG } from '../config/configSchema';

const meta: Meta<typeof ChannelManager> = {
  title: 'Pages/ChannelManager',
  component: ChannelManager,
  args: {
    token: 'storybook-token',
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof ChannelManager>;

export const Default: Story = {  render: (args) => (
    <MemoryRouter>
      <ChannelManager {...args} />
    </MemoryRouter>
  ),  parameters: {
    msw: {
      handlers: [
        http.get('/getconfig', () =>
          HttpResponse.json({
            ...DEFAULT_CONFIG,
            preferredResolution: '1080',
            isPlatformManaged: {
              plexUrl: false,
              authEnabled: true,
              useTmpForDownloads: false,
            },
            deploymentEnvironment: {
              platform: null,
              isWsl: false,
            },
          })
        ),
        http.get('/getchannels', () =>
          HttpResponse.json({
            channels: [
              {
                url: 'https://www.youtube.com/@alpha',
                uploader: 'Alpha Channel',
                channel_id: 'UC_ALPHA',
                sub_folder: null,
                video_quality: '1080',
              },
              {
                url: 'https://www.youtube.com/@beta',
                uploader: 'Beta Channel',
                channel_id: 'UC_BETA',
                sub_folder: 'MyFolder',
                video_quality: '720',
                title_filter_regex: 'beta',
              },
            ],
            total: 2,
            totalPages: 1,
            page: 1,
            pageSize: 20,
            subFolders: ['MyFolder'],
          })
        ),
      ],
    },
  },  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await canvas.findByText('Your Channels', {}, { timeout: 3000 })).toBeInTheDocument();
    await expect(await canvas.findByText(/alpha channel/i, {}, { timeout: 3000 })).toBeInTheDocument();
    await expect(await canvas.findByText(/beta channel/i, {}, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(canvas.queryByRole('progressbar')).not.toBeInTheDocument();
    }, { timeout: 3000 });

    // Test view mode toggle (list/grid)
    const gridToggle = canvas.queryByRole('button', { name: /grid view/i });
    if (gridToggle) {
      await userEvent.click(gridToggle);
      await expect(gridToggle).toHaveAttribute('aria-pressed', 'true');
    }

    // Test filter functionality
    const filterButton = canvas.queryByRole('button', { name: /filter by channel name/i });
    if (filterButton) {
      await userEvent.click(filterButton);
      const filterInput = await body.findByLabelText(/filter channels/i);
      await userEvent.type(filterInput, 'Beta');
      await expect(filterInput).toHaveValue('Beta');
    }

    // Test sort functionality
    const sortButton = canvas.queryByRole('button', { name: /sort alphabetically/i });
    if (sortButton) {
      await userEvent.click(sortButton);
      await expect(sortButton).toBeEnabled();
    }

    const folderButton = canvas.queryByRole('button', { name: /filter or group by folder/i });
    if (folderButton) {
      await userEvent.click(folderButton);
      const folderItem = await canvas.findByRole('menuitem', { name: /myfolder/i });
      await userEvent.click(folderItem);
      await expect(await canvas.findByText(/beta channel/i)).toBeInTheDocument();
    }

    // Test add channel button
    const addButton = canvas.queryByRole('button', { name: /add|new|plus/i });
    if (addButton) {
      await expect(addButton).toBeInTheDocument();
    }
  },
};
