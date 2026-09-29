import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OpenInYouTubeLink, { youtubeChannelUrl, youtubePlaylistUrl } from '../OpenInYouTubeLink';

describe('OpenInYouTubeLink', () => {
  test('renders a labelled link to the given URL', () => {
    render(<OpenInYouTubeLink href="https://www.youtube.com/channel/UC123" />);
    expect(screen.getByRole('link', { name: 'Open in YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/channel/UC123'
    );
  });

  test('opens in a new tab without an opener reference', () => {
    render(<OpenInYouTubeLink href="https://www.youtube.com/channel/UC123" />);
    const link = screen.getByRole('link', { name: 'Open in YouTube' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('uses a custom accessible name when one is given', () => {
    render(
      <OpenInYouTubeLink href="https://www.youtube.com/channel/UC123" ariaLabel="Open Alpha in YouTube" />
    );
    expect(screen.getByRole('link', { name: 'Open Alpha in YouTube' })).toBeInTheDocument();
  });
});

describe('youtubeChannelUrl', () => {
  test('builds a channel URL from the channel ID', () => {
    expect(youtubeChannelUrl('UCabc_123-XYZ')).toBe('https://www.youtube.com/channel/UCabc_123-XYZ');
  });

  test('encodes characters that are unsafe in a path segment', () => {
    expect(youtubeChannelUrl('a/b?c')).toBe('https://www.youtube.com/channel/a%2Fb%3Fc');
  });
});

describe('youtubePlaylistUrl', () => {
  test('builds a playlist URL from the playlist ID', () => {
    expect(youtubePlaylistUrl('PLabc_123-XYZ')).toBe('https://www.youtube.com/playlist?list=PLabc_123-XYZ');
  });

  test('encodes characters that are unsafe in a query value', () => {
    expect(youtubePlaylistUrl('a&b=c')).toBe('https://www.youtube.com/playlist?list=a%26b%3Dc');
  });
});
