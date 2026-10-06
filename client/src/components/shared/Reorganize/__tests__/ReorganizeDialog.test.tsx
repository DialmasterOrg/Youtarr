import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ReorganizeDialog from '../ReorganizeDialog';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean => typeof err === 'object' && err !== null && 'response' in err,
}));

const axios = require('axios');

const CHANGE = { type: 'channelLayout' as const, channelId: 'UC1', layout: 'tv' as const };
const PREVIEW = {
  revision: 'rev',
  needed: true,
  change: { type: 'channel', channelId: 'UC1', subFolder: 'TV', label: 'Chan' },
  totals: {
    videos: 2, toTv: 2, toVideos: 0, betweenFolders: 0, unchanged: 0, missing: 0, collisions: 0, noName: 0, noDate: 0,
    overridePlaced: 0, adopted: 0, uploadDateOnly: 0, downloadTime: 0, movieTags: 0, audioToTv: 0,
  },
  shows: [],
  items: [],
  problems: [],
  watchState: [],
  blocked: null,
};

function renderDialog(props: Partial<React.ComponentProps<typeof ReorganizeDialog>> = {}) {
  const onClose = jest.fn();
  const onApplied = jest.fn();
  render(<ReorganizeDialog open token="token" change={CHANGE} onClose={onClose} onApplied={onApplied} {...props} />);
  return { onClose, onApplied, user: userEvent.setup() };
}

