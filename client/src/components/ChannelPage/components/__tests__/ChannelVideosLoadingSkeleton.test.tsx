import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChannelVideosLoadingSkeleton from '../ChannelVideosLoadingSkeleton';

test('says the tab is loading and being indexed', () => {
  render(<ChannelVideosLoadingSkeleton count={4} />);

  expect(
    screen.getByText('Loading and fetching/indexing new videos for this channel tab...')
  ).toBeInTheDocument();
});
