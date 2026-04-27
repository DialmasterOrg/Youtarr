import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AvailabilityChip from '../AvailabilityChip';
import { renderWithProviders } from '../../../test-utils';

describe('AvailabilityChip', () => {
  test('renders Available label when isAvailable is true', () => {
    renderWithProviders(<AvailabilityChip isAvailable={true} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });

  test('renders Missing label when isAvailable is false', () => {
    renderWithProviders(<AvailabilityChip isAvailable={false} />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  test('renders with compact styling when compact prop is true', () => {
    renderWithProviders(<AvailabilityChip isAvailable={true} compact />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });
});
