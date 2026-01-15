import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { AutoRemovalSection } from './AutoRemovalSection';

const meta: Meta<typeof AutoRemovalSection> = {
  title: 'Components/Configuration/Sections/AutoRemovalSection',
  component: AutoRemovalSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      autoRemovalEnabled: false,
      autoRemovalFreeSpaceThreshold: '',
      autoRemovalVideoAgeThreshold: '',
    });
    return (
      <AutoRemovalSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
  args: {
    token: 'storybook-token',
    storageAvailable: true,
  },
};

export default meta;
type Story = StoryObj<typeof AutoRemovalSection>;

export const ExpandAndEnable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Automatic Video Removal'));
    const toggle = await canvas.findByRole('checkbox', { name: /enable automatic video removal/i });
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
  },
};
