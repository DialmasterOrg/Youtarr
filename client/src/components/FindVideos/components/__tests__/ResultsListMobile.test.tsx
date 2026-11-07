import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ResultsListMobile from '../ResultsListMobile';
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

describe('ResultsListMobile', () => {
  test('renders one card per result with title and channel', () => {
    const results = [
      makeResult({ youtubeId: 'a', title: 'Alpha', channelName: 'Chan A' }),
      makeResult({ youtubeId: 'b', title: 'Bravo', channelName: 'Chan B' }),
    ];
    render(<ResultsListMobile results={results} onResultClick={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Chan A')).toBeInTheDocument();
    expect(screen.getByText('Chan B')).toBeInTheDocument();
  });

  test('clicking a card invokes onResultClick with that result', () => {
    const onResultClick = jest.fn();
    const results = [makeResult({ youtubeId: 'x', title: 'Pick me' })];
    render(<ResultsListMobile results={results} onResultClick={onResultClick} />);
    const card = screen.getByRole('button', { name: /open pick me/i });
    fireEvent.click(card);
    expect(onResultClick).toHaveBeenCalledWith(results[0]);
  });

  test('pressing Enter or Space on a card invokes onResultClick', () => {
    const onResultClick = jest.fn();
    const results = [makeResult({ youtubeId: 'x', title: 'Pick me' })];
    render(<ResultsListMobile results={results} onResultClick={onResultClick} />);
    const card = screen.getByRole('button', { name: /open pick me/i });
    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onResultClick).toHaveBeenCalledTimes(2);
    expect(onResultClick).toHaveBeenLastCalledWith(results[0]);
  });

  test('other keys do not invoke onResultClick', () => {
    const onResultClick = jest.fn();
    const results = [makeResult({ youtubeId: 'x', title: 'Pick me' })];
    render(<ResultsListMobile results={results} onResultClick={onResultClick} />);
    const card = screen.getByRole('button', { name: /open pick me/i });
    fireEvent.keyDown(card, { key: 'Tab' });
    fireEvent.keyDown(card, { key: 'a' });
    expect(onResultClick).not.toHaveBeenCalled();
  });

  test('renders clock-style duration overlay when duration is set', () => {
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha', duration: 3723 })];
    render(<ResultsListMobile results={results} onResultClick={() => {}} />);
    const card = screen.getByRole('button', { name: /open alpha/i });
    expect(within(card).getByText('1:02:03')).toBeInTheDocument();
  });

  test('omits duration overlay when duration is null', () => {
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha', duration: null })];
    render(<ResultsListMobile results={results} onResultClick={() => {}} />);
    const card = screen.getByRole('button', { name: /open alpha/i });
    expect(within(card).queryByText('-')).not.toBeInTheDocument();
  });

  test('shows the relative date, view count, and Short badge in the meta line', () => {
    const publishedAt = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha', publishedAt, viewCount: 2_000_000, duration: 30 })];
    render(<ResultsListMobile results={results} onResultClick={() => {}} />);
    const card = screen.getByRole('button', { name: /open alpha/i });
    expect(within(card).getByText('2 weeks ago')).toBeInTheDocument();
    expect(within(card).getByText('2M')).toBeInTheDocument();
    expect(within(card).getByText('Short')).toBeInTheDocument();
  });

  test('shows no Not Downloaded chip', () => {
    render(<ResultsListMobile results={[makeResult()]} onResultClick={() => {}} />);
    expect(screen.queryByText('Not Downloaded')).not.toBeInTheDocument();
  });

  test('the download button queues the video without opening it', () => {
    const onDownloadOne = jest.fn();
    const onResultClick = jest.fn();
    const results = [makeResult({ youtubeId: 'a', title: 'Alpha' })];
    render(<ResultsListMobile results={results} onResultClick={onResultClick} onDownloadOne={onDownloadOne} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Alpha' }));
    expect(onDownloadOne).toHaveBeenCalledWith(results[0]);
    expect(onResultClick).not.toHaveBeenCalled();
  });
});
