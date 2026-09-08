import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import ApiKeysSection from '../ApiKeysSection';

const meta: Meta<typeof ApiKeysSection> = {
  title: 'Components/Configuration/Sections/ApiKeysSection',
  component: ApiKeysSection,
  args: {
    token: 'storybook-token',
    apiKeyRateLimit: 10,
    onRateLimitChange: () => {},
    showRequestsNavLink: true,
    onShowRequestsNavLinkChange: () => {},
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/keys', () => HttpResponse.json({ keys: [] })),
        http.get('/getchannels', () => HttpResponse.json({
          channels: [],
          totalPages: 1,
        })),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ApiKeysSection>;

export const OpensCreateDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /create external key/i }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Create External Access Key')).toBeInTheDocument();
    await expect(await body.findByText('View included')).toBeInTheDocument();
  },
};

export const ResponsiveKeyCards: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    msw: {
      handlers: [
        http.get('/api/keys', () => HttpResponse.json({
          keys: [{
            id: 4,
            name: 'External Client',
            key_prefix: 'client1234',
            created_at: '2026-07-27T18:30:00.000Z',
            last_used_at: '2026-07-27T19:00:00.000Z',
            is_active: true,
            usage_count: 12,
            role: 'delete',
            allow_video_requests: true,
            allow_channel_requests: true,
            allow_delete_video_requests: true,
            auto_approve_video_requests: false,
            auto_approve_channel_requests: true,
            auto_approve_delete_requests: false,
            max_rating_level: 3,
            allow_unrated: false,
            allowed_media_types: ['video', 'short'],
            revoked_at: null,
          }],
        })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('External Client')).toBeInTheDocument();
    await expect(await canvas.findByLabelText('Movie rating ceiling PG-13')).toBeInTheDocument();
    await expect(await canvas.findByLabelText('TV rating ceiling TV-14')).toBeInTheDocument();
    await expect(await canvas.findByText('Channels · Auto')).toBeInTheDocument();
  },
};

export const LegacyKeysAtBottom: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/keys', () => HttpResponse.json({
          keys: [{
            id: 2,
            name: 'Old Bookmarklet',
            key_prefix: 'legacy12',
            created_at: '2026-07-01T18:30:00.000Z',
            last_used_at: null,
            is_active: true,
            usage_count: 3,
            role: 'legacy_download',
            allow_video_requests: false,
            allow_channel_requests: false,
            allow_delete_video_requests: false,
            auto_approve_video_requests: false,
            auto_approve_channel_requests: false,
            auto_approve_delete_requests: false,
            max_rating_level: 3,
            allow_unrated: false,
            allowed_media_types: ['video'],
            revoked_at: null,
          }],
        })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No external access keys yet.')).toBeInTheDocument();
    await expect(await canvas.findByText('Old Bookmarklet')).toBeInTheDocument();
    await expect(await canvas.findByText('Legacy download')).toBeInTheDocument();
  },
};
