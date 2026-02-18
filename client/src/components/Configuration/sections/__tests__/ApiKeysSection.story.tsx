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
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/keys', () => HttpResponse.json({ keys: [] })),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ApiKeysSection>;

export const OpensCreateDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: /create key/i }));
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Create API Key')).toBeInTheDocument();
  },
};
