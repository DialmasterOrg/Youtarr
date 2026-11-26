import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ChannelVideosSelectButtons from '../ChannelVideosSelectButtons';

type Props = React.ComponentProps<typeof ChannelVideosSelectButtons>;

describe('ChannelVideosSelectButtons', () => {
  const onSelectPending = jest.fn();
  const onSelectDownloaded = jest.fn();

  const renderButtons = (props: Partial<Props> = {}) =>
    render(
      <ChannelVideosSelectButtons
        canSelectPending
        canSelectDownloaded
        onSelectPending={onSelectPending}
        onSelectDownloaded={onSelectDownloaded}
        {...props}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Select pending selects the videos that can be downloaded', async () => {
    renderButtons();

    await userEvent.click(screen.getByRole('button', { name: 'Select pending' }));

    expect(onSelectPending).toHaveBeenCalledTimes(1);
    expect(onSelectDownloaded).not.toHaveBeenCalled();
  });

  test('Select downloaded selects the downloaded videos', async () => {
    renderButtons();

    await userEvent.click(screen.getByRole('button', { name: 'Select downloaded' }));

    expect(onSelectDownloaded).toHaveBeenCalledTimes(1);
    expect(onSelectPending).not.toHaveBeenCalled();
  });

  test('Select pending is disabled when no video can be downloaded', () => {
    renderButtons({ canSelectPending: false });

    expect(screen.getByRole('button', { name: 'Select pending' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select downloaded' })).toBeEnabled();
  });

  test('Select downloaded is disabled when no video is downloaded', () => {
    renderButtons({ canSelectDownloaded: false });

    expect(screen.getByRole('button', { name: 'Select downloaded' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select pending' })).toBeEnabled();
  });
});
