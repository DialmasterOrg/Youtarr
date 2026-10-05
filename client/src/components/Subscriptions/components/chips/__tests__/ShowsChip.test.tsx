import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShowsChip from '../ShowsChip';

describe('ShowsChip', () => {
  test('counts a channel\'s title shows', () => {
    render(<ShowsChip count={3} />);
    expect(screen.getByTestId('shows-chip')).toHaveTextContent('3 shows');
  });

  test('says "1 show" for one', () => {
    render(<ShowsChip count={1} />);
    expect(screen.getByTestId('shows-chip')).toHaveTextContent('1 show');
  });

  test('renders nothing without shows', () => {
    render(<ShowsChip count={0} />);
    expect(screen.queryByTestId('shows-chip')).not.toBeInTheDocument();
  });
});
