import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within, waitFor } from '@storybook/test';
import { http, HttpResponse } from 'msw';
import ChangelogPage from './ChangelogPage';
import { resetChangelogCache } from '../hooks/useChangelog';

const CHANGELOG_RAW_URL =
  'https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/CHANGELOG.md';

const meta: Meta<typeof ChangelogPage> = {
  title: 'Pages/ChangelogPage',
  component: ChangelogPage,
  parameters: {
    layout: 'fullscreen',
  },
  loaders: [async () => {
    resetChangelogCache();
    return {};
  }],
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

    await waitFor(() => {
      expect(refreshButton).toBeDisabled();
    });

    await expect(await body.findByText(/added features/i)).toBeInTheDocument();
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(CHANGELOG_RAW_URL, () =>
          HttpResponse.text('# Version 1.0.0', { delay: 1200 })
        ),
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

    await expect(await body.findByText(/unable to load changelog/i)).toBeInTheDocument();
    await expect(await body.findByRole('link', { name: /https:\/\/github.com\/dialmasterorg\/youtarr/i })).toBeInTheDocument();

    const retryButton = await body.findByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);
    await expect(await body.findByRole('progressbar')).toBeInTheDocument();
  },
};
