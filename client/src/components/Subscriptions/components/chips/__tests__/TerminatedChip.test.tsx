import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TerminatedChip from '../TerminatedChip';
import { renderWithProviders } from '../../../../../test-utils';

describe('TerminatedChip', () => {
  test('renders nothing when terminatedAt is null', () => {
    renderWithProviders(<TerminatedChip terminatedAt={null} />);
    expect(screen.queryByTestId('terminated-chip')).not.toBeInTheDocument();
  });

  test('renders nothing when terminatedAt is undefined', () => {
    renderWithProviders(<TerminatedChip terminatedAt={undefined} />);
    expect(screen.queryByTestId('terminated-chip')).not.toBeInTheDocument();
  });

  test('renders chip with Terminated label when terminatedAt is set', () => {
    renderWithProviders(<TerminatedChip terminatedAt="2026-03-15T12:00:00Z" />);
    const chip = screen.getByTestId('terminated-chip');
    expect(chip).toHaveTextContent('Terminated');
  });

  test('uses an aria-label naming the formatted detection date', () => {
    renderWithProviders(<TerminatedChip terminatedAt="2026-03-15T12:00:00Z" />);
    const chip = screen.getByTestId('terminated-chip');
    expect(chip).toHaveAttribute(
      'aria-label',
      expect.stringContaining('YouTube terminated this channel; detected on')
    );
  });

  test('handles invalid date strings without crashing', () => {
    renderWithProviders(<TerminatedChip terminatedAt="not-a-real-date" />);
    const chip = screen.getByTestId('terminated-chip');
    expect(chip).toHaveAttribute('aria-label', expect.stringContaining('unknown date'));
  });
});
