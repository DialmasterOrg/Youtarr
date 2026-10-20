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

  test('shows N/A when publishedAt is null and - when duration and views are null', () => {
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha' })];
    render(<ResultsTable results={results} onResultClick={() => {}} />);
    const row = screen.getByRole('row', { name: /open alpha/i });
    expect(within(row).getByText('N/A')).toBeInTheDocument();
    expect(within(row).getAllByText('-')).toHaveLength(2);
  });

  test('shows the published date relative to today and the view count abbreviated', () => {
    const publishedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha', publishedAt, viewCount: 12_500 })];
    render(<ResultsTable results={results} onResultClick={() => {}} />);
    const row = screen.getByRole('row', { name: /open alpha/i });
    expect(within(row).getByText('3 days ago')).toBeInTheDocument();
    expect(within(row).getByText('12.5K')).toBeInTheDocument();
  });

  test('clicking a column header asks to sort by that column', () => {
    const onSortChange = jest.fn();
    render(<ResultsTable results={[makeResult()]} onResultClick={() => {}} onSortChange={onSortChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^views$/i }));
    expect(onSortChange).toHaveBeenCalledWith('views');
  });

  test('marks the active column with its direction', () => {
    render(
      <ResultsTable
        results={[makeResult()]}
        onResultClick={() => {}}
        sort={{ key: 'published', direction: 'asc' }}
        onSortChange={() => {}}
      />
    );
    expect(screen.getByRole('columnheader', { name: /published/i })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: /views/i })).not.toHaveAttribute('aria-sort');
  });

  test('shows no status chip for a never-downloaded row but does for a downloaded one', () => {
    const results = [
      makeResult({ youtubeId: 'new', title: 'New', status: 'never_downloaded' }),
      makeResult({ youtubeId: 'have', title: 'Have', status: 'downloaded' }),
    ];
    render(<ResultsTable results={results} onResultClick={() => {}} />);
    expect(screen.queryByText('Not Downloaded')).not.toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /open have/i })).getByText('Downloaded')).toBeInTheDocument();
  });

  test('the row download button queues that video without opening the row', () => {
    const onDownloadOne = jest.fn();
    const onResultClick = jest.fn();
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha' })];
    render(<ResultsTable results={results} onResultClick={onResultClick} onDownloadOne={onDownloadOne} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Alpha' }));
    expect(onDownloadOne).toHaveBeenCalledWith(results[0]);
    expect(onResultClick).not.toHaveBeenCalled();
  });

  test('offers no download button for a video already downloaded', () => {
    render(
      <ResultsTable
        results={[makeResult({ title: 'Have', status: 'downloaded' })]}
        onResultClick={() => {}}
        onDownloadOne={jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'Download Have' })).not.toBeInTheDocument();
  });

  test('marks a Short', () => {
    render(<ResultsTable results={[makeResult({ title: 'Tiny', duration: 45 })]} onResultClick={() => {}} />);
    expect(within(screen.getByRole('row', { name: /open tiny/i })).getByText('Short')).toBeInTheDocument();
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

test.each(['queued', 'downloading'] as const)('shows %s without a download checkbox', (status) => {
  const toggle = jest.fn();
  render(<ResultsTable
    results={[makeResult({ status })]}
    onResultClick={jest.fn()}
    selection={{ isChecked: () => true, toggle }}
  />);
  expect(screen.getByText(status === 'queued' ? 'Queued…' : 'Downloading…')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
