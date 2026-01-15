import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
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
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // Core settings card is rendered once config has loaded.
    await expect(await body.findByText('Core Settings')).toBeInTheDocument();
    const outputDirLabels = await body.findAllByText('YouTube Output Directory');
    expect(outputDirLabels.length).toBeGreaterThan(0);
  },
};
