import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import React from 'react';
import { createMockChannel, createMockVideo } from './test-utils';

const TestUtilsPreview = () => {
  const channel = createMockChannel({ name: 'QA Channel' });
  const video = createMockVideo({ title: 'QA Video' });

  return (
    <div>
      <div>Channel: {channel.name}</div>
      <div>Video: {video.title}</div>
    </div>
  );
};

const meta: Meta<typeof TestUtilsPreview> = {
  title: 'Utilities/TestUtils',
  component: TestUtilsPreview,
};

export default meta;
type Story = StoryObj<typeof TestUtilsPreview>;

export const FactoryOutputs: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Channel: QA Channel')).toBeInTheDocument();
    await expect(canvas.getByText('Video: QA Video')).toBeInTheDocument();
  },
};
