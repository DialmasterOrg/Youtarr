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

jest.mock('../ResultsTable', () => ({
  __esModule: true,
  default: function MockResultsTable(props: { results: { youtubeId: string; title: string }[]; onResultClick: (r: { youtubeId: string; title: string }) => void }) {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'results-table' },
      props.results.map((r) =>
        React.createElement(
          'button',
          { key: r.youtubeId, onClick: () => props.onResultClick(r), 'data-testid': `row-${r.youtubeId}` },
          r.title
        )
      )
    );
  },
}));

jest.mock('../ResultsListMobile', () => ({
  __esModule: true,
  default: function MockResultsListMobile(props: { results: { youtubeId: string; title: string }[]; onResultClick: (r: { youtubeId: string; title: string }) => void }) {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'results-list-mobile' },
      props.results.map((r) =>
        React.createElement(
          'button',
          { key: r.youtubeId, onClick: () => props.onResultClick(r), 'data-testid': `card-mobile-${r.youtubeId}` },
          r.title
        )
      )
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
  viewMode: 'grid' as const,
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

  test('viewMode=table on desktop: renders ResultsTable; click invokes onResultClick', () => {
    const onResultClick = jest.fn();
    const results = [
      {
        youtubeId: 'a', title: 'Alpha', channelName: 'C', channelId: null,
        duration: null, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' as const,
      },
    ];
    render(<ResultsGrid {...baseProps} hasSearched viewMode="table" results={results} onResultClick={onResultClick} />);
    expect(screen.getByTestId('results-table')).toBeInTheDocument();
    expect(screen.queryByTestId('results-list-mobile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-a')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('row-a'));
    expect(onResultClick).toHaveBeenCalledWith(results[0]);
  });

  describe('on mobile viewport', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('max-width: 767px'),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
      });
    });

    test('viewMode=table renders ResultsListMobile instead of ResultsTable', () => {
      const onResultClick = jest.fn();
      const results = [
        {
          youtubeId: 'a', title: 'Alpha', channelName: 'C', channelId: null,
          duration: null, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' as const,
        },
      ];
      render(<ResultsGrid {...baseProps} hasSearched viewMode="table" results={results} onResultClick={onResultClick} />);
      expect(screen.getByTestId('results-list-mobile')).toBeInTheDocument();
      expect(screen.queryByTestId('results-table')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('card-mobile-a'));
      expect(onResultClick).toHaveBeenCalledWith(results[0]);
    });
  });
});
