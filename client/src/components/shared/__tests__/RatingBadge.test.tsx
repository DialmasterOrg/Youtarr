import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RatingBadge from '../RatingBadge';

describe('RatingBadge', () => {
  describe('Rendering', () => {
    test('renders nothing when rating is null and showNA is false', () => {
      const { container } = render(<RatingBadge rating={null} />);
      expect(container.innerHTML).toBe('');
    });

    test('renders nothing when rating is undefined and showNA is false', () => {
      const { container } = render(<RatingBadge rating={undefined} />);
      expect(container.innerHTML).toBe('');
    });

    test('renders subtle "Unrated" text when rating is null and showNA is true', () => {
      render(<RatingBadge rating={null} showNA />);
      const text = screen.getByText('Unrated');
      expect(text).toBeInTheDocument();
      // Should not show the 18+ icon for unrated
      expect(screen.queryByTestId('EighteenUpRatingIcon')).not.toBeInTheDocument();
    });

    test('renders rating text for a valid rating', () => {
      render(<RatingBadge rating="PG-13" />);
      expect(screen.getByText('PG-13')).toBeInTheDocument();
    });

    test('renders as chip variant by default', () => {
      render(<RatingBadge rating="R" />);
      expect(screen.getByText('R')).toBeInTheDocument();
    });

    test('renders as text variant when specified', () => {
      render(<RatingBadge rating="R" variant="text" />);
      expect(screen.getByText('R')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Color mapping - renders correct ratings', () => {
    test.each([
      ['G', 'success'],
      ['TV-Y', 'success'],
      ['TV-G', 'success'],
      ['PG', 'warning'],
      ['TV-PG', 'warning'],
      ['PG-13', 'warning'],
      ['TV-14', 'warning'],
      ['R', 'error'],
      ['TV-MA', 'error'],
      ['NC-17', 'error'],
    ])('renders %s rating with correct text', (rating) => {
      render(<RatingBadge rating={rating} />);
      expect(screen.getByText(rating)).toBeInTheDocument();
    });

    test('renders Unrated for null rating with showNA', () => {
      render(<RatingBadge rating={null} showNA />);
      expect(screen.getByText('Unrated')).toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    test('includes rating source in tooltip when provided', () => {
      render(<RatingBadge rating="R" ratingSource="Manual Override" />);
      expect(screen.getByText('R')).toBeInTheDocument();
    });

    test('shows rating without source when ratingSource is null', () => {
      render(<RatingBadge rating="PG" />);
      expect(screen.getByText('PG')).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    test('renders small size by default', () => {
      render(<RatingBadge rating="G" />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });

    test('renders medium size when specified', () => {
      render(<RatingBadge rating="G" size="medium" />);
      expect(screen.getByText('G')).toBeInTheDocument();
    });
  });

  describe('Text variant', () => {
    test('renders text variant with icon', () => {
      render(<RatingBadge rating="R" variant="text" />);
      expect(screen.getByText('R')).toBeInTheDocument();
      expect(screen.getByTestId('EighteenUpRatingIcon')).toBeInTheDocument();
    });
  });

  describe('All rating values', () => {
    test.each([
      'G', 'PG', 'PG-13', 'R', 'NC-17',
      'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'
    ])('renders %s rating correctly', (rating) => {
      render(<RatingBadge rating={rating} />);
      expect(screen.getByText(rating)).toBeInTheDocument();
      expect(screen.getByTestId('EighteenUpRatingIcon')).toBeInTheDocument();
    });
  });
});
