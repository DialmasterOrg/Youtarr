import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfigurationSkeleton from '../ConfigurationSkeleton';
import { renderWithProviders } from '../../../../test-utils';

describe('ConfigurationSkeleton Component', () => {
  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('displays loading message', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('displays loading spinner', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();
    });

    test('renders loading message in heading element', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const loadingText = screen.getByText('Loading configuration...');
      expect(loadingText).toBeInTheDocument();
      expect(loadingText.tagName).toBe('H6');
    });
  });

  describe('Loading State Visualization', () => {
    test('includes loading spinner in header', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();
    });

    test('displays loading header with spinner and text together', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('provides complete loading state feedback', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      // Should have both accessible loading indicators
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('loading spinner is accessible', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeInTheDocument();
    });

    test('loading message is visible to screen readers', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('component provides visual feedback for loading state', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      // Should have both spinner and text for comprehensive loading feedback
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('loading text is in proper heading structure', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const loadingText = screen.getByText('Loading configuration...');
      expect(loadingText.tagName).toBe('H6');
    });
  });

  describe('Component Behavior', () => {
    test('renders consistently on multiple renders', () => {
      const { rerender } = renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      rerender(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('handles being unmounted and remounted', () => {
      const { unmount } = renderWithProviders(<ConfigurationSkeleton />);
      unmount();

      renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('displays loading state immediately on render', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      // Both loading indicators should be present immediately
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    test('renders complete loading placeholder for Configuration page', () => {
      renderWithProviders(<ConfigurationSkeleton />);

      // Verify the accessible loading indicators are present
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('provides loading state for user while configuration loads', () => {
      renderWithProviders(<ConfigurationSkeleton />);

      // Users should see clear loading feedback
      const spinner = screen.getByRole('progressbar');
      const message = screen.getByText('Loading configuration...');

      expect(spinner).toBeInTheDocument();
      expect(message).toBeInTheDocument();
    });
  });

  describe('Props and State', () => {
    test('renders without requiring any props', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    test('maintains consistent rendering without props', () => {
      const { rerender } = renderWithProviders(<ConfigurationSkeleton />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();

      rerender(<ConfigurationSkeleton />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('User Experience', () => {
    test('shows clear loading message to users', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const message = screen.getByText('Loading configuration...');
      expect(message).toBeVisible();
    });

    test('displays animated loading spinner for visual feedback', () => {
      renderWithProviders(<ConfigurationSkeleton />);
      const spinner = screen.getByRole('progressbar');
      expect(spinner).toBeVisible();
    });

    test('combines text and visual loading indicators', () => {
      renderWithProviders(<ConfigurationSkeleton />);

      // Should have both text and spinner for better UX
      expect(screen.getByText('Loading configuration...')).toBeVisible();
      expect(screen.getByRole('progressbar')).toBeVisible();
    });
  });
});
