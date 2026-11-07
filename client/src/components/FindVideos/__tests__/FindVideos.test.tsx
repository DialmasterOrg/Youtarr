// Local metadata refresh is covered by the hook tests; isolate action/search requests here.
const mockLocalStatus = jest.fn((): Record<string, unknown> => ({}));
jest.mock('../../../hooks/useLocalVideoStatus', () => ({
  useLocalVideoStatus: () => mockLocalStatus(),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

jest.mock('axios', () => ({
  post: jest.fn(),
  isCancel: (err: unknown) => Boolean(err && (err as { name?: string }).name === 'CanceledError'),
  CanceledError: class CanceledError extends Error {
    constructor() { super('canceled'); this.name = 'CanceledError'; }
  },
}));

jest.mock('../../shared/VideoModal', () => ({
  __esModule: true,
  default: function MockVideoModal(props: { open: boolean; video: { title: string } }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'mock-video-modal' }, props.video.title);
  },
}));

jest.mock('../../shared/AddChannelDialog', () => ({
  __esModule: true,
  default: function MockAddChannelDialog(props: { open: boolean; channelName: string }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'mock-add-channel-dialog' }, props.channelName);
  },
}));

jest.mock('../../../hooks/useConfig', () => ({
  useConfig: () => ({ config: { preferredResolution: '1080' } }),
}));

const mockTriggerDownloads = jest.fn().mockResolvedValue(true);
jest.mock('../../../hooks/useTriggerDownloads', () => ({
  useTriggerDownloads: () => ({ triggerDownloads: mockTriggerDownloads, loading: false, error: null }),
}));

jest.mock('../../DownloadManager/ManualDownload/DownloadSettingsDialog', () => ({
  __esModule: true,
  default: function MockDownloadDialog(props: {
    open: boolean;
    onConfirm: (s: null) => void;
    onClose: () => void;
    videoCount?: number;
    missingVideoCount?: number;
  }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement(
      'div',
      { 'data-testid': 'mock-download-dialog' },
      React.createElement('div', { 'data-testid': 'dialog-video-count' }, String(props.videoCount ?? 0)),
      React.createElement('div', { 'data-testid': 'dialog-missing-count' }, String(props.missingVideoCount ?? 0)),
      React.createElement(
        'button',
        { onClick: () => props.onConfirm(null), 'data-testid': 'dialog-confirm' },
        'Confirm'
      ),
      React.createElement('button', { onClick: props.onClose, 'data-testid': 'dialog-close' }, 'Close')
    );
  },
}));

const axios = require('axios');
const FindVideos = require('../index').default;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderWithRouter(ui: React.ReactElement, initialEntries: string[] = ['/videos/find']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
      <LocationProbe />
    </MemoryRouter>
  );
}

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    youtubeId: 'abc12345678', title: 'Hello World', channelName: 'Chan',
    channelId: null, duration: 120, thumbnailUrl: null, publishedAt: null,
    viewCount: null, status: 'never_downloaded',
    ...overrides,
  };
}

async function searchFor(query: string, resultsData: Record<string, unknown>[]) {
  axios.post.mockResolvedValueOnce({ data: { results: resultsData } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: query } });
  fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
  await screen.findByText(String(resultsData[0].title));
}

const rowTitles = () =>
  screen.getAllByRole('row', { name: /^open /i }).map((row) => row.getAttribute('aria-label')!.replace('Open ', ''));

