import React, { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PlaylistDownloadFilters from '../PlaylistDownloadFilters';
import { PlaylistFilterPreview, PlaylistFilterValues } from '../../hooks/usePlaylistFilterPreview';

jest.mock('axios', () => ({ post: jest.fn(), isAxiosError: jest.fn(() => true) }));
const http = require('axios');

const NO_FILTERS: PlaylistFilterValues = { title_filter_regex: null, min_duration: null, max_duration: null };
const preview: PlaylistFilterPreview = {
  totalCount: 2,
  matchCount: 1,
  waitingCount: null,
  truncated: false,
  videos: [
    { youtube_id: 'a', title: 'Episode 1', duration: 900, matches: true },
    { youtube_id: 'b', title: 'Trailer', duration: 60, matches: false },
  ],
};

// The section is controlled; the harness holds the value like the settings dialog does.
function Harness({
  initial,
  onChange,
  autoDownload,
  hasSavedFilters,
}: {
  initial: PlaylistFilterValues;
  onChange: (next: PlaylistFilterValues) => void;
  autoDownload: boolean;
  hasSavedFilters: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PlaylistDownloadFilters
      value={value}
      onChange={(next) => { onChange(next); setValue(next); }}
      playlistId="PL1"
      token="t"
      autoDownload={autoDownload}
      hasSavedFilters={hasSavedFilters}
    />
  );
}

function setup(initial: Partial<PlaylistFilterValues> = {}, { autoDownload = true, hasSavedFilters = false } = {}) {
  const onChange = jest.fn();
  render(
    <Harness
      initial={{ ...NO_FILTERS, ...initial }}
      onChange={onChange}
      autoDownload={autoDownload}
      hasSavedFilters={hasSavedFilters}
    />
  );
  return { onChange, user: userEvent.setup() };
}

const lastChange = (onChange: jest.Mock): PlaylistFilterValues => onChange.mock.calls[onChange.mock.calls.length - 1][0];

async function runPreview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Preview filters' }));
}

