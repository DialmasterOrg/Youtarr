import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PendingSaveBanner from '../PendingSaveBanner';
import { renderWithProviders } from '../../../../test-utils';

describe('PendingSaveBanner', () => {
  describe('Visibility', () => {
    test('renders banner when show is true', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });
    });

    test('does not render banner when show is false', () => {
      renderWithProviders(<PendingSaveBanner show={false} />);

      expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();
    });

    test('shows banner after changing from hidden to visible', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={false} />);

      expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();

      rerender(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });
    });

    test('hides banner after changing from visible to hidden', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });

      rerender(<PendingSaveBanner show={false} />);

      await waitFor(() => {
        expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();
      });
    });
  });

  describe('Content and Appearance', () => {
    test('renders warning alert with correct message', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('You have pending changes. Save to apply them.');
    });

    test('displays warning icon', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument();
      });
    });

    test('alert has warning severity', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('alert is accessible with role="alert"', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
      });
    });

    test('message is readable by screen readers', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        const message = screen.getByText('You have pending changes. Save to apply them.');
        expect(message).toBeInTheDocument();
      });
    });

    test('warning icon is present for visual context', async () => {
      renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        const icon = screen.getByTestId('WarningAmberIcon');
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe('Animation Behavior', () => {
    test('mounts content when show becomes true', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={false} />);

      expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();

      rerender(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });
    });

    test('unmounts content when show becomes false', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });

      rerender(<PendingSaveBanner show={false} />);

      await waitFor(() => {
        expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple State Changes', () => {
    test('handles multiple show/hide cycles', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={false} />);

      // First show
      rerender(<PendingSaveBanner show={true} />);
      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });

      // First hide
      rerender(<PendingSaveBanner show={false} />);
      await waitFor(() => {
        expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();
      });

      // Second show
      rerender(<PendingSaveBanner show={true} />);
      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });

      // Second hide
      rerender(<PendingSaveBanner show={false} />);
      await waitFor(() => {
        expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();
      });
    });

    test('remains visible when show stays true', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
      });

      // Re-render with same prop
      rerender(<PendingSaveBanner show={true} />);

      expect(screen.getByText('You have pending changes. Save to apply them.')).toBeInTheDocument();
    });

    test('remains hidden when show stays false', () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={false} />);

      expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();

      // Re-render with same prop
      rerender(<PendingSaveBanner show={false} />);

      expect(screen.queryByText('You have pending changes. Save to apply them.')).not.toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    test('renders without crashing', () => {
      renderWithProviders(<PendingSaveBanner show={false} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('can be rendered multiple times', async () => {
      const { rerender } = renderWithProviders(<PendingSaveBanner show={true} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      rerender(<PendingSaveBanner show={true} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
