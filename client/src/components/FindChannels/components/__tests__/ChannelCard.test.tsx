import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelCard from '../ChannelCard';
import { ChannelSearchResult } from '../../types';

const base: ChannelSearchResult = {
  channelId: 'UCa',
  name: 'Alpha Channel',
  handle: '@alpha',
  url: 'https://www.youtube.com/channel/UCa',
  thumbnailUrl: 'https://yt3.ggpht.com/a=s176',
  subscriberCount: 2420000,
  videoCount: 312,
  description: 'About alpha',
  subscribed: false,
};

describe('ChannelCard', () => {
  test('renders name, handle, and formatted counts', () => {
    render(<ChannelCard result={base} onClick={jest.fn()} />);

    expect(screen.getByText('Alpha Channel')).toBeInTheDocument();
    expect(screen.getByText('@alpha')).toBeInTheDocument();
    expect(screen.getByText('2.4M subscribers')).toBeInTheDocument();
    expect(screen.getByText('312 videos')).toBeInTheDocument();
  });

  test('omits subscriber and video counts when null', () => {
    render(
      <ChannelCard
        result={{ ...base, subscriberCount: null, videoCount: null, handle: null }}
        onClick={jest.fn()}
      />
    );

    expect(screen.queryByText(/subscribers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/videos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  test('shows the Subscribed badge only when subscribed', () => {
    const { rerender } = render(<ChannelCard result={base} onClick={jest.fn()} />);
    expect(screen.queryByText('Subscribed')).not.toBeInTheDocument();

    rerender(<ChannelCard result={{ ...base, subscribed: true }} onClick={jest.fn()} />);
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
  });

  test('invokes onClick when activated', () => {
    const onClick = jest.fn();
    render(<ChannelCard result={base} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', { name: /add alpha channel/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('labels a subscribed card as View instead of Add', () => {
    render(<ChannelCard result={{ ...base, subscribed: true }} onClick={jest.fn()} />);

    expect(screen.getByRole('button', { name: /view alpha channel/i })).toBeInTheDocument();
  });

  test('avatar image lazy-loads to avoid bursting the thumbnail CDN', () => {
    render(<ChannelCard result={base} onClick={jest.fn()} />);

    expect(screen.getByAltText('Alpha Channel')).toHaveAttribute('loading', 'lazy');
  });
});
