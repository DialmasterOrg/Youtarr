import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from '@storybook/test';
import React, { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../../config/configSchema';
import { CookieConfigSection } from './CookieConfigSection';

const meta: Meta<typeof CookieConfigSection> = {
  title: 'Components/Configuration/Sections/CookieConfigSection',
  component: CookieConfigSection,
  parameters: {
    msw: {
      handlers: [
        http.get('/api/cookies/status', () =>
          HttpResponse.json({
            cookiesEnabled: false,
            customCookiesUploaded: false,
            customFileExists: false,
          })
        ),
      ],
    },
  },
  render: (args) => {
    const [config, setConfig] = useState({
      ...DEFAULT_CONFIG,
      cookiesEnabled: false,
      customCookiesUploaded: false,
    });
    return (
      <CookieConfigSection
        {...args}
        config={config}
        setConfig={setConfig}
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
type Story = StoryObj<typeof CookieConfigSection>;

export const EnableCookies: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const switchInput = canvas.getByRole('checkbox', { name: /enable cookies/i });
    await userEvent.click(switchInput);
    await expect(switchInput).toBeChecked();
    await expect(canvas.getByRole('button', { name: /upload cookie file/i })).toBeInTheDocument();
  },
};
