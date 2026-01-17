import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { KodiCompatibilitySection } from './KodiCompatibilitySection';

const meta: Meta<typeof KodiCompatibilitySection> = {
  title: 'Components/Configuration/Sections/KodiCompatibilitySection',
  component: KodiCompatibilitySection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      writeVideoNfoFiles: true,
      writeChannelPosters: true,
    });
    return (
      <KodiCompatibilitySection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
};

export default meta;
type Story = StoryObj<typeof KodiCompatibilitySection>;

export const ToggleMetadata: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = await canvas.findByRole('checkbox', { name: /generate video \.nfo files/i });
    await userEvent.click(checkbox);
    await expect(checkbox).not.toBeChecked();
  },
};
