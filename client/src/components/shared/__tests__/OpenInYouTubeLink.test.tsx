import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import OpenInYouTubeLink from '../OpenInYouTubeLink';

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
