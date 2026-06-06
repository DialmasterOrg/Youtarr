import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
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

describe('FindVideos page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTriggerDownloads.mockResolvedValue(true);
    mockMatchMedia(false);
    window.localStorage.clear();
  });

  test('submitting a search renders results', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [{
        youtubeId: 'abc12345678', title: 'Hello World', channelName: 'Chan',
        channelId: null, duration: 120, thumbnailUrl: null, publishedAt: null,
        viewCount: null, status: 'never_downloaded',
      }] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('Hello World')).toBeInTheDocument();
  });

  test('clicking a result opens the VideoModal', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [{
        youtubeId: 'abc12345678', title: 'Pick me', channelName: 'Chan',
        channelId: null, duration: 120, thumbnailUrl: null, publishedAt: null,
        viewCount: null, status: 'never_downloaded',
      }] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Pick me')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open pick me/i }));
    expect(screen.getByTestId('mock-video-modal')).toHaveTextContent('Pick me');
  });

  test('applies persisted minimum duration filter and shows "X of Y" count', async () => {
    window.localStorage.setItem('findVideos.minDuration', '60');
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'short000001', title: 'Tiny Short', channelName: 'C', channelId: null, duration: 30, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        { youtubeId: 'long0000001', title: 'Long Video', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('Long Video')).toBeInTheDocument();
    expect(screen.queryByText('Tiny Short')).not.toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 2 results/i)).toBeInTheDocument();
  });

  test('shows a filter-aware empty message when filter hides everything', async () => {
    window.localStorage.setItem('findVideos.minDuration', '1200');
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'short000001', title: 'Short A', channelName: 'C', channelId: null, duration: 30, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        { youtubeId: 'short000002', title: 'Short B', channelName: 'C', channelId: null, duration: 45, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
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
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'unknownmeta', title: 'Unknown duration', channelName: 'C', channelId: null, duration: null, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        { youtubeId: 'short000001', title: 'Tiny', channelName: 'C', channelId: null, duration: 10, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('Unknown duration')).toBeInTheDocument();
    expect(screen.queryByText('Tiny')).not.toBeInTheDocument();
  });

  test('eligible videos render a select checkbox; downloaded videos do not', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'never000001', title: 'Never', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        { youtubeId: 'missing0001', title: 'Missing', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'missing' },
        { youtubeId: 'downloaded1', title: 'Done', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'downloaded' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Never')).toBeInTheDocument();

    expect(screen.getByTestId('select-never000001')).toBeInTheDocument();
    expect(screen.getByTestId('select-missing0001')).toBeInTheDocument();
    expect(screen.queryByTestId('select-downloaded1')).not.toBeInTheDocument();
  });

  test('selecting eligible videos and confirming dialog calls triggerDownloads with URLs', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'never000001', title: 'Never', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        { youtubeId: 'missing0001', title: 'Missing', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'missing' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Never');

    fireEvent.click(screen.getByTestId('select-never000001'));
    fireEvent.click(screen.getByTestId('select-missing0001'));

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

  test('failed download queue keeps selection and shows an error', async () => {
    mockTriggerDownloads.mockResolvedValueOnce(false);
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'never000001', title: 'Never', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Never');

    fireEvent.click(screen.getByTestId('select-never000001'));
    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));
    fireEvent.click(await screen.findByTestId('dialog-confirm'));

    expect(await screen.findByText(/failed to queue selected videos/i)).toBeInTheDocument();
    expect(screen.getByTestId('video-list-selection-pill')).toBeInTheDocument();
  });

  test('selected hidden missing videos still count as missing in the download dialog', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'missing0001', title: 'Missing', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'missing' },
        { youtubeId: 'long0000001', title: 'Long', channelName: 'C', channelId: null, duration: 1800, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByTestId('select-missing0001');

    fireEvent.click(screen.getByTestId('select-missing0001'));
    fireEvent.mouseDown(screen.getByText('Any length'));
    fireEvent.click(await screen.findByText('20+ min'));

    expect(screen.queryByTestId('select-missing0001')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('video-list-selection-pill'));
    fireEvent.click(await screen.findByTestId('selection-menu-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-missing-count')).toHaveTextContent('1');
  });

  test('mobile selection action opens the download dialog', async () => {
    mockMatchMedia(true);
    axios.post.mockResolvedValueOnce({
      data: { results: [
        { youtubeId: 'never000001', title: 'Never', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
      ] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'q' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Never');

    fireEvent.click(screen.getByTestId('select-mobile-never000001'));
    fireEvent.click(screen.getByTestId('selection-action-download'));

    expect(await screen.findByTestId('mock-download-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-video-count')).toHaveTextContent('1');
  });

  test('starting a new search clears prior selection so stale ids cannot be downloaded', async () => {
    axios.post
      .mockResolvedValueOnce({
        data: { results: [
          { youtubeId: 'first0000001', title: 'First', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        ] },
      })
      .mockResolvedValueOnce({
        data: { results: [
          { youtubeId: 'second000001', title: 'Second', channelName: 'C', channelId: null, duration: 600, thumbnailUrl: null, publishedAt: null, viewCount: null, status: 'never_downloaded' },
        ] },
      });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'one' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('First');
    fireEvent.click(screen.getByTestId('select-first0000001'));
    expect(screen.getByTestId('video-list-selection-pill')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'two' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    await screen.findByText('Second');

    expect(screen.queryByTestId('video-list-selection-pill')).not.toBeInTheDocument();
  });

  test('toggling to Table View switches results to a table and row click opens modal', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [{
        youtubeId: 'abc12345678', title: 'Row Pick', channelName: 'Chan',
        channelId: null, duration: 120, thumbnailUrl: null, publishedAt: null,
        viewCount: null, status: 'never_downloaded',
      }] },
    });

    renderWithRouter(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Row Pick')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /table view/i }));
    const row = screen.getByRole('row', { name: /open row pick/i });
    fireEvent.click(row);
    expect(screen.getByTestId('mock-video-modal')).toHaveTextContent('Row Pick');
  });
});
