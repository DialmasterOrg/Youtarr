import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';
import React, { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../../../../config/configSchema';
import { CookieConfigSection } from '../CookieConfigSection';

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
    const switchInput = await canvas.findByRole('checkbox', { name: /enable cookies/i });
    await userEvent.click(switchInput);
    await expect(switchInput).toBeChecked();
    await expect(canvas.getByRole('button', { name: /upload cookie file/i })).toBeInTheDocument();
  },
};

export const UploadedCookieFile: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/cookies/status', () => HttpResponse.json({
          cookiesEnabled: true,
          customCookiesUploaded: true,
          customFileExists: true,
          details: {
            loginCookiesFound: 10,
            sessionLoginCookies: 0,
            expiredLoginCookies: 0,
            earliestExpiry: '2027-10-19T03:13:08.000Z',
            earliestExpiryName: 'HSID',
            lastModified: '2026-09-18T22:40:30.384Z',
          },
        })),
        http.post('/api/cookies/test', () => HttpResponse.json({
          ok: true,
          message: 'YouTube accepted these cookies as a signed-in session.',
        })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('checkbox', { name: /enable cookies/i }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Test cookies' }));
    await expect(await canvas.findByText('Signed in')).toBeInTheDocument();
  },
};

export const ExternalCookies: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/cookies/status', () => HttpResponse.json({
          cookiesEnabled: false,
          customCookiesUploaded: false,
          customFileExists: false,
          external: {
            path: '/app/config/cookies.external.txt',
            ready: true,
            lastModified: '2026-09-05T12:00:00.000Z',
            warning: null,
            error: null,
          },
        })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('/app/config/cookies.external.txt')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('checkbox', { name: /enable cookies/i }));
    await expect(canvas.getByRole('button', { name: /refresh file status/i })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /upload cookie file/i })).not.toBeInTheDocument();
  },
};

export const MissingExternalCookies: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/cookies/status', () => HttpResponse.json({
          cookiesEnabled: false,
          customCookiesUploaded: false,
          customFileExists: false,
          external: {
            path: '/app/config/cookies.external.txt',
            ready: false,
            lastModified: null,
            warning: null,
            error: 'External cookies: the file was not found. Check the directory mount and YOUTARR_COOKIES_FILE.',
          },
        })),
      ],
    },
  },
};

export const ExternalCookieWarnings: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/cookies/status', () => HttpResponse.json({
          cookiesEnabled: false,
          customCookiesUploaded: false,
          customFileExists: false,
          external: {
            path: '/app/config/cookies.external.txt',
            ready: true,
            lastModified: '2026-09-05T12:00:00.000Z',
            warning: 'yt-dlp reported warnings while loading the file. Only the cookies it loaded will be used.',
            error: null,
          },
        })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('/app/config/cookies.external.txt');
    await userEvent.click(canvas.getByRole('checkbox', { name: /enable cookies/i }));
    await expect(canvas.getByText(/yt-dlp reported warnings/)).toBeInTheDocument();
  },
};

export const AutomaticRefreshSetup: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const help = canvas.getByRole('button', { name: /refresh cookies automatically with YOUTARR_COOKIES_FILE/i });
    await userEvent.click(help);
    await expect(help).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('YOUTARR_COOKIES_FILE=/app/config/cookies.external.txt')).toBeVisible();
  },
};
