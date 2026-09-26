import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosInfo from '../ChannelVideosInfo';
import { renderWithProviders } from '../../../../test-utils';
import { TabDownloadStatsByTab } from '../../../../types/Channel';
import { formatDateTime } from '../../../../utils/formatters';

const tabStats: TabDownloadStatsByTab = {
  videos: { total: 449, fetchedAt: '2026-09-26T11:45:00.000Z', downloaded: 120, ignored: 3, percent: 26, loaded: 101 },
  shorts: { total: null, fetchedAt: null, downloaded: 0, ignored: 0, percent: null, loaded: 0 },
};

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Video list info' }));
};

test('lists the download counts for each counted tab', async () => {
  renderWithProviders(<ChannelVideosInfo tabStats={tabStats} dateText="Dates text" highlight={false} />);
  await open();

  expect(await screen.findByText('Videos: 120 of 449 downloaded, 3 ignored, 101 loaded')).toBeInTheDocument();
});

test('leaves out tabs that have not been counted', async () => {
  renderWithProviders(<ChannelVideosInfo tabStats={tabStats} dateText="Dates text" highlight={false} />);
  await open();

  await screen.findByText('Dates text');
  expect(screen.queryByText(/^Shorts:/)).not.toBeInTheDocument();
});

test('explains that only public videos are counted', async () => {
  renderWithProviders(<ChannelVideosInfo tabStats={tabStats} dateText="Dates text" highlight={false} />);
  await open();

  expect(await screen.findByText(/Public videos only/)).toBeInTheDocument();
});

test('shows only the publish date explanation before any tab is counted', async () => {
  renderWithProviders(<ChannelVideosInfo tabStats={null} dateText="Dates text" highlight={false} />);
  await open();

  await screen.findByText('Dates text');
  expect(screen.queryByText(/Public videos only/)).not.toBeInTheDocument();
});

test('says when the counts were last updated, using the oldest tab', async () => {
  const older = '2026-09-25T09:00:00.000Z';
  const stats: TabDownloadStatsByTab = {
    ...tabStats,
    shorts: { total: 530, fetchedAt: older, downloaded: 0, ignored: 0, percent: 0, loaded: 50 },
  };
  renderWithProviders(<ChannelVideosInfo tabStats={stats} dateText="Dates text" highlight={false} />);
  await open();

  expect(await screen.findByText(`Updated ${formatDateTime(older)}`)).toBeInTheDocument();
});

test('shows the publish date explanation', async () => {
  renderWithProviders(<ChannelVideosInfo tabStats={tabStats} dateText="Dates text" highlight={false} />);
  await open();

  expect(await screen.findByText('Dates text')).toBeInTheDocument();
});

test('tints the icon when some dates are pending', () => {
  renderWithProviders(<ChannelVideosInfo tabStats={null} dateText="Dates text" highlight={true} />);

  expect(screen.getByRole('button', { name: 'Video list info' })).toHaveStyle({ color: 'var(--warning)' });
});
