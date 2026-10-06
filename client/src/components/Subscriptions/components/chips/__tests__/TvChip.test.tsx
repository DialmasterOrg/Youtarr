import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TvChip from '../TvChip';

describe('TvChip', () => {
  test('labels the channel as a TV show', () => {
    render(<TvChip />);
    expect(screen.getByTestId('tv-chip')).toHaveTextContent('TV');
  });
});
