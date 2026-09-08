import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import RequestsPage from './RequestsPage';
import { ExternalRequestReview } from '../../types/externalRequest';

const requestId = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const requests: ExternalRequestReview[] = [
  {
    id: requestId,
    type: 'video',
    status: 'pending',
    requester: {
      id: 4,
      name: 'External Client',
      keyPrefix: 'client1234',
      role: 'request',
      isActive: true,
      revokedAt: null,
    },
    target: {
      youtubeId: 'dQw4w9WgXcQ',
      channelId: 8,
      youtubeChannelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      channelTitle: 'Rick Astley',
      title: 'Rick Astley - Never Gonna Give You Up (Official Video)',
      mediaType: 'video',
      rating: 'TV-PG',
    },
    job: null,
    createdAt: '2026-07-27T18:30:00.000Z',
    updatedAt: '2026-07-27T18:30:00.000Z',
  },
  {
    id: '64fd65fd-870b-43b3-818d-8f2a5344e687',
    type: 'delete_video',
    status: 'approved',
    requester: {
      id: 4,
      name: 'External Client',
      keyPrefix: 'client1234',
      role: 'delete',
      isActive: true,
      revokedAt: null,
    },
    target: {
      youtubeId: 'yPYZpwSpKmA',
      channelId: 8,
      youtubeChannelId: 'UCuAXFkgsw1L7xaCfnd5JJOw',
      channelTitle: 'Rick Astley',
      title: 'Rick Astley - Together Forever (Official Video)',
      mediaType: 'video',
      rating: 'TV-PG',
    },
    job: null,
    createdAt: '2026-07-27T17:30:00.000Z',
    updatedAt: '2026-07-27T17:35:00.000Z',
  },
  {
    id: '9f365adb-b718-4b53-99c9-cf42485b0367',
    type: 'channel',
    status: 'rejected',
    requester: {
      id: 4,
      name: 'External Client',
      keyPrefix: 'client1234',
      role: 'request',
      isActive: true,
      revokedAt: null,
    },
    target: {
      youtubeId: null,
      channelId: null,
      channelUrl: 'https://www.youtube.com/@RickAstleyYT',
      youtubeChannelId: null,
      channelTitle: null,
      title: null,
      mediaType: null,
      rating: null,
    },
    job: null,
    createdAt: '2026-07-27T16:30:00.000Z',
    updatedAt: '2026-07-27T16:45:00.000Z',
    message: 'Channel is outside this profile.',
  },
];

const page = {
  data: requests,
  pagination: { page: 1, pageSize: 25, total: requests.length, totalPages: 1 },
  filterOptions: { requesters: [requests[0].requester] },
};

const meta: Meta<typeof RequestsPage> = {
  title: 'Pages/External Requests',
  component: RequestsPage,
  args: { token: 'storybook-session-token' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/requests']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/external-requests', () => HttpResponse.json(page)),
        http.get(`/api/external-requests/${requestId}`, () => HttpResponse.json(requests[0])),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof RequestsPage>;

export const DesktopQueue: Story = {
  parameters: {
    viewport: { defaultViewport: 'desktop' },
  },
};

export const MobileCards: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};

export const ReviewActions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Never Gonna Give You Up', { exact: false }))
      .toBeInTheDocument();
    const requestCard = within(await canvas.findByTestId(`request-card-${requestId}`));
    await userEvent.click(await requestCard.findByRole('button', { name: 'Details' }));
    const pageBody = within(canvasElement.ownerDocument.body);
    await expect(await pageBody.findByText('Request details')).toBeInTheDocument();
    await userEvent.click(await pageBody.findByRole('button', { name: 'Approve' }));
    await expect(await pageBody.findByText('Confirm approval')).toBeInTheDocument();
  },
};