describe('FindVideos page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTriggerDownloads.mockResolvedValue(true);
    mockLocalStatus.mockReturnValue({});
    mockMatchMedia(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test('submitting a search renders results', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('hello', [result({ title: 'Hello World' })]);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  test('results open in a table by default on desktop; a row click opens the modal', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('x', [result({ title: 'Row Pick' })]);

    fireEvent.click(screen.getByRole('row', { name: /open row pick/i }));
    expect(screen.getByTestId('mock-video-modal')).toHaveTextContent('Row Pick');
  });

  test('Grid View switches to cards and the choice is remembered', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('x', [result({ title: 'Card Pick' })]);

    fireEvent.click(screen.getByRole('button', { name: /grid view/i }));
    expect(screen.queryByRole('row', { name: /open card pick/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open card pick/i }));
    expect(screen.getByTestId('mock-video-modal')).toHaveTextContent('Card Pick');
    expect(window.localStorage.getItem('findVideos.viewMode')).toBe('grid');
  });

  test('puts the query in the URL once a search runs', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('hello world', [result()]);
    expect(screen.getByTestId('location-search')).toHaveTextContent('?q=hello+world');
  });

  test('restores the remembered results when opened with their query in the URL', async () => {
    window.sessionStorage.setItem('findVideos.lastSearch', JSON.stringify({
      query: 'minecraft', count: 50, results: [result({ title: 'Cached result' })],
    }));
    renderWithRouter(<FindVideos token="t" />, ['/videos/find?q=minecraft']);

    expect(await screen.findByText('Cached result')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('minecraft');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('runs the search from the URL when nothing is remembered for it', async () => {
    axios.post.mockResolvedValueOnce({ data: { results: [result({ title: 'Fresh result' })] } });
    renderWithRouter(<FindVideos token="t" />, ['/videos/find?q=terraria']);

    expect(await screen.findByText('Fresh result')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith('/api/videos/search', { query: 'terraria', count: 25 }, expect.anything());
    expect(screen.getByRole('textbox')).toHaveValue('terraria');
  });

  test('clicking a column header sorts, clicking again flips, a third click restores relevance', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('x', [
      result({ youtubeId: 'few00000001', title: 'Few views', viewCount: 10 }),
      result({ youtubeId: 'many0000001', title: 'Many views', viewCount: 1000 }),
    ]);
    expect(rowTitles()).toEqual(['Few views', 'Many views']);

    const viewsHeader = () => screen.getByRole('button', { name: /^views$/i });
    fireEvent.click(viewsHeader());
    expect(rowTitles()).toEqual(['Many views', 'Few views']);
    fireEvent.click(viewsHeader());
    expect(rowTitles()).toEqual(['Few views', 'Many views']);
    expect(screen.getByRole('columnheader', { name: /views/i })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(viewsHeader());
    expect(screen.getByRole('columnheader', { name: /views/i })).not.toHaveAttribute('aria-sort');
    expect(JSON.parse(window.localStorage.getItem('findVideos.sort') ?? '')).toEqual({ key: 'relevance', direction: 'desc' });
  });

  test('the sort menu orders cards in grid view', async () => {
    window.localStorage.setItem('findVideos.viewMode', 'grid');
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('x', [
      result({ youtubeId: 'old00000001', title: 'Older', publishedAt: '2020-01-01T00:00:00Z' }),
      result({ youtubeId: 'new00000001', title: 'Newer', publishedAt: '2025-01-01T00:00:00Z' }),
    ]);

    fireEvent.click(screen.getByTestId('video-list-sort-button'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /published/i }));

    const cards = screen.getAllByRole('button', { name: /^open /i });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Open Newer', 'Open Older']);
  });

  test('applies persisted minimum duration filter and shows "X of Y" count', async () => {
    window.localStorage.setItem('findVideos.minDuration', '60');
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'long0000001', title: 'Long Video', duration: 600 }),
      result({ youtubeId: 'short000001', title: 'Tiny Short', duration: 30 }),
    ]);

    expect(screen.queryByText('Tiny Short')).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 2 results/i)).toBeInTheDocument();
  });

  test('shows a filter-aware empty message when filter hides everything', async () => {
    window.localStorage.setItem('findVideos.minDuration', '1200');
    axios.post.mockResolvedValueOnce({
      data: { results: [
        result({ youtubeId: 'short000001', title: 'Short A', duration: 30 }),
        result({ youtubeId: 'short000002', title: 'Short B', duration: 45 }),
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText(/all 2 results were hidden/i)).toBeInTheDocument();
    expect(screen.queryByText('Short A')).not.toBeInTheDocument();
    expect(screen.queryByText(/no videos found for/i)).not.toBeInTheDocument();
  });

  test('keeps results with null duration even when filter is active', async () => {
    window.localStorage.setItem('findVideos.minDuration', '60');
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'unknownmeta', title: 'Unknown duration', duration: null }),
      result({ youtubeId: 'short000001', title: 'Tiny', duration: 10 }),
    ]);
    expect(screen.queryByText('Tiny')).not.toBeInTheDocument();
  });

  test('eligible videos render a select checkbox; downloaded videos do not', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'never000001', title: 'Never', duration: 600 }),
      result({ youtubeId: 'missing0001', title: 'Missing', duration: 600, status: 'missing' }),
      result({ youtubeId: 'downloaded1', title: 'Done', duration: 600, status: 'downloaded' }),
    ]);

    expect(screen.getByTestId('select-row-never000001')).toBeInTheDocument();
    expect(screen.getByTestId('select-row-missing0001')).toBeInTheDocument();
    expect(screen.queryByTestId('select-row-downloaded1')).not.toBeInTheDocument();
  });

  test('a video Youtarr deleted is selectable and counts as previously downloaded', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'deleted0001', title: 'Gone video', duration: 600, status: 'deleted', removedReason: 'user_deleted' }),
    ]);

    fireEvent.click(screen.getByTestId('select-row-deleted0001'));
    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-missing-count')).toHaveTextContent('1');
  });

  test('selecting eligible videos and confirming dialog calls triggerDownloads with URLs', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'never000001', title: 'Never', duration: 600 }),
      result({ youtubeId: 'missing0001', title: 'Missing', duration: 600, status: 'missing' }),
    ]);

    fireEvent.click(screen.getByTestId('select-row-never000001'));
    fireEvent.click(screen.getByTestId('select-row-missing0001'));

    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-video-count')).toHaveTextContent('2');
    expect(screen.getByTestId('dialog-missing-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(mockTriggerDownloads).toHaveBeenCalledTimes(1));
    expect(mockTriggerDownloads).toHaveBeenCalledWith({
      urls: [
        'https://www.youtube.com/watch?v=never000001',
        'https://www.youtube.com/watch?v=missing0001',
      ],
      overrideSettings: undefined,
    });
  });

  test('the row download button queues that one video and leaves the selection alone', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'first000001', title: 'First', duration: 600 }),
      result({ youtubeId: 'second00001', title: 'Second', duration: 600 }),
      result({ youtubeId: 'third000001', title: 'Third', duration: 600 }),
    ]);

    fireEvent.click(screen.getByTestId('select-row-first000001'));
    fireEvent.click(screen.getByTestId('select-row-second00001'));
    fireEvent.click(screen.getByRole('button', { name: 'Download Third' }));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-video-count')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('dialog-confirm'));

    await waitFor(() => expect(mockTriggerDownloads).toHaveBeenCalledTimes(1));
    expect(mockTriggerDownloads).toHaveBeenCalledWith({
      urls: ['https://www.youtube.com/watch?v=third000001'],
      overrideSettings: undefined,
    });
    expect(screen.getByTestId('video-list-selection-pill')).toBeInTheDocument();
  });

  test('failed download queue keeps selection and shows an error', async () => {
    mockTriggerDownloads.mockResolvedValueOnce(false);
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [result({ youtubeId: 'never000001', title: 'Never', duration: 600 })]);

    fireEvent.click(screen.getByTestId('select-row-never000001'));
    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));
    fireEvent.click(await screen.findByTestId('dialog-confirm'));

    expect(await screen.findByText(/failed to queue selected videos/i)).toBeInTheDocument();
    expect(screen.getByTestId('video-list-selection-pill')).toBeInTheDocument();
  });

  test('selected hidden missing videos still count as missing in the download dialog', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'missing0001', title: 'Gone from disk', duration: 600, status: 'missing' }),
      result({ youtubeId: 'long0000001', title: 'Long', duration: 1800 }),
    ]);

    fireEvent.click(screen.getByTestId('select-row-missing0001'));
    fireEvent.mouseDown(screen.getByText('Any length'));
    fireEvent.click(await screen.findByText('20+ min'));

    expect(screen.queryByTestId('select-row-missing0001')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-missing-count')).toHaveTextContent('1');
  });

  test('a selected never-downloaded video in the download archive counts as missing in the download dialog', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [
      result({ youtubeId: 'archived001', title: 'Archived', duration: 600, inArchive: true }),
      result({ youtubeId: 'never000001', title: 'Never', duration: 600, inArchive: false }),
    ]);

    fireEvent.click(screen.getByTestId('select-row-archived001'));
    fireEvent.click(screen.getByTestId('select-row-never000001'));
    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-missing-count')).toHaveTextContent('1');
  });

  test('keeps the Subscribed marker from the search when the local status refresh answers without it', async () => {
    mockLocalStatus.mockReturnValue({
      abc12345678: { youtubeId: 'abc12345678', status: 'never_downloaded', inArchive: false },
    });
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [result({ title: 'Subscribed video', channelId: 'UC1', channelSubscribed: true })]);

    const row = screen.getByRole('row', { name: /open subscribed video/i });
    expect(within(row).getByText('Subscribed')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Chan' })).toHaveAttribute('href', '/channel/UC1');
  });

  test('clicking an unsubscribed channel name offers to add the channel', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [result({ title: 'New channel video', channelId: 'UC2', channelSubscribed: false })]);

    fireEvent.click(screen.getByRole('button', { name: 'Chan' }));
    expect(screen.getByTestId('mock-add-channel-dialog')).toHaveTextContent('Chan');
    expect(screen.queryByTestId('mock-video-modal')).not.toBeInTheDocument();
  });

  test('mobile selection action opens the download dialog', async () => {
    mockMatchMedia(true);
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('q', [result({ youtubeId: 'never000001', title: 'Never', duration: 600 })]);

    fireEvent.click(screen.getByTestId('select-mobile-never000001'));
    fireEvent.click(screen.getByTestId('selection-action-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-video-count')).toHaveTextContent('1');
  });

  test('mobile shows the sort menu even in the list layout', async () => {
    mockMatchMedia(true);
    renderWithRouter(<FindVideos token="t" />);
    expect(screen.getByTestId('video-list-sort-button')).toBeInTheDocument();
  });

  test('starting a new search clears prior selection so stale ids cannot be downloaded', async () => {
    renderWithRouter(<FindVideos token="t" />);
    await searchFor('one', [result({ youtubeId: 'first0000001', title: 'First', duration: 600 })]);
    fireEvent.click(screen.getByTestId('select-row-first0000001'));
    expect(screen.getByTestId('video-list-selection-pill')).toBeInTheDocument();

    await searchFor('two', [result({ youtubeId: 'second000001', title: 'Second', duration: 600 })]);

    expect(screen.queryByTestId('video-list-selection-pill')).not.toBeInTheDocument();
  });
});
