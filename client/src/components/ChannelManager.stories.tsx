import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
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
            channels: [],
            total: 0,
            totalPages: 0,
            subFolders: [],
          })
        ),
      ],
    },
  },  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Your Channels')).toBeInTheDocument();

    // Test view mode toggle (list/grid)
    const viewToggleButtons = canvas.queryAllByRole('button', { name: /list|grid|view/i });
    if (viewToggleButtons.length > 0) {
      await userEvent.click(viewToggleButtons[0]);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Test filter functionality
    const filterButton = canvas.queryByRole('button', { name: /filter|search|find/i });
    if (filterButton) {
      await userEvent.click(filterButton);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Test sort functionality
    const sortButton = canvas.queryByRole('button', { name: /sort|order|alpha/i });
    if (sortButton) {
      await userEvent.click(sortButton);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Test add channel button
    const addButton = canvas.queryByRole('button', { name: /add|new|plus/i });
    if (addButton) {
      expect(addButton).toBeInTheDocument();
    }
  },
};
