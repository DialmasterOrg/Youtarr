import type { Meta, StoryObj } from '@storybook/react';
import { expect, within, userEvent } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import { DEFAULT_CONFIG } from '../config/configSchema';
import Configuration from './Configuration';

const meta: Meta<typeof Configuration> = {
  title: 'Pages/Configuration',
  component: Configuration,
  args: {
    token: 'storybook-token',
  },
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof Configuration>;

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/getconfig', () =>
          HttpResponse.json({
            ...DEFAULT_CONFIG,
            youtubeOutputDirectory: '/downloads/youtube',
            isPlatformManaged: {
              plexUrl: false,
              authEnabled: true,
              useTmpForDownloads: false,
            },
            deploymentEnvironment: {
              platform: null,
              isWsl: false,
            },
          })
        ),
        http.get('/storage-status', () =>
          HttpResponse.json({
            availableGB: '100',
            percentFree: 50,
            totalGB: '200',
          })
        ),
        http.get('/api/keys', () =>
          HttpResponse.json({
            keys: [
              {
                id: 1,
                name: 'Test Key',
                key_prefix: 'yt_',
                created_at: new Date().toISOString(),
                last_used_at: null,
                is_active: true,
                usage_count: 0,
              },
            ],
          })
        ),
        http.get('/api/cookies/status', () =>
          HttpResponse.json({
            customFileExists: true,
            customFileSize: 1024,
            customFileUpdated: new Date().toISOString(),
          })
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Core settings card is rendered once config has loaded.
    await expect(await body.findByText('Core Settings')).toBeInTheDocument();

    // Expand accordions to ensure content is in DOM and wait for async fetches to complete.
    // This prevents 'act' warnings from state updates that happen after the test normally finishes.
    const cookieAccordion = await body.findByText('Cookie Configuration');
    await userEvent.click(cookieAccordion);

    // Enable cookies to surface the status text.
    const enableCookiesToggle = await body.findByRole('checkbox', { name: /Enable Cookies/i });
    await userEvent.click(enableCookiesToggle);

    const cookieStatusLabels = await body.findAllByText(
      (_, node) => node?.textContent?.includes('Using custom cookies') ?? false
    );
    await expect(cookieStatusLabels.length).toBeGreaterThan(0);

    const apiAccordion = await body.findByText('API Keys & External Access');
    await userEvent.click(apiAccordion);
    await expect(await body.findByText('Test Key')).toBeInTheDocument();

    const outputDirLabels = await body.findAllByText('YouTube Output Directory');
    await expect(outputDirLabels.length).toBeGreaterThan(0);
  },
};
