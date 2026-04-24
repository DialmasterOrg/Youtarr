import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VideoThumbnail from '../VideoThumbnail';
import { VideoData } from '../../../types/VideoData';

const baseVideo: VideoData = {
  id: 1,
  youtubeId: 'abc123',
  youTubeChannelName: 'Test Channel',
  youTubeVideoName: 'Test Video',
  duration: 120,
  timeCreated: '2024-01-15T09:00:00Z',
  originalDate: null,
  description: null,
};

function renderThumbnail(overrides: Partial<React.ComponentProps<typeof VideoThumbnail>> = {}) {
  const onClick = jest.fn();
  const onError = jest.fn();

  const utils = render(
    <VideoThumbnail
      video={baseVideo}
      width={128}
      height={72}
      onClick={onClick}
      hasError={false}
      onError={onError}
      iconSize={32}
      {...overrides}
    />
  );

  return { ...utils, onClick, onError };
}

describe('VideoThumbnail', () => {
  test('renders the image with the local thumbnail URL and alt from video title', () => {
    renderThumbnail();

    const img = screen.getByRole('img', { name: 'Test Video' });
    expect(img).toHaveAttribute('src', '/images/videothumb-abc123.jpg');
  });

  test('invokes onClick when the thumbnail is clicked', async () => {
    const user = userEvent.setup();
    const { onClick } = renderThumbnail();

    await user.click(screen.getByTestId('video-thumbnail'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('calls onError when the image fails to load', () => {
    const { onError } = renderThumbnail();

    fireEvent.error(screen.getByRole('img', { name: 'Test Video' }));

    expect(onError).toHaveBeenCalledTimes(1);
  });

  test('renders "No thumbnail" fallback when hasError is true', () => {
    renderThumbnail({ hasError: true });

    expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Test Video' })).not.toBeInTheDocument();
  });

  test('does not render the missing overlay for a non-removed video', () => {
    renderThumbnail();

    expect(screen.queryByTestId('video-thumbnail-missing-overlay')).not.toBeInTheDocument();
  });

  test('renders the missing overlay when video.removed is true', () => {
    renderThumbnail({ video: { ...baseVideo, removed: true } });

    expect(screen.getByTestId('video-thumbnail-missing-overlay')).toBeInTheDocument();
  });

  test('shows missing overlay on top of the "No thumbnail" fallback for a removed video', () => {
    renderThumbnail({ hasError: true, video: { ...baseVideo, removed: true } });

    expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    expect(screen.getByTestId('video-thumbnail-missing-overlay')).toBeInTheDocument();
  });

  test('uses objectFit: contain for shorts and objectFit: cover for regular videos', () => {
    const { rerender } = render(
      <VideoThumbnail
        video={{ ...baseVideo, media_type: 'short' }}
        width={128}
        height={72}
        onClick={jest.fn()}
        hasError={false}
        onError={jest.fn()}
        iconSize={32}
      />
    );
    expect(screen.getByRole('img', { name: 'Test Video' })).toHaveStyle({ objectFit: 'contain' });

    rerender(
      <VideoThumbnail
        video={{ ...baseVideo, media_type: 'video' }}
        width={128}
        height={72}
        onClick={jest.fn()}
        hasError={false}
        onError={jest.fn()}
        iconSize={32}
      />
    );
    expect(screen.getByRole('img', { name: 'Test Video' })).toHaveStyle({ objectFit: 'cover' });
  });
});
