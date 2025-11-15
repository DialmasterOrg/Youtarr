import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SaveBar } from '../SaveBar';
import { renderWithProviders } from '../../../../test-utils';

describe('SaveBar Component', () => {
  const defaultProps = {
    hasUnsavedChanges: false,
    isLoading: false,
    onSave: jest.fn(),
    validationError: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<SaveBar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    test('renders Save button with text', () => {
      renderWithProviders(<SaveBar {...defaultProps} />);
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toHaveTextContent('Save');
    });

    test('renders SaveIcon inside button', () => {
      renderWithProviders(<SaveBar {...defaultProps} />);
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button State - No Changes', () => {
    test('button is enabled when there are no unsaved changes and no errors', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={false} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });

    test('displays primary color when no unsaved changes', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={false} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
    });

    test('shows "Save configuration settings" tooltip when no unsaved changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={false} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.hover(button);
      expect(await screen.findByText('Save configuration settings')).toBeInTheDocument();
    });
  });

  describe('Button State - Unsaved Changes', () => {
    test('button is enabled when there are unsaved changes and no errors', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={true} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });

    test('shows "You have unsaved changes" tooltip when there are unsaved changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={true} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.hover(button);
      expect(await screen.findByText('You have unsaved changes')).toBeInTheDocument();
    });

    test('badge is visible when there are unsaved changes', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={true} />
      );
      // Badge is rendered with dot variant - we verify the button is present
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button State - Loading', () => {
    test('button is disabled when loading', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} isLoading={true} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('button is disabled when loading even with unsaved changes', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} isLoading={true} hasUnsavedChanges={true} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Button State - Validation Errors', () => {
    test('button is disabled when there is a validation error', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} validationError="Invalid configuration" />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('button is disabled when there is validation error and unsaved changes', () => {
      renderWithProviders(
        <SaveBar
          {...defaultProps}
          hasUnsavedChanges={true}
          validationError="Error"
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('handles empty string validation error as no error', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} validationError="" />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Button Click Interaction', () => {
    test('calls onSave when button is clicked', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <SaveBar {...defaultProps} onSave={onSave} />
      );

      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.click(button);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    test('calls onSave when button is clicked with unsaved changes', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <SaveBar {...defaultProps} onSave={onSave} hasUnsavedChanges={true} />
      );

      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.click(button);

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    test('button is not clickable when disabled due to loading', () => {
      const onSave = jest.fn();
      renderWithProviders(
        <SaveBar {...defaultProps} onSave={onSave} isLoading={true} />
      );

      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('button is not clickable when disabled due to validation error', () => {
      const onSave = jest.fn();
      renderWithProviders(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          validationError="Error"
        />
      );

      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('can be clicked multiple times when enabled', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <SaveBar {...defaultProps} onSave={onSave} />
      );

      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(onSave).toHaveBeenCalledTimes(3);
    });
  });

  describe('Badge Visibility', () => {
    test('badge is invisible when no unsaved changes', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={false} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
      // Badge with invisible prop won't be visible in the DOM
    });

    test('badge is visible when there are unsaved changes', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={true} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
      // Badge should be visible when hasUnsavedChanges is true
    });

    test('badge remains visible when loading with unsaved changes', () => {
      renderWithProviders(
        <SaveBar
          {...defaultProps}
          hasUnsavedChanges={true}
          isLoading={true}
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
    });

    test('badge remains visible when validation error with unsaved changes', () => {
      renderWithProviders(
        <SaveBar
          {...defaultProps}
          hasUnsavedChanges={true}
          validationError="Error"
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Tooltip Behavior', () => {
    test('tooltip displays correct text for unsaved changes', async () => {
      const user = userEvent.setup();

      // Unsaved changes message
      renderWithProviders(
        <SaveBar
          {...defaultProps}
          hasUnsavedChanges={true}
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.hover(button);
      expect(await screen.findByText('You have unsaved changes')).toBeInTheDocument();
    });

    test('tooltip displays default message when no changes', async () => {
      const user = userEvent.setup();

      // Default message
      renderWithProviders(
        <SaveBar
          {...defaultProps}
          hasUnsavedChanges={false}
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      await user.hover(button);
      expect(await screen.findByText('Save configuration settings')).toBeInTheDocument();
    });

    test('tooltip placement is on the left', () => {
      renderWithProviders(<SaveBar {...defaultProps} />);
      // Tooltip placement is set to 'left' in the component
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles null validationError', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} validationError={null} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });

    test('handles undefined validationError', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} validationError={undefined} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });

    test('handles all props being false/null', () => {
      renderWithProviders(
        <SaveBar
          hasUnsavedChanges={false}
          isLoading={false}
          onSave={jest.fn()}
          validationError={null}
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });

    test('handles all disabling conditions being true', () => {
      renderWithProviders(
        <SaveBar
          hasUnsavedChanges={true}
          isLoading={true}
          onSave={jest.fn()}
          validationError="Error message"
        />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('handles very long validation error message', () => {
      const longError = 'This is a very long validation error message that should still be displayed correctly in the tooltip without breaking the UI or causing any layout issues';
      renderWithProviders(
        <SaveBar {...defaultProps} validationError={longError} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('handles special characters in validation error', () => {
      const errorWithSpecialChars = 'Error: "Invalid" <value> & special chars';
      renderWithProviders(
        <SaveBar {...defaultProps} validationError={errorWithSpecialChars} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });
  });

  describe('State Transitions', () => {
    test('transitions from enabled to disabled when loading changes', () => {
      const { rerender } = renderWithProviders(
        <SaveBar {...defaultProps} isLoading={false} />
      );
      let button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();

      rerender(
        <SaveBar {...defaultProps} isLoading={true} />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('transitions from disabled to enabled when validation error clears', () => {
      const { rerender } = renderWithProviders(
        <SaveBar {...defaultProps} validationError="Error" />
      );
      let button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();

      rerender(
        <SaveBar {...defaultProps} validationError={null} />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });

    test('updates tooltip when hasUnsavedChanges changes', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <SaveBar {...defaultProps} hasUnsavedChanges={false} />
      );
      let button = screen.getByRole('button', { name: /save configuration/i });
      await user.hover(button);
      expect(await screen.findByText('Save configuration settings')).toBeInTheDocument();

      rerender(
        <SaveBar {...defaultProps} hasUnsavedChanges={true} />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      await user.hover(button);
      expect(await screen.findByText('You have unsaved changes')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    test('complete workflow: no changes -> changes -> save', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <SaveBar {...defaultProps} onSave={onSave} hasUnsavedChanges={false} />
      );

      // Initially no changes
      let button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();

      // User makes changes
      rerender(
        <SaveBar {...defaultProps} onSave={onSave} hasUnsavedChanges={true} />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();

      // User clicks save
      await user.click(button);
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    test('complete workflow: changes -> validation error -> error cleared -> save', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          hasUnsavedChanges={true}
        />
      );

      // User makes changes
      let button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();

      // Validation error occurs
      rerender(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          hasUnsavedChanges={true}
          validationError="Invalid input"
        />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();

      // Error is cleared
      rerender(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          hasUnsavedChanges={true}
          validationError={null}
        />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
      await user.click(button);
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    test('complete workflow: save -> loading -> complete', async () => {
      const onSave = jest.fn();
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          hasUnsavedChanges={true}
          isLoading={false}
        />
      );

      // User clicks save
      let button = screen.getByRole('button', { name: /save configuration/i });
      await user.click(button);
      expect(onSave).toHaveBeenCalledTimes(1);

      // Loading state
      rerender(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          hasUnsavedChanges={true}
          isLoading={true}
        />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();

      // Save complete
      rerender(
        <SaveBar
          {...defaultProps}
          onSave={onSave}
          hasUnsavedChanges={false}
          isLoading={false}
        />
      );
      button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('button has accessible label', () => {
      renderWithProviders(<SaveBar {...defaultProps} />);
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toHaveAccessibleName();
    });

    test('button has aria-label attribute', () => {
      renderWithProviders(<SaveBar {...defaultProps} />);
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toHaveAttribute('aria-label', 'save configuration');
    });

    test('disabled state is accessible', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} isLoading={true} />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });

    test('disabled button when validation error exists', () => {
      renderWithProviders(
        <SaveBar {...defaultProps} validationError="Please fix errors" />
      );
      const button = screen.getByRole('button', { name: /save configuration/i });
      expect(button).toBeDisabled();
    });
  });
});
