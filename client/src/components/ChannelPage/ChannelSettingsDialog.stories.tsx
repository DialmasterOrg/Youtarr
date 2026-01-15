import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import ChannelSettingsDialog from './ChannelSettingsDialog';

const meta: Meta<typeof ChannelSettingsDialog> = {
  title: 'Components/ChannelPage/ChannelSettingsDialog',
  component: ChannelSettingsDialog,
  args: {
    open: true,
    channelId: 'chan-1',
    channelName: 'Example Channel',
    token: 'storybook-token',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/getconfig', () =>
          HttpResponse.json({ preferredResolution: '1080' })
        ),
        http.get('/api/channels/chan-1/settings', () =>
          HttpResponse.json({
            sub_folder: null,
            video_quality: null,
            min_duration: null,
            max_duration: null,
            title_filter_regex: null,
          })
        ),
        http.get('/api/channels/subfolders', () =>
          HttpResponse.json(['Movies', 'Shows'])
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChannelSettingsDialog>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Channel Settings: Example Channel')).toBeInTheDocument();
    await expect(await body.findByText(/effective channel quality/i)).toBeInTheDocument();
  },
};
