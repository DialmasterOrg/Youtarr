import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideoCard from '../VideoCard';
import { VideoData, EnabledChannel } from '../../../../types/VideoData';

jest.mock('../../../shared/RatingBadge', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../../shared/ProtectionShieldButton', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => {
    const React2 = require('react');
    return React2.createElement('button', { onClick, 'aria-label': 'protection' }, 'P');
  },
}));
jest.mock('../../../shared/ThumbnailClickOverlay', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => {
    const React2 = require('react');
    return React2.createElement('button', { onClick, 'aria-label': 'thumb-overlay' }, 'O');
  },
}));

const baseVideo: VideoData = {
  id: 1,
  youtubeId: 'abc',
  youTubeChannelName: 'Tech Channel',
  youTubeVideoName: 'Test Video',
  timeCreated: '2024-01-15T10:30:00',
  originalDate: '20240110',
  duration: 600,
  description: null,
  filePath: '/data/video.mp4',
  fileSize: '1073741824',
  removed: false,
  protected: false,
};

const enabledChannels: EnabledChannel[] = [
  { channel_id: 'UC1', uploader: 'Tech Channel' },
];

const renderCard = (overrides: Partial<React.ComponentProps<typeof VideoCard>> = {}) => {
  const handlers = {
    onToggleSelect: jest.fn(),
    onOpenModal: jest.fn(),
    onToggleProtection: jest.fn(),
    onDeleteSingle: jest.fn(),
    onImageError: jest.fn(),
  };
  render(
    <MemoryRouter>
      <VideoCard
        video={baseVideo}
        selected={false}
        enabledChannels={enabledChannels}
        imageErrored={false}
        deleteDisabled={false}
        {...handlers}
        {...overrides}
      />
    </MemoryRouter>
  );
  return handlers;
};

describe('VideoCard', () => {
  test('renders title and channel link when channel is enabled', () => {
    renderCard();
    expect(screen.getByText('Test Video')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tech Channel' })).toHaveAttribute(
      'href',
      '/channel/UC1'
    );
  });

  test('renders the channel as text when no enabled match', () => {
    renderCard({ enabledChannels: [] });
    expect(screen.queryByRole('link', { name: 'Tech Channel' })).not.toBeInTheDocument();
    expect(screen.getByText('Tech Channel')).toBeInTheDocument();
  });

  test('clicking the title fires onOpenModal', () => {
    const { onOpenModal } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Test Video' }));
    expect(onOpenModal).toHaveBeenCalledWith(baseVideo);
  });

  test('renders selection checkbox when selectable and reports clicks', () => {
    const { onToggleSelect } = renderCard();
    const checkbox = screen.getByRole('checkbox', { name: /Select Test Video/ });
    fireEvent.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });

  test('renders selection checkbox for audio-only downloads with no video fileSize', () => {
    const { onToggleSelect } = renderCard({
      video: {
        ...baseVideo,
        filePath: null,
        fileSize: null,
        audioFilePath: '/data/audio.mp3',
        audioFileSize: '5242880',
      },
    });
    const checkbox = screen.getByRole('checkbox', { name: /Select Test Video/ });
    fireEvent.click(checkbox);
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });

  test('omits selection checkbox when video is removed', () => {
    renderCard({ video: { ...baseVideo, removed: true } });
    expect(screen.queryByRole('checkbox', { name: /Select Test Video/ })).not.toBeInTheDocument();
  });

  test('shows Available chip for present files and Missing chip for removed', () => {
    const { unmount } = render(
      <MemoryRouter>
        <VideoCard
          video={baseVideo}
          selected={false}
          enabledChannels={enabledChannels}
          imageErrored={false}
          deleteDisabled={false}
          onToggleSelect={jest.fn()}
          onOpenModal={jest.fn()}
          onToggleProtection={jest.fn()}
          onDeleteSingle={jest.fn()}
          onImageError={jest.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByText('Available')).toBeInTheDocument();
    unmount();
    renderCard({ video: { ...baseVideo, removed: true } });
    expect(screen.getByText('Missing')).toBeInTheDocument();
  });

  test('delete button calls onDeleteSingle with the video id', () => {
    const { onDeleteSingle } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Delete video from disk' }));
    expect(onDeleteSingle).toHaveBeenCalledWith(1);
  });
});
