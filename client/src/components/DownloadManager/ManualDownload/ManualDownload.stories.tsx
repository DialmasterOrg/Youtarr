import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import ManualDownload from './ManualDownload';

const meta: Meta<typeof ManualDownload> = {
  title: 'Components/DownloadManager/ManualDownload',
  component: ManualDownload,
  args: {
    token: 'storybook-token',
    onStartDownload: async () => undefined,
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof ManualDownload>;

export const AddToQueue: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/checkYoutubeVideoURL', async ({ request }) => {
          const body = (await request.json()) as { url?: string };
          const url = body.url ?? 'https://youtube.com/watch?v=test123';

          return HttpResponse.json({
            isValidUrl: true,
            isAlreadyDownloaded: false,
            isMembersOnly: false,
            metadata: {
              youtubeId: 'test123',
              url,
              channelName: 'Test Channel',
              videoTitle: 'Test Video',
              duration: 300,
              publishedAt: 1234567890,
              media_type: 'video',
            },
          });
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    const input = await body.findByPlaceholderText('Paste YouTube video URL here...');
    await userEvent.type(input, 'https://youtube.com/watch?v=test123');

    const addIcon = await body.findByTestId('AddIcon');
    const addButton = addIcon.closest('button');
    await expect(addButton).toBeTruthy();
    await userEvent.click(addButton as HTMLButtonElement);

    await expect(await body.findByText('Download Queue')).toBeInTheDocument();
    await expect(await body.findByText(/test video/i)).toBeInTheDocument();
  },
};
