import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TitleShowPreviewTabs from '../TitleShowPreviewTabs';
import { TitleShowPreview } from '../../../../../types/titleShows';

const PREVIEW: TitleShowPreview = {
  knownVideos: 312,
  staysOutside: 0,
  shows: [{
    key: 'new:0', id: null, name: 'Beyblade', folderName: 'Beyblade', libraryFolder: 'TV', truncated: false,
    counts: { episodes: 2, downloaded: 1, pending: 0, duplicates: 1, unsupported: 1 },
    episodes: [
      { youtubeId: 'a', title: 'BEYBLADE EN Episode 1: The Blade Raider', season: 1, episode: 1, code: 'S01E01', status: 'assigned', episodeTitle: 'The Blade Raider', patternIndex: 0, downloadState: 'downloaded' },
      { youtubeId: 'b', title: 'BEYBLADE EN Episode 3: Third', season: 1, episode: 3, code: 'S01E03', status: 'assigned', episodeTitle: 'Third', patternIndex: 0, downloadState: 'not_downloaded' },
    ],
  }],
  duplicates: [{
    youtubeId: 'c', title: 'BEYBLADE EN Episode 1: The Blade Raider', showKey: 'new:0', showName: 'Beyblade', season: 1, episode: 1,
    code: 'S01E01', duplicateOf: 'a', duplicateOfTitle: 'BEYBLADE EN Episode 1: The Blade Raider (2020)', downloaded: false,
  }],
  gaps: [{ showKey: 'new:0', season: 1, have: 2, highest: 3, missing: [2], truncated: false }],
  unsupported: [{ youtubeId: 'd', title: 'Ep.19 | Ep.20', showKey: 'new:0', showName: 'Beyblade', reason: 'compilation', season: 1, episode: 19, episodeEnd: 20, part: null }],
  unmatched: { count: 307, videos: [{ youtubeId: 'e', title: 'BEYBLADE PT-BR EPISÓDIO 6', downloaded: false }] },
  changes: [{
    youtubeId: 'f', title: 'Moved', downloaded: true,
    from: { showKey: 'title:2', showName: 'Old', code: 'S01E05', status: 'assigned' }, to: null,
  }],
  changeCount: 1,
  filesToMove: 1,
  retired: [],
  relocated: [],
  compiled: [{ key: 'new:0', patterns: ['(?i)x'] }],
};

function renderTabs(props: Partial<React.ComponentProps<typeof TitleShowPreviewTabs>> = {}) {
  render(<TitleShowPreviewTabs preview={PREVIEW} showKey="new:0" loading={false} error={null} {...props} />);
}

describe('TitleShowPreviewTabs', () => {
  test('says how many videos the preview is based on', () => {
    renderTabs();
    expect(screen.getByText(/Based on 312 known videos/)).toBeInTheDocument();
  });

  test('lists the show\'s episodes with their codes and download state', () => {
    renderTabs();
    expect(screen.getByText('S01E01')).toBeInTheDocument();
    expect(screen.getByText('The Blade Raider')).toBeInTheDocument();
    expect(screen.getAllByText('Downloaded')).toHaveLength(1);
  });

  test('names the upload that keeps a duplicate\'s number', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Duplicates (1)' }));
    expect(screen.getByText(/Duplicate of S01E01: BEYBLADE EN Episode 1: The Blade Raider \(2020\)/)).toBeInTheDocument();
  });

  test('lists the missing numbers of each season', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Gaps (1)' }));
    expect(screen.getByText('Season 1: 2 of 3; missing E2')).toBeInTheDocument();
  });

  test('counts the videos no show takes', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Unmatched (307)' }));
    expect(screen.getByText('BEYBLADE PT-BR EPISÓDIO 6')).toBeInTheDocument();
  });

  test('explains what isn\'t supported yet', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Not supported (1)' }));
    expect(screen.getByText(/Compilation of episodes 19-20/)).toBeInTheDocument();
  });

  test('says when downloaded files outside the downloads folder stay where they are', () => {
    renderTabs({ preview: { ...PREVIEW, staysOutside: 2 } });
    expect(screen.getByText('2 downloaded videos are outside the downloads folder: their files stay where they are.')).toBeInTheDocument();
  });

  test('says nothing about outside files when there are none', () => {
    renderTabs();
    expect(screen.queryByText(/outside the downloads folder/)).not.toBeInTheDocument();
  });

  test('explains a title that skipped its season or episode number', async () => {
    renderTabs({ preview: {
      ...PREVIEW,
      unsupported: [{ youtubeId: 'e', title: 'Episode 3', showKey: 'new:0', showName: 'Beyblade', reason: 'missing-number', season: null, episode: 3, episodeEnd: null, part: null }],
    } });
    await userEvent.click(screen.getByRole('tab', { name: 'Not supported (1)' }));
    expect(screen.getByText('The title has no season or episode number for this pattern')).toBeInTheDocument();
  });

  test('lists stored episodes that would change and the files that move', async () => {
    renderTabs();
    await userEvent.click(screen.getByRole('tab', { name: 'Would change (1)' }));
    expect(screen.getByText('S01E05 of Old -> no show')).toBeInTheDocument();
    expect(screen.getByText(/1 downloaded video moves/)).toBeInTheDocument();
  });

  test.each([
    ['Episodes (520)', 'Showing the first 2 of 520.'],
    ['Duplicates (600)', 'Showing the first 1 of 600.'],
    ['Unmatched (307)', 'Showing the first 1 of 307.'],
    ['Not supported (3)', 'Showing the first 1 of 3.'],
    ['Would change (700)', 'Showing the first 1 of 700.'],
  ])('counts every item of %s and says the list is cut short', async (tabName, note) => {
    const [show] = PREVIEW.shows;
    renderTabs({ preview: {
      ...PREVIEW,
      shows: [{ ...show, truncated: true, counts: { ...show.counts, episodes: 520, duplicates: 600, unsupported: 3 } }],
      changeCount: 700,
    } });
    await userEvent.click(screen.getByRole('tab', { name: tabName }));
    expect(screen.getByText(note)).toBeInTheDocument();
  });

  test('says nothing about a cut list when every episode is listed', () => {
    renderTabs();
    expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument();
  });

  test('shows the server\'s refusal of the drafts', () => {
    renderTabs({ error: 'Beyblade, pattern 1: Unknown placeholder {ep}' });
    expect(screen.getByText('Beyblade, pattern 1: Unknown placeholder {ep}')).toBeInTheDocument();
  });

  test('waits for the first preview', () => {
    renderTabs({ preview: null, loading: true });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
