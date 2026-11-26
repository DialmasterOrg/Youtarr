import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosHeader from '../ChannelVideosHeader';
import { renderWithProviders } from '../../../../test-utils';
import { ChannelVideo } from '../../../../types/ChannelVideo';
import { TabDownloadStatsByTab } from '../../../../types/Channel';

type Props = React.ComponentProps<typeof ChannelVideosHeader>;

const video = (youtubeId: string, overrides: Partial<ChannelVideo> = {}): ChannelVideo => ({
  title: `Video ${youtubeId}`,
  youtube_id: youtubeId,
  publishedAt: '2023-01-01T00:00:00Z',
  published_at_source: 'exact',
  thumbnail: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`,
  added: false,
  duration: 300,
  media_type: 'video',
  live_status: null,
  ...overrides,
});

const pendingDateVideo = video('pending1', { publishedAt: null, published_at_source: 'estimated' });

const countedVideosTab: TabDownloadStatsByTab = {
  videos: { total: 10, fetchedAt: null, downloaded: 5, ignored: 0, percent: 50, loaded: 8 },
};

describe('ChannelVideosHeader', () => {
  const onDownloadAll = jest.fn();
  const onLoadMore = jest.fn();
  const onShowNewVideos = jest.fn();
  const onDismissNewVideos = jest.fn();

  const renderHeader = (props: Partial<Props> = {}) =>
    renderWithProviders(
      <ChannelVideosHeader
        isMobile={false}
        selectedTab="videos"
        videos={[video('one'), video('two'), video('three')]}
        totalCount={3}
        isFiltered={false}
        oldestVideoDate={null}
        tabStats={null}
        isFetching={false}
        showLoadMoreProgress={false}
        fetchProgress={null}
        onDownloadAll={onDownloadAll}
        onLoadMore={onLoadMore}
        checkingForNewVideos={false}
        newVideoCount={0}
        onShowNewVideos={onShowNewVideos}
        onDismissNewVideos={onDismissNewVideos}
        raiseNewVideosNotice={false}
        {...props}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('counts', () => {
    test('summarises the selected tab once it has been counted', () => {
      renderHeader({ tabStats: countedVideosTab });

      expect(screen.getByTestId('tab-download-summary')).toHaveTextContent(
        'Videos tab · 5 of 10 downloaded · 8 loaded'
      );
    });

    test('shows the item count before the tab has been counted', () => {
      renderHeader();

      expect(screen.getByText('3 items')).toBeInTheDocument();
    });

    test('leaves the item count out when the tab summary gives the counts', () => {
      renderHeader({ tabStats: countedVideosTab });

      expect(screen.queryByText('3 items')).not.toBeInTheDocument();
    });

    test('shows how many videos match while the list is filtered, even beside the summary', () => {
      renderHeader({ tabStats: countedVideosTab, isFiltered: true, totalCount: 1 });

      expect(screen.getByText('1 match')).toBeInTheDocument();
    });

    test('shows no count for an empty list', () => {
      renderHeader({ videos: [], totalCount: 0, isFiltered: true });

      expect(screen.queryByText(/match|item/)).not.toBeInTheDocument();
    });
  });

  describe('oldest video date', () => {
    const oldest = '2023-01-15T12:00:00Z';
    const oldestText = `Oldest: ${new Date(oldest).toLocaleDateString()}`;

    test('is shown on desktop', () => {
      renderHeader({ oldestVideoDate: oldest });

      expect(screen.getByText(oldestText)).toBeInTheDocument();
    });

    test.each([
      ['on mobile', { isMobile: true }],
      ['on the Shorts tab', { selectedTab: 'shorts' }],
    ])('is left out %s', (_case, props) => {
      renderHeader({ oldestVideoDate: oldest, ...props });

      expect(screen.queryByText(oldestText)).not.toBeInTheDocument();
    });
  });

  describe('publish date info', () => {
    const openInfo = () => userEvent.click(screen.getByRole('button', { name: 'Video list info' }));

    test('explains pending dates first when a loaded video has none', async () => {
      renderHeader({ videos: [pendingDateVideo] });

      await openInfo();

      expect(
        await screen.findByText(/^Pending means YouTube listed the video without a date\. Dates come from YouTube\./)
      ).toBeInTheDocument();
    });

    test('leaves the pending explanation out when every video has a date', async () => {
      renderHeader();

      await openInfo();

      expect(await screen.findByText(/^Dates come from YouTube\./)).toBeInTheDocument();
    });

    test('does not count a Short without a date as pending', async () => {
      renderHeader({ videos: [{ ...pendingDateVideo, media_type: 'short' }] });

      await openInfo();

      expect(await screen.findByText(/^Dates come from YouTube\./)).toBeInTheDocument();
    });

    test('says only that Shorts have no publish dates on the Shorts tab', async () => {
      renderHeader({ selectedTab: 'shorts', videos: [pendingDateVideo] });

      await openInfo();

      expect(await screen.findByText("YouTube doesn't provide publish dates for Shorts.")).toBeInTheDocument();
    });

    test('tints the info button while a date is pending', () => {
      renderHeader({ videos: [pendingDateVideo] });

      expect(screen.getByRole('button', { name: 'Video list info' })).toHaveStyle({ color: 'var(--warning)' });
    });

    test('does not tint the info button when every video has a date', () => {
      renderHeader();

      expect(screen.getByRole('button', { name: 'Video list info' })).not.toHaveStyle({ color: 'var(--warning)' });
    });
  });

  describe('Download All and Load More', () => {
    test('Download All asks to download every video', async () => {
      renderHeader();

      await userEvent.click(screen.getByRole('button', { name: 'Download All' }));

      expect(onDownloadAll).toHaveBeenCalledTimes(1);
    });

    test('Load More asks to load more videos', async () => {
      renderHeader();

      await userEvent.click(screen.getByRole('button', { name: 'Load More' }));

      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    test('both are disabled while the tab is being fetched', () => {
      renderHeader({ isFetching: true });

      expect(screen.getByRole('button', { name: 'Download All' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Load More' })).toBeDisabled();
    });

    test('Load More says Loading and shows its progress while a Load More fetch runs', () => {
      renderHeader({
        isFetching: true,
        showLoadMoreProgress: true,
        fetchProgress: { itemsFetched: 4, stage: 'listing' },
        tabStats: countedVideosTab,
      });

      expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
      expect(screen.getByText('Read 4 of 10 videos from YouTube')).toBeInTheDocument();
    });

    test('shows no Load More progress during a background refresh', () => {
      renderHeader({ isFetching: true, fetchProgress: { itemsFetched: 4, stage: 'listing' } });

      expect(screen.queryByLabelText('Load More progress')).not.toBeInTheDocument();
    });
  });

  describe('new videos', () => {
    test('says when a background refresh is checking for new videos', () => {
      renderHeader({ checkingForNewVideos: true });

      expect(screen.getByRole('status')).toHaveTextContent('Checking for new videos');
    });

    test('offers the new videos a refresh found', async () => {
      renderHeader({ newVideoCount: 2 });

      await userEvent.click(screen.getByRole('button', { name: 'Show' }));

      expect(screen.getByText('2 new videos')).toBeInTheDocument();
      expect(onShowNewVideos).toHaveBeenCalledTimes(1);
    });

    test('lets the offer be dismissed', async () => {
      renderHeader({ newVideoCount: 2 });

      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onDismissNewVideos).toHaveBeenCalledTimes(1);
    });
  });
});
