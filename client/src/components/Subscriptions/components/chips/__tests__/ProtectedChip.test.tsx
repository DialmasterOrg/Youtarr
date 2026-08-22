import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedChip from '../ProtectedChip';
import { renderWithProviders } from '../../../../../test-utils';

describe('ProtectedChip', () => {
  test('renders nothing when autoRemovalProtected is false', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={false} />);
    expect(screen.queryByTestId('protected-chip')).not.toBeInTheDocument();
  });

  test('renders nothing when autoRemovalProtected is undefined', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={undefined} />);
    expect(screen.queryByTestId('protected-chip')).not.toBeInTheDocument();
  });

  test('renders chip with Protected (All) label when autoRemovalProtected is true', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={true} />);
    const chip = screen.getByTestId('protected-chip');
    expect(chip).toHaveTextContent('Protected (All)');
  });

  test('exposes an aria-label explaining the protection', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={true} />);
    const chip = screen.getByTestId('protected-chip');
    expect(chip).toHaveAttribute(
      'aria-label',
      expect.stringContaining('protected from auto-removal')
    );
  });

  test('renders Protected (N) when only a keep-recent count is set', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={false} keepRecentCount={25} />);
    const chip = screen.getByTestId('protected-chip');
    expect(chip).toHaveTextContent('Protected (25)');
    expect(chip).toHaveAttribute(
      'aria-label',
      expect.stringContaining('always keeps this channel\'s 25 most recently downloaded videos')
    );
  });

  test('renders nothing when keepRecentCount is null and not protected', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={false} keepRecentCount={null} />);
    expect(screen.queryByTestId('protected-chip')).not.toBeInTheDocument();
  });

  test('full protection wins over a keep-recent count', () => {
    renderWithProviders(<ProtectedChip autoRemovalProtected={true} keepRecentCount={25} />);
    const chip = screen.getByTestId('protected-chip');
    expect(chip).toHaveTextContent('Protected (All)');
    expect(chip).not.toHaveTextContent('Protected (25)');
  });
});
