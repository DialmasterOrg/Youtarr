import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoadMoreProgress from '../LoadMoreProgress';
import { renderWithProviders } from '../../../../test-utils';

const bar = () => screen.getByRole('progressbar', { name: 'Load More progress' });

test('fills against the tab total while listing', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 250, stage: 'listing' }} total={1000} />);

  expect(bar()).toHaveAttribute('aria-valuenow', '25');
});

test('says how many of the tab total have been read', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 250, stage: 'listing' }} total={1000} />);

  expect(screen.getByText('Read 250 of 1,000 videos from YouTube')).toBeInTheDocument();
});

test('measures against the Load More limit when the tab is larger', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 2500, stage: 'listing' }} total={20000} />);

  expect(bar()).toHaveAttribute('aria-valuenow', '50');
});

test('holds short of full when the listing runs past the total', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 1030, stage: 'listing' }} total={1000} />);

  expect(bar()).toHaveAttribute('aria-valuenow', '99');
});

test('drops the total from the caption once the listing runs past it', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 1030, stage: 'listing' }} total={1000} />);

  expect(screen.getByText('Read 1,030 videos from YouTube')).toBeInTheDocument();
});

test('stays indeterminate without a tab total', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 250, stage: 'listing' }} total={null} />);

  expect(bar()).not.toHaveAttribute('aria-valuenow');
});

test('still reports the running count without a tab total', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 250, stage: 'listing' }} total={undefined} />);

  expect(screen.getByText('Read 250 videos from YouTube')).toBeInTheDocument();
});

test('stays indeterminate while saving', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 1000, stage: 'saving' }} total={1000} />);

  expect(bar()).not.toHaveAttribute('aria-valuenow');
});

test('says the listing is being saved', () => {
  renderWithProviders(<LoadMoreProgress progress={{ itemsFetched: 1000, stage: 'saving' }} total={1000} />);

  expect(screen.getByText('Saving 1,000 videos...')).toBeInTheDocument();
});

test('shows an indeterminate bar with no caption before progress arrives', () => {
  renderWithProviders(<LoadMoreProgress progress={null} total={1000} />);

  expect(bar()).not.toHaveAttribute('aria-valuenow');
  expect(screen.queryByText(/videos/)).not.toBeInTheDocument();
});
