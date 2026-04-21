import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideosListMobile from '../VideosListMobile';
import { VideoData, EnabledChannel } from '../../../../types/VideoData';

jest.mock('../../../shared/RatingBadge', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../shared/ProtectionShieldButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../shared/ThumbnailClickOverlay', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => {
    const React2 = require('react');
    return React2.createElement('button', { onClick, 'aria-label': 'thumb-overlay' }, 'O');
  },
}));

const enabledChannels: EnabledChannel[] = [{ channel_id: 'UC1', uploader: 'Creator' }];

const sampleVideo: VideoData = {
  id: 1,
  youtubeId: 'abc',
  youTubeChannelName: 'Creator',
  youTubeVideoName: 'Compact Row Video',
  timeCreated: '2024-01-15T10:30:00',
  originalDate: '20240110',
  duration: 120,
  description: null,
  fileSize: '1073741824',
  filePath: '/data/video.mp4',
  removed: false,
};

const renderList = (overrides: Partial<React.ComponentProps<typeof VideosListMobile>> = {}) => {
  const handlers = {
    onToggleSelect: jest.fn(),
    onOpenModal: jest.fn(),
    onToggleProtection: jest.fn(),
    onImageError: jest.fn(),
  };
  render(
    <MemoryRouter>
      <VideosListMobile
        videos={[sampleVideo]}
        selectedVideos={[]}
        enabledChannels={enabledChannels}
        imageErrors={{}}
        {...handlers}
        {...overrides}
      />
    </MemoryRouter>
  );
  return handlers;
};

describe('VideosListMobile', () => {
  test('renders title, channel link, duration and added date', () => {
    renderList();
    expect(screen.getByText('Compact Row Video')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Creator' })).toHaveAttribute('href', '/channel/UC1');
    expect(screen.getByText('2m')).toBeInTheDocument();
    expect(screen.getByText(/Downloaded:/)).toBeInTheDocument();
  });

  test('clicking the row body toggles selection for selectable videos', () => {
    const { onToggleSelect } = renderList();
    fireEvent.click(screen.getByRole('button', { name: /Compact Row Video/ }));
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });

  test('omits checkbox and row-click for removed videos', () => {
    const { onToggleSelect } = renderList({
      videos: [{ ...sampleVideo, removed: true }],
    });
    expect(screen.queryByRole('checkbox', { name: /Select Compact Row Video/ })).not.toBeInTheDocument();
    // Row should not be a button when not selectable.
    expect(screen.queryByRole('button', { name: /Compact Row Video/ })).not.toBeInTheDocument();
    expect(onToggleSelect).not.toHaveBeenCalled();
  });
});
