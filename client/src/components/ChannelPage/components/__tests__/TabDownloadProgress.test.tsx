import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabDownloadProgress from '../TabDownloadProgress';
import { renderWithProviders } from '../../../../test-utils';
import { TabDownloadStats } from '../../../../types/Channel';

const stats = (overrides: Partial<TabDownloadStats> = {}): TabDownloadStats => ({
  total: 1009, fetchedAt: null, downloaded: 19, ignored: 0, percent: 1, ...overrides,
});

test('shows a progress bar named for the tab and its counts', () => {
  renderWithProviders(<TabDownloadProgress label="Videos" stats={stats()} />);

  expect(screen.getByRole('progressbar', { name: 'Videos: 19 of 1,009 downloaded' })).toHaveAttribute('aria-valuenow', '1');
});

test('shows the downloaded and total counts', () => {
  renderWithProviders(<TabDownloadProgress label="Videos" stats={stats()} />);

  expect(screen.getByText('19/1,009')).toBeInTheDocument();
});

test('renders nothing before the tab has been counted', () => {
  renderWithProviders(<TabDownloadProgress label="Videos" stats={stats({ total: null, percent: null })} />);

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('renders nothing without stats', () => {
  renderWithProviders(<TabDownloadProgress label="Videos" stats={undefined} />);

  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
