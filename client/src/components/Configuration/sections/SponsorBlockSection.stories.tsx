import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { SponsorBlockSection } from './SponsorBlockSection';

const meta: Meta<typeof SponsorBlockSection> = {
  title: 'Components/Configuration/Sections/SponsorBlockSection',
  component: SponsorBlockSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      sponsorblockEnabled: true,
    });
    return (
      <SponsorBlockSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
};

export default meta;
type Story = StoryObj<typeof SponsorBlockSection>;

export const ToggleCategory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sponsorCheckbox = canvas.getByTestId('category-sponsor-checkbox');
    await userEvent.click(sponsorCheckbox);
    await expect(sponsorCheckbox).not.toBeChecked();
  },
};
