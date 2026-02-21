import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import StorageStatus from '../StorageStatus';

const meta: Meta<typeof StorageStatus> = {
  title: 'Composite/StorageStatus',
  component: StorageStatus,
  args: {
    token: 'storybook-token',
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/storage-status', () =>
          HttpResponse.json({ availableGB: '120', totalGB: '240', percentFree: 50 })
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StorageStatus>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByText(/gb free/i);
    await expect(chip).toBeInTheDocument();
    await userEvent.hover(chip);

    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText(/120 GB free of 240 GB total/i)).toBeInTheDocument();
  },
};
