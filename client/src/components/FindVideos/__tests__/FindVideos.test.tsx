import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isCancel: (err: unknown) => Boolean(err && (err as { name?: string }).name === 'CanceledError'),
  CanceledError: class CanceledError extends Error {
    constructor() { super('canceled'); this.name = 'CanceledError'; }
  },
}));

jest.mock('../../shared/VideoModal', () => ({
  __esModule: true,
  default: function MockVideoModal(props: { open: boolean; video: { title: string } }) {
    const React = require('react');
    if (!props.open) return null;
    return React.createElement('div', { 'data-testid': 'mock-video-modal' }, props.video.title);
  },
}));

const axios = require('axios');
const FindVideos = require('../index').default;

describe('FindVideos page', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('submitting a search renders results', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [{
        youtubeId: 'abc12345678', title: 'Hello World', channelName: 'Chan',
        channelId: null, duration: 120, thumbnailUrl: null, publishedAt: null,
        viewCount: null, status: 'never_downloaded',
      }] },
    });

    render(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    expect(await screen.findByText('Hello World')).toBeInTheDocument();
  });

  test('clicking a result opens the VideoModal', async () => {
    axios.post.mockResolvedValueOnce({
      data: { results: [{
        youtubeId: 'abc12345678', title: 'Pick me', channelName: 'Chan',
        channelId: null, duration: 120, thumbnailUrl: null, publishedAt: null,
        viewCount: null, status: 'never_downloaded',
      }] },
    });

    render(<FindVideos token="t" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));
    expect(await screen.findByText('Pick me')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open pick me/i }));
    expect(screen.getByTestId('mock-video-modal')).toHaveTextContent('Pick me');
  });
});
