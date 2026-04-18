import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('../../../ui', () => {
  const React = require('react');
  return {
    Box: ({ children, ...rest }: { children?: React.ReactNode }) =>
      React.createElement('div', rest, children),
    Typography: ({ children, ...rest }: { children?: React.ReactNode }) =>
      React.createElement('div', rest, children),
    Alert: ({ children, action }: { children?: React.ReactNode; action?: React.ReactNode }) =>
      React.createElement('div', { role: 'alert' }, children, action),
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      React.createElement('button', { onClick }, children),
    Skeleton: () => React.createElement('div', { 'data-testid': 'skeleton' }),
  };
});

jest.mock('../ResultCard', () => ({
  __esModule: true,
  default: function MockResultCard(props: { result: { youtubeId: string; title: string }; onClick: () => void }) {
    const React = require('react');
    return React.createElement(
      'button',
      { onClick: props.onClick, 'data-testid': `card-${props.result.youtubeId}` },
      props.result.title
    );
  },
}));

const ResultsGrid = require('../ResultsGrid').default;

const baseProps = {
  results: [],
  loading: false,
  error: null,
  hasSearched: false,
  lastQuery: '',
  pageSize: 25 as const,
  onResultClick: () => {},
  onRetry: () => {},
};

describe('ResultsGrid', () => {
  test('loading: renders pageSize skeleton placeholders', () => {
    render(<ResultsGrid {...baseProps} loading pageSize={10} />);
    // 3 skeletons per card (thumbnail + title + channel) * 10 cards = 30
    expect(screen.getAllByTestId('skeleton')).toHaveLength(30);
  });

  test('error: renders message and Try again triggers onRetry', () => {
    const onRetry = jest.fn();
    render(<ResultsGrid {...baseProps} error="Search failed" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('initial (no search yet): renders the prompt', () => {
    render(<ResultsGrid {...baseProps} hasSearched={false} />);
    expect(screen.getByText(/enter a search and click search/i)).toBeInTheDocument();
  });

  test('empty results: renders "No videos found for <query>"', () => {
    render(<ResultsGrid {...baseProps} hasSearched results={[]} lastQuery="banana" />);
    expect(screen.getByText(/no videos found for "banana"/i)).toBeInTheDocument();
  });

  test('results: renders one card per item; click invokes onResultClick', () => {
    const onResultClick = jest.fn();
    const results = [
      {
        youtubeId: 'a', title: 'Alpha', channelName: 'C', channelId: null,
        duration: null, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' as const,
      },
      {
        youtubeId: 'b', title: 'Bravo', channelName: 'C', channelId: null,
        duration: null, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' as const,
      },
    ];
    render(<ResultsGrid {...baseProps} hasSearched results={results} onResultClick={onResultClick} />);
    expect(screen.getByTestId('card-a')).toHaveTextContent('Alpha');
    expect(screen.getByTestId('card-b')).toHaveTextContent('Bravo');

    fireEvent.click(screen.getByTestId('card-a'));
    expect(onResultClick).toHaveBeenCalledWith(results[0]);
  });
});
