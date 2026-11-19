import React from 'react';
import { render, screen } from '@testing-library/react';
import { LayoutChip } from '../LayoutChip';

describe('LayoutChip', () => {
  test('names each layout', () => {
    render(<><LayoutChip layout="videos" /><LayoutChip layout="tv" /></>);
    expect(screen.getByText('Videos')).toBeInTheDocument();
    expect(screen.getByText('TV shows')).toBeInTheDocument();
  });
});
