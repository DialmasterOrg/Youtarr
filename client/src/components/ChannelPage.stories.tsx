import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
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
            video_quality: '720',
            sub_folder: 'MySubFolder',
            min_duration: 120,
            max_duration: 600,
            title_filter_regex: '(?i)^(?!.*short).*',
          })
        ),
        http.get('/api/channels/UC_TEST/tabs', () =>
          HttpResponse.json({
            availableTabs: ['videos'],
          })
        ),
        http.get('/getconfig', () =>
          HttpResponse.json({
            preferredResolution: '1080',
            channelFilesToDownload: 3,
          })
        ),
        http.get('/api/channels/UC_TEST/settings', () =>
          HttpResponse.json({
            sub_folder: 'MySubFolder',
            video_quality: '720',
            min_duration: 120,
            max_duration: 600,
            title_filter_regex: '(?i)^(?!.*short).*',
          })
        ),
        http.get('/api/channels/subfolders', () =>
          HttpResponse.json(['Default', 'MySubFolder'])
        ),
        http.get('/api/channels/UC_TEST/filter-preview', () =>
          HttpResponse.json({
            videos: [],
            totalCount: 0,
            matchCount: 0,
          })
        ),
        http.put('/api/channels/UC_TEST/settings', () =>
          HttpResponse.json({
            settings: {
              sub_folder: 'MySubFolder',
              video_quality: '720',
              min_duration: 120,
              max_duration: 600,
              title_filter_regex: '(?i)^(?!.*short).*',
            },
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
    await expect(await body.findByText(/channel video 1/i)).toBeInTheDocument();

    await expect(await body.findByText(/720p/i)).toBeInTheDocument();
    await expect(await body.findByText(/2-10 min/i)).toBeInTheDocument();

    // Test settings button interaction
    const settingsButton = await body.findByRole('button', { name: /channel settings/i });
    await userEvent.click(settingsButton);
    await expect(await body.findByText(/effective channel quality/i)).toBeInTheDocument();

    // Test filter/regex interactions
    const [filterLabel] = await body.findAllByText(/title filter/i);
    const filterChip = filterLabel.closest('button') ?? filterLabel;
    await userEvent.click(filterChip);
    await expect(await body.findByText(/title filter regex pattern/i)).toBeInTheDocument();
    await expect(await body.findByText(/\(\?i\)\^\(\?!\.\*short\)\.\*/i)).toBeInTheDocument();

    await waitFor(async () => {
      const popover = body.queryByText(/title filter regex pattern/i);
      expect(popover).toBeInTheDocument();
    });
  },
};
