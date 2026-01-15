import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';

const meta: Meta<typeof AdvancedSettingsSection> = {
  title: 'Components/Configuration/Sections/AdvancedSettingsSection',
  component: AdvancedSettingsSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      proxy: '',
    });
    return (
      <AdvancedSettingsSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
      />
    );
  },
};

export default meta;
type Story = StoryObj<typeof AdvancedSettingsSection>;

export const ShowsProxyValidation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Advanced Settings'));
    const input = await canvas.findByLabelText('Proxy URL');
    await userEvent.type(input, 'ftp://invalid');
    await userEvent.tab();
    await expect(await canvas.findByText(/invalid proxy url format/i)).toBeInTheDocument();
  },
};
