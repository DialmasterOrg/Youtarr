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

  const utils = render(
    <VideoThumbnail
      video={baseVideo}
      width={128}
      height={72}
      onClick={onClick}
      iconSize={32}
      {...overrides}
    />
  );

  return { ...utils, onClick };
}

const failImage = () => fireEvent.error(screen.getByRole('img', { name: 'Test Video' }));

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

  test('shows "No thumbnail" in place of an image that fails to load', () => {
    renderThumbnail();

    failImage();

    expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Test Video' })).not.toBeInTheDocument();
  });

  test('tries the image again for a different video', () => {
    const { rerender } = renderThumbnail();
    failImage();

    rerender(<VideoThumbnail video={{ ...baseVideo, youtubeId: 'other1' }} iconSize={32} />);

    expect(screen.getByRole('img', { name: 'Test Video' })).toHaveAttribute('src', '/images/videothumb-other1.jpg');
  });

  test('draws its children over the image', () => {
    renderThumbnail({ children: <span>12:34</span> });

    expect(screen.getByText('12:34')).toBeInTheDocument();
  });

  test('does not render the missing overlay for a non-removed video', () => {
    renderThumbnail();

    expect(screen.queryByTestId('video-thumbnail-missing-overlay')).not.toBeInTheDocument();
  });

  test('renders the missing overlay when the file was not found', () => {
    renderThumbnail({ video: { ...baseVideo, removed: true, removed_reason: 'not_found' } });

    expect(screen.getByTestId('video-thumbnail-missing-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('video-thumbnail-deleted-overlay')).not.toBeInTheDocument();
  });

  test('renders the neutral deleted overlay when Youtarr removed the file', () => {
    renderThumbnail({ video: { ...baseVideo, removed: true, removed_reason: 'user_deleted' } });

    expect(screen.getByTestId('video-thumbnail-deleted-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('video-thumbnail-missing-overlay')).not.toBeInTheDocument();
  });

  test('treats a video removed before the reason was recorded as deleted', () => {
    renderThumbnail({ video: { ...baseVideo, removed: true } });

    expect(screen.getByTestId('video-thumbnail-deleted-overlay')).toBeInTheDocument();
  });

  test('shows missing overlay on top of the "No thumbnail" fallback for a removed video', () => {
    renderThumbnail({ video: { ...baseVideo, removed: true, removed_reason: 'not_found' } });

    failImage();

    expect(screen.getByText('No thumbnail')).toBeInTheDocument();
    expect(screen.getByTestId('video-thumbnail-missing-overlay')).toBeInTheDocument();
  });

  test('uses objectFit: contain for shorts and objectFit: cover for regular videos', () => {
    const { rerender } = renderThumbnail({ video: { ...baseVideo, media_type: 'short' } });
    expect(screen.getByRole('img', { name: 'Test Video' })).toHaveStyle({ objectFit: 'contain' });

    rerender(<VideoThumbnail video={{ ...baseVideo, media_type: 'video' }} iconSize={32} />);
    expect(screen.getByRole('img', { name: 'Test Video' })).toHaveStyle({ objectFit: 'cover' });
  });
});
