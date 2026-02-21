import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import ChangelogPage from '../ChangelogPage';

const CHANGELOG_RAW_URL =
  'https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/CHANGELOG.md';

const meta: Meta<typeof ChangelogPage> = {
  title: 'Pages/ChangelogPage',
  component: ChangelogPage,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof ChangelogPage>;

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(CHANGELOG_RAW_URL, () =>
          HttpResponse.text(
            ['# Version 1.0.0', '', '- Initial release', '- Added features'].join('\n')
          )
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    // The page fetches the changelog on mount (covered by the MSW override above).
    // Avoid clicking "Refresh" here since it may be temporarily disabled while loading.

    await expect(await body.findByRole('heading', { name: /changelog/i })).toBeInTheDocument();
    await expect(await body.findByText(/version 1\.0\.0/i)).toBeInTheDocument();
    await expect(await body.findByText(/initial release/i)).toBeInTheDocument();

    const refreshButton = await body.findByRole('button', { name: /refresh/i });
    await userEvent.click(refreshButton);

    await waitFor(async () => {
      await expect(refreshButton).toBeDisabled();
    });

    await expect(await body.findByText(/added features/i)).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        // Use an async resolver and a native timeout to simulate a slow response
        http.get(CHANGELOG_RAW_URL, async () => {
          await new Promise((r) => setTimeout(r, 1200));
          return HttpResponse.text('# Version 1.0.0');
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);

    await expect(await body.findByRole('progressbar')).toBeInTheDocument();
    await expect(await body.findByRole('heading', { name: /changelog/i })).toBeInTheDocument();
  },
};

export const ErrorState: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(CHANGELOG_RAW_URL, () =>
          HttpResponse.text('Server error', { status: 500 })
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const alert = await body.findByRole('alert');
      const alertContent = within(alert);

      await expect(alertContent.getByText(/unable to load changelog/i)).toBeInTheDocument();
      await expect(alertContent.getByRole('link', { name: /https:\/\/github.com\/dialmasterorg\/youtarr/i })).toBeInTheDocument();

      const retryButton = await alertContent.findByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);
      await expect(await body.findByRole('progressbar')).toBeInTheDocument();
    } finally {
      console.error = originalConsoleError;
    }
  },
};
