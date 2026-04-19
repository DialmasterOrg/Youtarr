import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ResultsTable from '../ResultsTable';
import { SearchResult } from '../../types';

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    youtubeId: 'abc12345678',
    title: 'Default Title',
    channelName: 'Default Channel',
    channelId: null,
    duration: null,
    thumbnailUrl: null,
    publishedAt: null,
    viewCount: null,
    status: 'never_downloaded',
    ...overrides,
  };
}

describe('ResultsTable', () => {
  test('renders one row per result with title and channel', () => {
    const results = [
      makeResult({ youtubeId: 'a', title: 'Alpha', channelName: 'Chan A' }),
      makeResult({ youtubeId: 'b', title: 'Bravo', channelName: 'Chan B' }),
    ];
    render(<ResultsTable results={results} onResultClick={() => {}} />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Chan A')).toBeInTheDocument();
    expect(screen.getByText('Chan B')).toBeInTheDocument();
  });

  test('clicking a row invokes onResultClick with that result', () => {
    const onResultClick = jest.fn();
    const results = [makeResult({ youtubeId: 'x', title: 'Pick me' })];
    render(<ResultsTable results={results} onResultClick={onResultClick} />);
    const row = screen.getByRole('row', { name: /open pick me/i });
    fireEvent.click(row);
    expect(onResultClick).toHaveBeenCalledWith(results[0]);
  });

  test('shows N/A when publishedAt is null and - when duration is null', () => {
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha' })];
    render(<ResultsTable results={results} onResultClick={() => {}} />);
    const row = screen.getByRole('row', { name: /open alpha/i });
    expect(within(row).getByText('N/A')).toBeInTheDocument();
    expect(within(row).getByText('-')).toBeInTheDocument();
  });

  test('formats duration as m:ss when under an hour and h:mm:ss otherwise', () => {
    const results = [
      makeResult({ youtubeId: 'short', title: 'Short', duration: 125 }),
      makeResult({ youtubeId: 'long', title: 'Long', duration: 3723 }),
    ];
    render(<ResultsTable results={results} onResultClick={() => {}} />);
    const shortRow = screen.getByRole('row', { name: /open short/i });
    const longRow = screen.getByRole('row', { name: /open long/i });
    expect(within(shortRow).getByText('2:05')).toBeInTheDocument();
    expect(within(longRow).getByText('1:02:03')).toBeInTheDocument();
  });
});
