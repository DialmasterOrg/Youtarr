import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ResultsGrid from '../ResultsGrid';
import { ChannelSearchResult } from '../../types';

jest.mock('../../../ui', () => ({
  ...jest.requireActual('../../../ui'),
  Skeleton: function MockSkeleton(props: { className?: string }) {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'skeleton', className: props.className });
  },
}));

const result = (overrides: Partial<ChannelSearchResult> = {}): ChannelSearchResult => ({
  channelId: 'UCa',
  name: 'Alpha',
  handle: '@alpha',
  url: 'https://www.youtube.com/channel/UCa',
  thumbnailUrl: null,
  subscriberCount: 100,
  videoCount: null,
  description: null,
  subscribed: false,
  ...overrides,
});

const baseProps = {
  results: [] as ChannelSearchResult[],
  loading: false,
  error: null as string | null,
  hasSearched: false,
  lastQuery: '',
  pageSize: 10 as const,
  onResultClick: jest.fn(),
  onRetry: jest.fn(),
};

describe('FindChannels ResultsGrid', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('shows the pre-search hint before any search', () => {
    render(<ResultsGrid {...baseProps} />);
    expect(screen.getByText(/enter a search/i)).toBeInTheDocument();
  });

  test('shows the empty state with the last query', () => {
    render(<ResultsGrid {...baseProps} hasSearched lastQuery="zzz" />);
    expect(screen.getByText(/no channels found for "zzz"/i)).toBeInTheDocument();
  });

  test('shows an error with a working retry button', () => {
    render(<ResultsGrid {...baseProps} hasSearched error="Search timed out" />);
    expect(screen.getByText('Search timed out')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(baseProps.onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders a card per result and forwards clicks', () => {
    const results = [result(), result({ channelId: 'UCb', name: 'Beta' })];
    render(<ResultsGrid {...baseProps} hasSearched results={results} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add beta/i }));
    expect(baseProps.onResultClick).toHaveBeenCalledWith(results[1]);
  });

  test('renders 3 skeletons per placeholder cell, pageSize cells, while loading', () => {
    render(<ResultsGrid {...baseProps} loading pageSize={10} />);
    expect(screen.getAllByTestId('skeleton')).toHaveLength(30);
    expect(screen.queryByText(/enter a search/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no channels found/i)).not.toBeInTheDocument();
  });
});