describe('ReorganizeDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('previews the change and starts it with the preview\'s revision', async () => {
    axios.post.mockImplementation(async (url: string) => (url === '/api/tv/reorganize/preview'
      ? { data: PREVIEW }
      : { data: { operationId: 3, applied: false } }));
    axios.get.mockResolvedValue({ data: { id: 3, label: 'Chan', status: 'running', total: 2, done: 0, failed: 0 } });
    const { onApplied, user } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Move 2 videos' }));

    expect(axios.post).toHaveBeenCalledWith('/api/tv/reorganize', { change: CHANGE, revision: 'rev' }, { headers: { 'x-access-token': 'token' } });
    expect(onApplied).toHaveBeenCalledWith({ operationId: 3, applied: false });
    expect(await screen.findByText('Moving videos for Chan: 0 of 2.')).toBeInTheDocument();
  });

  test('can\'t start while something blocks the move', async () => {
    axios.post.mockResolvedValueOnce({ data: { ...PREVIEW, blocked: { reason: 'download-running', message: 'Wait for the download.' } } });
    renderDialog();

    expect(await screen.findByRole('button', { name: 'Move 2 videos' })).toBeDisabled();
  });

  test('closes after applying a change with nothing to move', async () => {
    axios.post.mockImplementation(async (url: string) => (url === '/api/tv/reorganize/preview'
      ? { data: { ...PREVIEW, needed: false } }
      : { data: { operationId: null, applied: true } }));
    const { onApplied, onClose, user } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onApplied).toHaveBeenCalledWith({ operationId: null, applied: true });
  });

  test('previews again when the preview went stale', async () => {
    axios.post
      .mockResolvedValueOnce({ data: PREVIEW })
      .mockRejectedValueOnce({ response: { status: 409, data: { error: 'Files changed since the preview.', code: 'STALE_PREVIEW' } } })
      .mockResolvedValueOnce({ data: { ...PREVIEW, revision: 'rev2' } });
    const { user } = renderDialog();

    await user.click(await screen.findByRole('button', { name: 'Move 2 videos' }));

    expect(await screen.findByText('Files changed since the preview.')).toBeInTheDocument();
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(3));
  });

  test('tells the parent when a retry of the shown operation starts', async () => {
    axios.get.mockResolvedValue({ data: {
      id: 7, label: 'Chan', status: 'partial', total: 2, done: 1, failed: 1,
      failedItems: [{ id: 1, youtubeId: 'a1', title: 'First', channelId: 'UC1', error: 'EEXIST' }],
    } });
    axios.post.mockResolvedValueOnce({ data: { operationId: 7 } });
    const onRetried = jest.fn();
    const { user } = renderDialog({ change: null, operationId: 7, onRetried });

    await user.click(await screen.findByRole('button', { name: 'Retry these videos' }));

    await waitFor(() => expect(onRetried).toHaveBeenCalledWith(7));
  });

  test('does not report a refused retry as started', async () => {
    axios.get.mockResolvedValue({ data: {
      id: 7, label: 'Chan', status: 'partial', total: 2, done: 1, failed: 1,
      failedItems: [{ id: 1, youtubeId: 'a1', title: 'First', channelId: 'UC1', error: 'EEXIST' }],
    } });
    axios.post.mockRejectedValueOnce({ response: { status: 409, data: { error: 'A download is running.' } } });
    const onRetried = jest.fn();
    const { user } = renderDialog({ change: null, operationId: 7, onRetried });

    await user.click(await screen.findByRole('button', { name: 'Retry these videos' }));

    expect(await screen.findByText('A download is running.')).toBeInTheDocument();
    expect(onRetried).not.toHaveBeenCalled();
  });

  test('shows an operation\'s result when opened on it', async () => {
    axios.get.mockResolvedValue({ data: { id: 7, label: 'Chan', status: 'completed', total: 2, done: 2, failed: 0, failedItems: [] } });
    renderDialog({ change: null, operationId: 7 });

    expect(await screen.findByText('Moved 2 videos.')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  test('checks the media server libraries of the TV folders videos move into', async () => {
    axios.post.mockResolvedValueOnce({ data: { ...PREVIEW, tvFolders: ['TV'] } });
    axios.get.mockResolvedValue({
      data: {
        servers: [{ serverType: 'emby', name: 'Emby', reachable: true, error: null }],
        folders: [{ name: 'TV', layout: 'tv', hasFiles: true, channels: 1, servers: [{ serverType: 'emby', status: 'missing', libraries: [], issues: [] }] }],
      },
    });
    renderDialog();

    expect(await screen.findByText(/Add a TV Shows library for __TV/)).toBeInTheDocument();
    const [url, options] = axios.get.mock.calls.find(([calledUrl]: [string]) => calledUrl === '/api/library-folders/check');
    expect(url).toBe('/api/library-folders/check');
    expect((options.params as URLSearchParams).getAll('folder')).toEqual(['TV']);
    // The folder may still be saved as a Videos folder: the move is what makes it a TV folder.
    expect((options.params as URLSearchParams).get('layout')).toBe('tv');
  });

  test('forgets the previous move\'s library problems when the next move has no TV folder', async () => {
    const problems = {
      servers: [{ serverType: 'emby', name: 'Emby', reachable: true, error: null }],
      folders: [{ name: 'TV', layout: 'tv', hasFiles: true, channels: 1, servers: [{ serverType: 'emby', status: 'missing', libraries: [], issues: [] }] }],
    };
    axios.post.mockResolvedValueOnce({ data: { ...PREVIEW, tvFolders: ['TV'] } });
    axios.get.mockResolvedValue({ data: problems });
    const onClose = jest.fn();
    const { rerender } = render(<ReorganizeDialog open token="token" change={CHANGE} onClose={onClose} onApplied={jest.fn()} />);
    expect(await screen.findByText(/Check the media server libraries/)).toBeInTheDocument();

    const back = { type: 'channelLayout' as const, channelId: 'UC1', layout: 'videos' as const };
    axios.post.mockResolvedValueOnce({ data: { ...PREVIEW, revision: 'rev2', tvFolders: [] } });
    rerender(<ReorganizeDialog open token="token" change={back} onClose={onClose} onApplied={jest.fn()} />);

    await screen.findByRole('button', { name: 'Move 2 videos' });
    await waitFor(() => expect(screen.queryByText(/Check the media server libraries/)).not.toBeInTheDocument());
  });

  test("doesn't check media servers when no video becomes a TV episode", async () => {
    axios.post.mockResolvedValueOnce({ data: { ...PREVIEW, tvFolders: [] } });
    renderDialog();

    expect(await screen.findByRole('button', { name: 'Move 2 videos' })).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalledWith('/api/library-folders/check', expect.anything());
  });
});
