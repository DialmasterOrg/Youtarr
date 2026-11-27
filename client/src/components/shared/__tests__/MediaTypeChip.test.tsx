import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaTypeChip from '../MediaTypeChip';

describe('MediaTypeChip', () => {
  test.each([
    ['short', 'Short'],
    ['livestream', 'Live'],
  ])('marks a %s', (mediaType, label) => {
    render(<MediaTypeChip mediaType={mediaType} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test('shows nothing for an ordinary video', () => {
    const { container } = render(<MediaTypeChip mediaType="video" />);

    expect(container).toBeEmptyDOMElement();
  });
});
