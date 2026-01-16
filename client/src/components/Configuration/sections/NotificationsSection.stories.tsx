import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { NotificationsSection } from './NotificationsSection';

const meta: Meta<typeof NotificationsSection> = {
  title: 'Components/Configuration/Sections/NotificationsSection',
  component: NotificationsSection,
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      notificationsEnabled: true,
      appriseUrls: [],
    });
    return (
      <NotificationsSection
        {...args}
        config={config}
        onConfigChange={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
        setSnackbar={fn()}
      />
    );
  },
  args: {
    token: 'storybook-token',
  },
};

export default meta;
type Story = StoryObj<typeof NotificationsSection>;

export const AddService: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const accordionToggle = await canvas.findByRole('button', { name: /notifications/i });
    await userEvent.click(accordionToggle);

    const urlInput = await canvas.findByLabelText('Notification URL');
    await userEvent.type(urlInput, 'discord://webhook_id/token');
    await userEvent.click(canvas.getByRole('button', { name: 'Add Service' }));

    const discordLabels = await canvas.findAllByText('Discord');
    await expect(discordLabels.length).toBeGreaterThan(0);
  },
};
