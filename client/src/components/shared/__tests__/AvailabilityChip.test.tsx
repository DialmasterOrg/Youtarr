import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AvailabilityChip from '../AvailabilityChip';
import { renderWithProviders } from '../../../test-utils';

describe('AvailabilityChip', () => {
  test('renders Available for a present file', () => {
    renderWithProviders(<AvailabilityChip state="present" />);
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.queryByText('Missing')).not.toBeInTheDocument();
  });

  test('renders Missing for a file Youtarr could not find', () => {
    renderWithProviders(<AvailabilityChip state="missing" />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  test('renders Deleted for a file Youtarr removed', () => {
    renderWithProviders(<AvailabilityChip state="deleted" />);
    expect(screen.getByText('Deleted')).toBeInTheDocument();
    expect(screen.getByTestId('DeletedChipIcon')).toBeInTheDocument();
  });

  test('explains the removal in its tooltip', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AvailabilityChip state="deleted" tooltip="Deleted by automatic cleanup on 10/3/2026 (older than 30 days)." />
    );

    await user.hover(screen.getByText('Deleted'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Deleted by automatic cleanup on 10/3/2026 (older than 30 days).');
  });

  test('takes a label override for summary counts', () => {
    renderWithProviders(<AvailabilityChip state="missing" label="2 missing" />);
    expect(screen.getByText('2 missing')).toBeInTheDocument();
  });

  test('renders with compact styling when compact prop is true', () => {
    renderWithProviders(<AvailabilityChip state="present" compact />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });
});
