import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabDownloadSummary from '../TabDownloadSummary';
import { renderWithProviders } from '../../../../test-utils';
import { TabDownloadStats } from '../../../../types/Channel';

const stats = (overrides: Partial<TabDownloadStats> = {}): TabDownloadStats => ({
  total: 1009, fetchedAt: null, downloaded: 19, ignored: 0, percent: 1, loaded: 90, ...overrides,
});

test('says which tab the downloaded and loaded counts are for', () => {
  renderWithProviders(<TabDownloadSummary tabLabel="Videos" stats={stats()} />);

  expect(screen.getByTestId('tab-download-summary')).toHaveTextContent('Videos tab · 19 of 1,009 downloaded · 90 loaded');
});

test('says Load More stops at 5,000 for larger tabs', () => {
  renderWithProviders(<TabDownloadSummary tabLabel="Videos" stats={stats({ total: 6070, loaded: 5000 })} />);

  expect(screen.getByTestId('tab-download-summary')).toHaveTextContent('(Load More loads up to 5,000)');
});

test('does not mention the limit for smaller tabs', () => {
  renderWithProviders(<TabDownloadSummary tabLabel="Videos" stats={stats()} />);

  expect(screen.getByTestId('tab-download-summary')).not.toHaveTextContent('Load More');
});

test('renders nothing before the tab has been counted', () => {
  renderWithProviders(<TabDownloadSummary tabLabel="Videos" stats={stats({ total: null, percent: null })} />);

  expect(screen.queryByTestId('tab-download-summary')).not.toBeInTheDocument();
});
