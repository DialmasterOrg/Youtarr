import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TerminatedNotice from '../TerminatedNotice';
import { renderWithProviders } from '../../../../test-utils';

describe('TerminatedNotice', () => {
  test('renders nothing when terminatedAt is null', () => {
    renderWithProviders(<TerminatedNotice terminatedAt={null} />);
    expect(screen.queryByTestId('terminated-notice')).not.toBeInTheDocument();
  });

  test('renders nothing when terminatedAt is undefined', () => {
    renderWithProviders(<TerminatedNotice terminatedAt={undefined} />);
    expect(screen.queryByTestId('terminated-notice')).not.toBeInTheDocument();
  });

  test('renders the full message with formatted date when terminatedAt is set', () => {
    renderWithProviders(<TerminatedNotice terminatedAt="2026-03-15T12:00:00Z" />);
    const notice = screen.getByTestId('terminated-notice');
    expect(notice).toHaveTextContent(/YouTube terminated this channel; detected on/);
    expect(notice).toHaveTextContent(/Scheduled downloads are disabled\./);
  });

  test('falls back to "unknown date" when terminatedAt is not a valid date', () => {
    renderWithProviders(<TerminatedNotice terminatedAt="not-a-real-date" />);
    expect(screen.getByTestId('terminated-notice')).toHaveTextContent(/detected on unknown date/);
  });

  test('exposes a status role for accessibility', () => {
    renderWithProviders(<TerminatedNotice terminatedAt="2026-03-15T12:00:00Z" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
