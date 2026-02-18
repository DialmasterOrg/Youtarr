import { screen } from '@testing-library/react';
import { runStoryWithPlay } from '../components/__tests__/storybookPlayAdapter';
import * as videoListItemStories from '../components/ChannelPage/__tests__/VideoListItem.story';
import * as downloadProgressStories from '../components/DownloadManager/__tests__/DownloadProgress.story';
import * as subtitleLanguageStories from '../components/Configuration/__tests__/SubtitleLanguageSelector.story';

describe('storybook parity coverage', () => {
  test('VideoListItem Selectable story preserves selection behavior parity', async () => {
    const { args } = await runStoryWithPlay(videoListItemStories, 'Selectable');

    expect(screen.getByText('Sample Video')).toBeInTheDocument();
    expect(args.onCheckChange).toHaveBeenCalledWith('abc123', true);
  });

  test('DownloadProgress ShowsQueuedJobs story preserves queued job display parity', async () => {
    await runStoryWithPlay(downloadProgressStories, 'ShowsQueuedJobs');

    expect(screen.getByText('Download Progress')).toBeInTheDocument();
    expect(screen.getByText('1 job queued')).toBeInTheDocument();
  });

  test('SubtitleLanguageSelector MultiSelect story preserves change callback parity', async () => {
    const { args } = await runStoryWithPlay(subtitleLanguageStories, 'MultiSelect');

    expect(screen.getAllByLabelText('Subtitle Languages').length).toBeGreaterThan(0);
    expect(args.onChange).toHaveBeenCalled();
    expect(args.onChange).toHaveBeenCalledWith(expect.stringContaining('es'));
  });
});