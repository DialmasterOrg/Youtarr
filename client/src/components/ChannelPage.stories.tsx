import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ChannelPage from './ChannelPage';

const meta: Meta<typeof ChannelPage> = {
  title: 'Pages/ChannelPage',
  component: ChannelPage,
  args: {
    token: 'storybook-token',
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => (
    <MemoryRouter initialEntries={['/channels/UC_TEST']}>
      <Routes>
        <Route path="/channels/:channel_id" element={<ChannelPage {...args} />} />
      </Routes>
    </MemoryRouter>
  ),
};

export default meta;
type Story = StoryObj<typeof ChannelPage>;

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/getChannelInfo/UC_TEST', () =>
          HttpResponse.json({
            url: 'https://www.youtube.com/@testchannel',
            uploader: 'Test Channel',
            channel_id: 'UC_TEST',
            description: 'A test channel for Storybook',
            video_quality: null,
            sub_folder: null,
            min_duration: null,
            max_duration: null,
            title_filter_regex: null,
          })
        ),
        http.get('/api/channels/UC_TEST/tabs', () =>
          HttpResponse.json({
            availableTabs: ['videos'],
          })
        ),
        http.get('/getchannelvideos/UC_TEST', ({ request }) => {
          const url = new URL(request.url);
          const tabType = url.searchParams.get('tabType') ?? 'videos';

          return HttpResponse.json({
            videos: [
              {
                title: 'Channel Video 1',
                youtube_id: 'vid1',
                publishedAt: '2024-01-15T10:30:00Z',
                thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
                added: false,
                duration: 600,
                media_type: tabType === 'streams' ? 'livestream' : 'video',
                live_status: null,
              },
            ],
            totalCount: 1,
            totalPages: 1,
            page: 1,
            limit: 12,
            videoFail: false,
            oldestVideoDate: '2024-01-15',
            autoDownloadsEnabled: true,
            availableTabs: ['videos'],
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Verify channel header loads
    await expect(await body.findByRole('heading', { name: /test channel/i })).toBeInTheDocument();

    // Verify video list loads
    await expect(await body.findByText(/channel video 1/i, undefined, { timeout: 5000 })).toBeInTheDocument();

    // Test settings button interaction
    const settingsButton = body.queryByRole('button', { name: /settings|gear|config/i });
    if (settingsButton) {
      await userEvent.click(settingsButton);
      await new Promise((resolve) => setTimeout(resolve, 200));
      // Settings dialog should open (verify with expected dialog elements)
    }

    // Test filter/regex interactions
    const filterButtons = body.queryAllByRole('button', { name: /filter|regex|quality/i });
    if (filterButtons.length > 0) {
      await userEvent.click(filterButtons[0]);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  },
};
