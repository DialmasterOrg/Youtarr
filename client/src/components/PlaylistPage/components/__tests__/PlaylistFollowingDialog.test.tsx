import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaylistFollowingDialog from '../PlaylistFollowingDialog';
import { Playlist } from '../../../../types/playlist';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), isAxiosError: jest.fn(() => false) }));
const http = require('axios');
const playlist = { playlist_id: 'PL1', title: 'Tech', video_count: 11, auto_download: false } as Playlist;
const candidates = [
  { youtube_id: 'new', title: 'New upload', position: 1, published_at: '20260901' },
  { youtube_id: 'old', title: 'Old upload', position: 11, published_at: '20200101' },
];

beforeEach(() => {
  jest.clearAllMocks();
  http.isAxiosError.mockReturnValue(false);
  http.get.mockResolvedValue({ data: { candidates, selectedIds: ['new'], missingDates: 0 } });
  http.post.mockResolvedValue({ data: { queued: 0 } });
});

test('defaults to future additions and does not queue an implicit starting batch', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="setup" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByRole('radio', { name: 'Only download future additions' })).toBeChecked();
  expect(http.get).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Start following' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/api/playlists/PL1/following', { videoIds: [] }, expect.any(Object)));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Following new additions.'));
});

test('lets users change the preview and submits exactly the checked ids', async () => {
  const user = userEvent.setup();
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="batch" defaultCount={3} onClose={jest.fn()} onSaved={jest.fn()} />);
  const newest = await screen.findByRole('checkbox', { name: 'Select New upload' });
  expect(newest).toBeChecked();
  expect(screen.getByText('Published 2026-09-01')).toBeVisible();
  expect(screen.getByText('Published 2020-01-01')).toBeVisible();
  await user.click(newest);
  await user.click(screen.getByRole('checkbox', { name: 'Select Old upload' }));
  await user.click(screen.getByRole('button', { name: 'Queue 1 video' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/api/playlists/PL1/download-batch', { videoIds: ['old'] }, expect.any(Object)));
});

test('missing publication dates require an explicit choice', async () => {
  http.get.mockResolvedValue({ data: { candidates, selectedIds: [], missingDates: 1 } });
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="batch" defaultCount={3} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(await screen.findByText(/Publication dates are missing for 1 video/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Queue 0 videos' })).toBeDisabled();
  expect(http.post).not.toHaveBeenCalled();
});

test('keeps the selected batch available after a submission failure', async () => {
  http.post.mockRejectedValue(new Error('offline'));
  const user = userEvent.setup();
  const onSaved = jest.fn();
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="batch" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  await screen.findByRole('checkbox', { name: 'Select New upload' });
  await user.click(screen.getByRole('button', { name: 'Queue 1 video' }));
  expect(await screen.findByText(/Could not save this selection/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Select New upload' })).toBeChecked();
  expect(onSaved).not.toHaveBeenCalled();
});

test('following from now is an explicit action with a backlog explanation', async () => {
  const user = userEvent.setup();
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="restart" defaultCount={3} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByText(/skip its current undownloaded backlog/)).toBeInTheDocument();
  expect(http.post).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Skip backlog and reset starting point' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/api/playlists/PL1/following', { restart: true, videoIds: [] }, expect.any(Object)));
});


test('resetting a paused playlist explains that downloads remain paused', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  http.post.mockResolvedValue({ data: { queued: 0, playlist: { ...playlist, auto_download: false } } });
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="restart" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByText(/Automatic downloads will remain paused/)).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Skip backlog and reset starting point' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Starting point updated. Automatic downloads remain paused until you resume.'));
});

test('reset success reflects a pause saved elsewhere during refresh', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  http.post.mockResolvedValue({ data: { queued: 0, playlist: { ...playlist, auto_download: false } } });
  render(<PlaylistFollowingDialog playlist={{ ...playlist, auto_download: true }} token="t" mode="restart" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByText('Automatic downloads will stay enabled.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Skip backlog and reset starting point' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Starting point updated. Automatic downloads remain paused until you resume.'));
});

test('shows an oversized-playlist error without claiming setup succeeded', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  http.isAxiosError.mockReturnValue(true);
  http.post.mockRejectedValue({ response: { status: 422, data: { error: 'Automatic following supports playlists with up to 5,000 entries.' } } });
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="setup" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  await user.click(screen.getByRole('button', { name: 'Start following' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Automatic following supports playlists with up to 5,000 entries.');
  expect(onSaved).not.toHaveBeenCalled();
});


test('setup can preview and change an existing batch before starting following', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  render(<PlaylistFollowingDialog playlist={playlist} token="t" mode="setup" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  await user.click(screen.getByRole('radio', { name: 'Also download existing videos' }));
  expect(await screen.findByRole('checkbox', { name: 'Select New upload' })).toBeChecked();
  expect(http.get).toHaveBeenLastCalledWith('/api/playlists/PL1/download-preview', expect.objectContaining({ params: { order: 'published', count: 3 } }));

  http.get.mockResolvedValue({ data: { candidates, selectedIds: ['old'], missingDates: 0 } });
  fireEvent.mouseDown(screen.getByLabelText('Choose by'));
  await user.click(await screen.findByRole('option', { name: 'End of YouTube playlist' }));
  await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/api/playlists/PL1/download-preview', expect.objectContaining({ params: { order: 'desc', count: 3 } })));
  await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select Old upload' })).toBeChecked());
  expect(screen.getByRole('checkbox', { name: 'Select New upload' })).not.toBeChecked();

  http.post.mockResolvedValue({ data: { queued: 1, playlist: { ...playlist, auto_download: true } } });
  await user.click(screen.getByRole('button', { name: 'Start following and queue selection' }));
  await waitFor(() => expect(http.post).toHaveBeenCalledWith('/api/playlists/PL1/following', { videoIds: ['old'] }, expect.any(Object)));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Following new additions. 1 existing video queued.'));
});

test('reset success confirms automatic downloads remain enabled', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  http.post.mockResolvedValue({ data: { queued: 0, playlist: { ...playlist, auto_download: true } } });
  render(<PlaylistFollowingDialog playlist={{ ...playlist, auto_download: true }} token="t" mode="restart" defaultCount={3} onClose={jest.fn()} onSaved={onSaved} />);
  await user.click(screen.getByRole('button', { name: 'Skip backlog and reset starting point' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Starting point updated. Automatic downloads remain enabled.'));
});
