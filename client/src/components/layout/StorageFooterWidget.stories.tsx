import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { StorageFooterWidget } from './StorageFooterWidget';

const meta: Meta<typeof StorageFooterWidget> = {
  title: 'Components/Layout/StorageFooterWidget',
  component: StorageFooterWidget,
  args: {
    token: 'storybook-token',
    collapsed: false,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/storage-status', () =>
          HttpResponse.json({
            availableGB: '100',
            totalGB: '200',
            percentFree: 50,
          })
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StorageFooterWidget>;

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Storage')).toBeInTheDocument();
    await expect(await canvas.findByText('100 GB free of 200 GB')).toBeInTheDocument();
  },
};
