import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DurationBadge, YoutubeRemovedBanner } from '../thumbnailOverlays';

describe('YoutubeRemovedBanner', () => {
  test('says the video was removed from YouTube', () => {
    render(<YoutubeRemovedBanner compact />);

    expect(screen.getByText('Removed From YouTube')).toBeInTheDocument();
  });

  test('lets clicks through to the thumbnail under it', () => {
    render(<YoutubeRemovedBanner />);

    expect(screen.getByText('Removed From YouTube')).toHaveStyle({ pointerEvents: 'none' });
  });
});

describe('DurationBadge', () => {
  test('shows the duration as its two largest units', () => {
    render(<DurationBadge duration={3905} />);

    expect(screen.getByText('1h5m')).toBeInTheDocument();
  });

  test.each([[null], [undefined], [0]])('shows nothing for a duration of %s', (duration) => {
    const { container } = render(<DurationBadge duration={duration} />);

    expect(container).toBeEmptyDOMElement();
  });
});
