import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FailedVideoLine from '../FailedVideoLine';
import { FailedVideo } from '../../../types/Job';

describe('FailedVideoLine', () => {
  const video = (overrides: Partial<FailedVideo> = {}): FailedVideo => ({
    youtubeId: 'abc123def45',
    error: 'HTTP Error 403: Forbidden',
    ...overrides,
  });

  test('renders title, channel, and a YouTube link when metadata is known', () => {
    render(<FailedVideoLine video={video({ title: 'My Video', channel: 'My Channel' })} />);

    expect(screen.getByText(/My Video by My Channel/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'abc123def45' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abc123def45'
    );
  });

  test('renders only the YouTube ID link when there is no title', () => {
    render(<FailedVideoLine video={video()} />);

    expect(screen.getByRole('link', { name: 'abc123def45' })).toBeInTheDocument();
    expect(screen.queryByText(/ by /)).not.toBeInTheDocument();
  });

  test('renders the title without a channel suffix when channel is missing', () => {
    render(<FailedVideoLine video={video({ title: 'My Video' })} />);

    expect(screen.getByText(/My Video/)).toBeInTheDocument();
    expect(screen.queryByText(/ by /)).not.toBeInTheDocument();
  });

  test('treats the legacy Unknown sentinel as missing metadata', () => {
    render(<FailedVideoLine video={video({ title: 'Unknown', channel: 'Unknown' })} />);

    expect(screen.queryByText(/Unknown/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'abc123def45' })).toBeInTheDocument();
  });

  test('renders the channel after the ID link when only the channel is known', () => {
    render(<FailedVideoLine video={video({ channel: 'My Channel' })} />);

    expect(screen.getByRole('link', { name: 'abc123def45' })).toBeInTheDocument();
    expect(screen.getByText(/by My Channel/)).toBeInTheDocument();
  });

  test('treats the legacy Unknown Channel placeholder as missing', () => {
    render(<FailedVideoLine video={video({ title: 'My Video', channel: 'Unknown Channel' })} />);

    expect(screen.getByText(/My Video/)).toBeInTheDocument();
    expect(screen.queryByText(/ by /)).not.toBeInTheDocument();
  });

  test('opens the link in a new tab safely', () => {
    render(<FailedVideoLine video={video()} />);

    const link = screen.getByRole('link', { name: 'abc123def45' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
