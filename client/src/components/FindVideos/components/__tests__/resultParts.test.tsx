import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  DownloadButton,
  PublishedDate,
  ResultChannel,
  ResultStatusChip,
  ShortBadge,
  ViewCount,
} from '../resultParts';
import { SearchResult } from '../../types';

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    youtubeId: 'abc12345678',
    title: 'Default Title',
    channelName: 'Chan',
    channelId: null,
    duration: null,
    thumbnailUrl: null,
    publishedAt: null,
    viewCount: null,
    status: 'never_downloaded',
    ...overrides,
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

describe('ResultStatusChip', () => {
  test('renders nothing for a video that was never downloaded', () => {
    const { container } = render(<ResultStatusChip status="never_downloaded" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('labels every other state', () => {
    render(<ResultStatusChip status="downloaded" />);
    expect(screen.getByText('Downloaded')).toBeInTheDocument();
  });
});

describe('ResultChannel', () => {
  test('links a subscribed channel to its page and marks it Subscribed', () => {
    render(
      <MemoryRouter>
        <ResultChannel result={makeResult({ channelId: 'UC1', channelSubscribed: true })} variant="body2" onAddChannel={jest.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Chan' })).toHaveAttribute('href', '/channel/UC1');
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
  });

  test('offers to add an unsubscribed channel', () => {
    const onAddChannel = jest.fn();
    render(
      <MemoryRouter>
        <ResultChannel result={makeResult({ channelId: 'UC1', channelSubscribed: false })} variant="body2" onAddChannel={onAddChannel} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /chan/i }));
    expect(onAddChannel).toHaveBeenCalledWith('Chan', 'https://www.youtube.com/channel/UC1');
    expect(screen.queryByText('Subscribed')).not.toBeInTheDocument();
  });

  test('shows a plain name when the channel id is unknown', () => {
    render(
      <MemoryRouter>
        <ResultChannel result={makeResult({ channelId: null })} variant="body2" onAddChannel={jest.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Chan')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('PublishedDate', () => {
  test('shows the date relative to today with the exact date as its tooltip', () => {
    const publishedAt = daysAgo(3);
    render(<PublishedDate publishedAt={publishedAt} />);
    const label = screen.getByText('3 days ago');
    expect(label).toHaveAttribute('title', new Date(publishedAt).toLocaleDateString());
  });

  test('shows the fallback when the date is unknown', () => {
    render(<PublishedDate publishedAt={null} fallback="N/A" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});

describe('ViewCount', () => {
  test('abbreviates the count', () => {
    render(<ViewCount viewCount={554_299} />);
    expect(screen.getByText('554.3K')).toBeInTheDocument();
    expect(screen.getByTitle('554,299 views')).toBeInTheDocument();
  });

  test('renders nothing when the count is unknown', () => {
    const { container } = render(<ViewCount viewCount={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ShortBadge', () => {
  test('marks videos of a minute or less as Shorts', () => {
    render(<ShortBadge duration={60} />);
    expect(screen.getByText('Short')).toBeInTheDocument();
  });

  test('renders nothing for longer videos or an unknown length', () => {
    const { container, rerender } = render(<ShortBadge duration={61} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ShortBadge duration={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DownloadButton', () => {
  test('asks to download the video without opening it', () => {
    const onDownload = jest.fn();
    const onOpen = jest.fn();
    const result = makeResult({ title: 'Pick me' });
    render(
      <div onClick={onOpen}>
        <DownloadButton result={result} onDownload={onDownload} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download Pick me' }));
    expect(onDownload).toHaveBeenCalledWith(result);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
