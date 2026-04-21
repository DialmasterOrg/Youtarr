import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideosResults from '../VideosResults';
import { VideoData } from '../../../../types/VideoData';

jest.mock('../VideoCard', () => ({
  __esModule: true,
  default: ({ video }: { video: VideoData }) => {
    const React2 = require('react');
    return React2.createElement('div', { 'data-testid': 'grid-card' }, video.youTubeVideoName);
  },
}));
jest.mock('../VideosTable', () => ({
  __esModule: true,
  default: ({ videos }: { videos: VideoData[] }) => {
    const React2 = require('react');
    return React2.createElement(
      'div',
      { 'data-testid': 'desktop-table' },
      videos.length + ' rows'
    );
  },
}));
jest.mock('../VideosListMobile', () => ({
  __esModule: true,
  default: ({ videos }: { videos: VideoData[] }) => {
    const React2 = require('react');
    return React2.createElement(
      'div',
      { 'data-testid': 'mobile-list' },
      videos.length + ' rows'
    );
  },
}));

const videos: VideoData[] = [
  {
    id: 1,
    youtubeId: 'a',
    youTubeChannelName: 'Channel',
    youTubeVideoName: 'Video 1',
    timeCreated: '2024-01-15T10:30:00',
    originalDate: '20240110',
    duration: 300,
    description: null,
    fileSize: '100',
    removed: false,
  },
];

const defaultProps: Omit<React.ComponentProps<typeof VideosResults>, 'viewMode' | 'isMobile'> = {
  videos,
  loading: false,
  placeholderCount: 3,
  selectedVideos: [],
  enabledChannels: [],
  imageErrors: {},
  orderBy: 'added',
  sortOrder: 'desc',
  deleteDisabled: false,
  onSelectAll: jest.fn(),
  onToggleSelect: jest.fn(),
  onSortChange: jest.fn(),
  onOpenModal: jest.fn(),
  onToggleProtection: jest.fn(),
  onDeleteSingle: jest.fn(),
  onImageError: jest.fn(),
};

const renderResults = (extra: Partial<React.ComponentProps<typeof VideosResults>>) =>
  render(
    <MemoryRouter>
      <VideosResults {...defaultProps} {...(extra as React.ComponentProps<typeof VideosResults>)} />
    </MemoryRouter>
  );

describe('VideosResults', () => {
  test('renders grid cards when viewMode is grid', () => {
    renderResults({ viewMode: 'grid', isMobile: false });
    expect(screen.getByTestId('grid-card')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-table')).not.toBeInTheDocument();
  });

  test('renders desktop table when viewMode is table and not mobile', () => {
    renderResults({ viewMode: 'table', isMobile: false });
    expect(screen.getByTestId('desktop-table')).toBeInTheDocument();
  });

  test('renders mobile list when viewMode is table and mobile', () => {
    renderResults({ viewMode: 'table', isMobile: true });
    expect(screen.getByTestId('mobile-list')).toBeInTheDocument();
  });

  test('renders empty message when there are no videos and not loading', () => {
    renderResults({ viewMode: 'grid', isMobile: false, videos: [] });
    expect(screen.getByText('No videos found')).toBeInTheDocument();
  });

  test('renders skeletons while loading with no videos yet', () => {
    renderResults({
      viewMode: 'grid',
      isMobile: false,
      videos: [],
      loading: true,
    });
    // No concrete view-card is rendered while showing the loading state.
    expect(screen.queryByTestId('grid-card')).not.toBeInTheDocument();
    // And the empty-state message is not shown while loading.
    expect(screen.queryByText('No videos found')).not.toBeInTheDocument();
  });
});
