import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideoThumbnail from '../ChannelVideoThumbnail';
import { getChannelVideoRowState } from '../../channelVideoRowState';
import { ChannelVideo } from '../../../../types/ChannelVideo';
import { renderWithProviders } from '../../../../test-utils';

const baseVideo: ChannelVideo = {
  title: 'Test Video',
  youtube_id: 'vid1',
  publishedAt: '2026-01-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
  added: false,
  duration: 605,
  media_type: 'video',
  live_status: null,
};

describe('ChannelVideoThumbnail', () => {
  const handlers = {
    onCheckChange: jest.fn(),
    onDeletionChange: jest.fn(),
    onToggleIgnore: jest.fn(),
    onToggleProtection: jest.fn(),
  };

  const renderThumbnail = (size: 'card' | 'row', video: ChannelVideo = baseVideo, selectedForDeletion: string[] = []) =>
    renderWithProviders(
      <ChannelVideoThumbnail
        video={video}
        row={getChannelVideoRowState(video, selectedForDeletion.length ? 'delete' : null, [], selectedForDeletion)}
        size={size}
        isMobile={false}
        {...handlers}
      />
    );

  beforeEach(() => jest.clearAllMocks());

  test.each(['card', 'row'] as const)('the %s size shows the duration and a labelled ignore button', async (size) => {
    renderThumbnail(size);

    await userEvent.click(screen.getByRole('button', { name: 'Click to ignore' }));

    expect(screen.getByText('10m5s')).toBeInTheDocument();
    expect(handlers.onToggleIgnore).toHaveBeenCalledWith('vid1');
  });

  test('its one checkbox selects for download, or for deletion once the video has a file', async () => {
    const { unmount } = renderThumbnail('card');
    await userEvent.click(screen.getByRole('checkbox'));
    unmount();

    renderThumbnail('card', { ...baseVideo, added: true }, ['other']);
    await userEvent.click(screen.getByRole('checkbox'));

    expect(handlers.onCheckChange).toHaveBeenCalledWith('vid1', true);
    expect(handlers.onDeletionChange).toHaveBeenCalledWith('vid1', true);
  });
});
