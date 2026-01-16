import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { DownloadPerformanceSection } from './DownloadPerformanceSection';

const meta: Meta<typeof DownloadPerformanceSection> = {
  title: 'Components/Configuration/Sections/DownloadPerformanceSection',
  component: DownloadPerformanceSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      enableStallDetection: true,
    });
    return (
      <DownloadPerformanceSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
};

export default meta;
type Story = StoryObj<typeof DownloadPerformanceSection>;

export const ToggleStallDetection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accordionToggle = await canvas.findByRole('button', { name: /download performance settings/i });
    await userEvent.click(accordionToggle);

    const switchInput = await canvas.findByRole('checkbox', { name: /enable stall detection/i });
    await userEvent.click(switchInput);
    await expect(switchInput).not.toBeChecked();
  },
};
