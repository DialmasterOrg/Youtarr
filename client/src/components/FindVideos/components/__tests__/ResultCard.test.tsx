import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultCard from '../ResultCard';
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

function renderCard(result: SearchResult, props: Partial<React.ComponentProps<typeof ResultCard>> = {}) {
  return render(
    <MemoryRouter>
      <ResultCard result={result} onClick={() => {}} {...props} />
    </MemoryRouter>
  );
}

describe('ResultCard', () => {
  test('clicking the card opens it', () => {
    const onClick = jest.fn();
    renderCard(makeResult({ title: 'Pick me' }), { onClick });
    fireEvent.click(screen.getByRole('button', { name: /open pick me/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('shows the relative date, view count, and Short badge', () => {
    const publishedAt = new Date(Date.now() - 400 * 86_400_000).toISOString();
    renderCard(makeResult({ publishedAt, viewCount: 850, duration: 59 }));
    expect(screen.getByText('1 year ago')).toBeInTheDocument();
    expect(screen.getByText('850')).toBeInTheDocument();
    expect(screen.getByText('Short')).toBeInTheDocument();
  });

  test('shows no status chip when never downloaded, and one when downloaded', () => {
    const { rerender } = renderCard(makeResult());
    expect(screen.queryByText('Not Downloaded')).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <ResultCard result={makeResult({ status: 'downloaded' })} onClick={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText('Downloaded')).toBeInTheDocument();
  });

  test('the download button queues the video without opening the card', () => {
    const onClick = jest.fn();
    const onDownloadOne = jest.fn();
    const result = makeResult({ title: 'Alpha' });
    renderCard(result, { onClick, onDownloadOne });
    fireEvent.click(screen.getByRole('button', { name: 'Download Alpha' }));
    expect(onDownloadOne).toHaveBeenCalledWith(result);
    expect(onClick).not.toHaveBeenCalled();
  });
});