describe('PlaylistDownloadFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    http.isAxiosError.mockReturnValue(true);
    http.post.mockResolvedValue({ data: preview });
  });

  test('explains that filtered videos stay listed and can be selected', () => {
    setup();
    expect(screen.getByText(/stay in the list, marked Filtered, and still download when you select them yourself/)).toBeInTheDocument();
  });

  test('shows the saved title filter', () => {
    setup({ title_filter_regex: '(?i)full episode' });
    expect(screen.getByLabelText('Title Filter (Python Regex)')).toHaveValue('(?i)full episode');
  });

  test('shows saved durations in whole minutes', () => {
    setup({ min_duration: 300, max_duration: 600 });
    expect(screen.getByLabelText('Min Duration (mins)')).toHaveValue(5);
    expect(screen.getByLabelText('Max Duration (mins)')).toHaveValue(10);
  });

  test('reports a typed title filter', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Title Filter (Python Regex)'), 'Episode');
    expect(lastChange(onChange)).toEqual({ ...NO_FILTERS, title_filter_regex: 'Episode' });
  });

  test('reports a cleared title filter as no filter', async () => {
    const { onChange, user } = setup({ title_filter_regex: 'Ep' });
    await user.clear(screen.getByLabelText('Title Filter (Python Regex)'));
    expect(lastChange(onChange).title_filter_regex).toBeNull();
  });

  test('reports a minimum in seconds', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Min Duration (mins)'), '2');
    expect(lastChange(onChange)).toEqual({ ...NO_FILTERS, min_duration: 120 });
  });

  // The server compares exact seconds, so "15 minutes" is saved as 15:59.
  test('reports a maximum as the last second of its final minute', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Max Duration (mins)'), '15');
    expect(lastChange(onChange)).toEqual({ ...NO_FILTERS, max_duration: 959 });
  });

  test('shows a maximum saved as the last second of a minute as that minute', () => {
    setup({ max_duration: 659 });
    expect(screen.getByLabelText('Max Duration (mins)')).toHaveValue(10);
  });

  // The server accepts at most 24 hours, so that entry has no final minute to add.
  test('reports a 24-hour maximum as exactly 24 hours', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Max Duration (mins)'), '1440');
    expect(lastChange(onChange).max_duration).toBe(86400);
  });

  test('reports a maximum above 24 hours as entered, for the server to reject', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Max Duration (mins)'), '1441');
    expect(lastChange(onChange).max_duration).toBe(86519);
  });

  test('reports a cleared duration as no limit', async () => {
    const { onChange, user } = setup({ min_duration: 300 });
    await user.clear(screen.getByLabelText('Min Duration (mins)'));
    expect(lastChange(onChange).min_duration).toBeNull();
  });

  test('treats zero minutes as no limit', async () => {
    const { onChange, user } = setup();
    await user.type(screen.getByLabelText('Min Duration (mins)'), '0');
    expect(lastChange(onChange).min_duration).toBeNull();
  });

  test('fills the title filter from an example', async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Show examples' }));
    await user.click(screen.getByRole('button', { name: 'Use (?i)full episode' }));
    expect(lastChange(onChange).title_filter_regex).toBe('(?i)full episode');
  });

  describe('preview', () => {
    test('cannot preview while no filter is set or saved', () => {
      setup();
      expect(screen.getByRole('button', { name: 'Preview filters' })).toBeDisabled();
    });

    // Removing the last filter releases the most videos, so it must be previewable.
    test('previews removing every filter from a playlist that has saved ones', async () => {
      const { user } = setup({ title_filter_regex: 'Ep' }, { hasSavedFilters: true });
      await user.clear(screen.getByLabelText('Title Filter (Python Regex)'));
      await runPreview(user);
      expect(http.post).toHaveBeenCalledWith('/api/playlists/PL1/filter-preview', NO_FILTERS, expect.any(Object));
    });

    test('keeps Preview unavailable after an edit until the running request settles', async () => {
      let finish: (value: { data: PlaylistFilterPreview }) => void = () => {};
      http.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      await user.type(screen.getByLabelText('Title Filter (Python Regex)'), 's');
      expect(screen.getByRole('button', { name: 'Preview filters' })).toBeDisabled();
      finish({ data: preview });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Preview filters' })).toBeEnabled());
    });

    test('sends the filters as currently entered, before they are saved', async () => {
      const { user } = setup({ title_filter_regex: 'Episode', max_duration: 600 });
      await runPreview(user);
      expect(http.post).toHaveBeenCalledWith(
        '/api/playlists/PL1/filter-preview',
        { title_filter_regex: 'Episode', min_duration: null, max_duration: 600 },
        expect.any(Object)
      );
    });

    test('shows how many of the playlist videos match', async () => {
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      expect(await screen.findByText('1 of 2 videos in this playlist match.')).toBeInTheDocument();
    });

    test('lists each video with whether it matches', async () => {
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      const items = await screen.findAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(['MatchesEpisode 115m', 'SkippedTrailer1m']);
    });

    test('shows no length for a video whose duration is unknown', async () => {
      http.post.mockResolvedValue({
        data: { ...preview, videos: [{ youtube_id: 'a', title: 'Episode 1', duration: null, matches: false }] },
      });
      const { user } = setup({ min_duration: 60 });
      await runPreview(user);
      const [item] = await screen.findAllByRole('listitem');
      expect(item).toHaveTextContent(/^SkippedEpisode 1$/);
    });

    test('says how many waiting videos will download automatically with these filters', async () => {
      http.post.mockResolvedValue({ data: { ...preview, waitingCount: 3 } });
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      expect(await screen.findByText(
        'With these filters, 3 videos found since this playlist started following are waiting to download automatically. To skip them, save these filters, then use Follow from now.'
      )).toBeInTheDocument();
    });

    test('uses the singular for one waiting video', async () => {
      http.post.mockResolvedValue({ data: { ...preview, waitingCount: 1 } });
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      expect(await screen.findByText(/1 video found since this playlist started following is waiting to download automatically/)).toBeInTheDocument();
    });

    test('says waiting videos download once auto-download is resumed while it is paused', async () => {
      http.post.mockResolvedValue({ data: { ...preview, waitingCount: 3 } });
      const { user } = setup({ title_filter_regex: 'Episode' }, { autoDownload: false });
      await runPreview(user);
      expect(await screen.findByText(
        /3 videos found since this playlist started following will download once auto-download is resumed/
      )).toBeInTheDocument();
    });

    test('presents the waiting videos as information, not a warning', async () => {
      http.post.mockResolvedValue({ data: { ...preview, waitingCount: 3 } });
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      expect(await screen.findByRole('alert')).toHaveClass('alert-standard-info');
    });

    describe('bringing the result into view', () => {
      // jest.setup.ts stubs scrollIntoView on HTMLElement.prototype
      let scrollIntoView: jest.SpyInstance;

      beforeEach(() => {
        scrollIntoView = jest.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {});
      });
      afterEach(() => {
        scrollIntoView.mockRestore();
      });

      test('scrolls to the results when a preview arrives', async () => {
        const { user } = setup({ title_filter_regex: 'Episode' });
        await runPreview(user);
        await screen.findByText('1 of 2 videos in this playlist match.');
        expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
      });

      test('scrolls to the error when a preview is rejected', async () => {
        http.post.mockRejectedValue({ response: { status: 400, data: { error: 'Invalid regex pattern' } } });
        const { user } = setup({ title_filter_regex: '[unclosed' });
        await runPreview(user);
        await screen.findByRole('alert');
        expect(scrollIntoView).toHaveBeenCalled();
      });

      test('does not scroll before a preview is run', () => {
        setup({ title_filter_regex: 'Episode' });
        expect(scrollIntoView).not.toHaveBeenCalled();
      });
    });

    test.each([0, null])('says nothing about waiting videos when the count is %s', async (waitingCount) => {
      http.post.mockResolvedValue({ data: { ...preview, waitingCount } });
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      await screen.findByText('1 of 2 videos in this playlist match.');
      expect(screen.queryByText(/found since this playlist started following/)).not.toBeInTheDocument();
    });

    test('notes when only the most recent videos are listed', async () => {
      http.post.mockResolvedValue({ data: { ...preview, totalCount: 80, truncated: true } });
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      expect(await screen.findByText(/Showing the 2 most recently discovered videos/)).toBeInTheDocument();
    });

    test('shows why a pattern was rejected', async () => {
      http.post.mockRejectedValue({ response: { status: 400, data: { error: 'Invalid regex pattern: unterminated character set' } } });
      const { user } = setup({ title_filter_regex: '[unclosed' });
      await runPreview(user);
      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid regex pattern: unterminated character set');
    });

    test('drops the results when a filter is edited, so they never describe an older filter', async () => {
      const { user } = setup({ title_filter_regex: 'Episode' });
      await runPreview(user);
      await screen.findByText('1 of 2 videos in this playlist match.');
      await user.type(screen.getByLabelText('Title Filter (Python Regex)'), 's');
      await waitFor(() => expect(screen.queryByText('1 of 2 videos in this playlist match.')).not.toBeInTheDocument());
    });

    describe('when the parent replaces the filters', () => {
      const shown: PlaylistFilterValues = { ...NO_FILTERS, title_filter_regex: 'Episode' };
      const replaced: PlaylistFilterValues = { ...NO_FILTERS, title_filter_regex: 'Trailer' };
      const filters = (value: PlaylistFilterValues, playlistId = 'PL1') => (
        <PlaylistDownloadFilters
          value={value}
          onChange={jest.fn()}
          playlistId={playlistId}
          token="t"
          autoDownload
          hasSavedFilters
        />
      );

      test('drops results that described the earlier filters', async () => {
        const user = userEvent.setup();
        const { rerender } = render(filters(shown));
        await runPreview(user);
        await screen.findByText('1 of 2 videos in this playlist match.');
        rerender(filters(replaced));
        await waitFor(() => expect(screen.queryByText('1 of 2 videos in this playlist match.')).not.toBeInTheDocument());
      });

      test('drops results that described another playlist', async () => {
        const user = userEvent.setup();
        const { rerender } = render(filters(shown));
        await runPreview(user);
        await screen.findByText('1 of 2 videos in this playlist match.');
        rerender(filters(shown, 'PL2'));
        await waitFor(() => expect(screen.queryByText('1 of 2 videos in this playlist match.')).not.toBeInTheDocument());
      });

      test('ignores a pending preview of the earlier filters', async () => {
        let finish: (value: { data: PlaylistFilterPreview }) => void = () => {};
        http.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
        const user = userEvent.setup();
        const { rerender } = render(filters(shown));
        await runPreview(user);
        rerender(filters(replaced));
        finish({ data: preview });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Preview filters' })).toBeEnabled());
        expect(screen.queryByText('1 of 2 videos in this playlist match.')).not.toBeInTheDocument();
      });

      test('keeps results when the same filters arrive again', async () => {
        const user = userEvent.setup();
        const { rerender } = render(filters(shown));
        await runPreview(user);
        await screen.findByText('1 of 2 videos in this playlist match.');
        rerender(filters({ ...shown }));
        expect(screen.getByText('1 of 2 videos in this playlist match.')).toBeInTheDocument();
      });
    });
  });
});
