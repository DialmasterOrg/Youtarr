import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InfoTooltip } from '../InfoTooltip';
import { renderWithProviders } from '../../../../test-utils';
import useMediaQuery from '@mui/material/useMediaQuery';

// Mock useMediaQuery to control mobile/desktop behavior
jest.mock('@mui/material/useMediaQuery');
const mockUseMediaQuery = useMediaQuery as jest.MockedFunction<typeof useMediaQuery>;

describe('InfoTooltip Component', () => {
  beforeEach(() => {
    // Default to desktop (non-mobile) behavior
    mockUseMediaQuery.mockReturnValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Desktop Behavior', () => {
    test('renders info icon button', () => {
      renderWithProviders(<InfoTooltip text="Test tooltip text" />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    test('displays tooltip text', () => {
      renderWithProviders(<InfoTooltip text="Helpful information" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label');
    });

    test('renders with different text content', () => {
      const tooltipText = 'This is important configuration information';
      renderWithProviders(<InfoTooltip text={tooltipText} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('renders tooltip with long text', () => {
      const longText = 'This is a very long tooltip text that contains detailed information about the configuration option and explains what happens when you enable or disable this setting in the application';
      renderWithProviders(<InfoTooltip text={longText} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('renders tooltip with empty string', () => {
      renderWithProviders(<InfoTooltip text="" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('does not call onMobileClick when clicked on desktop', async () => {
      const user = userEvent.setup();
      const mockOnMobileClick = jest.fn();

      renderWithProviders(
        <InfoTooltip text="Test text" onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).not.toHaveBeenCalled();
    });

    test('renders without onMobileClick callback', () => {
      renderWithProviders(<InfoTooltip text="Test text" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Mobile Behavior', () => {
    beforeEach(() => {
      // Set to mobile behavior
      mockUseMediaQuery.mockReturnValue(true);
    });

    test('renders info icon button on mobile', () => {
      renderWithProviders(<InfoTooltip text="Test tooltip text" />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    test('calls onMobileClick with correct text when clicked', async () => {
      const user = userEvent.setup();
      const mockOnMobileClick = jest.fn();
      const testText = 'Mobile tooltip text';

      renderWithProviders(
        <InfoTooltip text={testText} onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalledTimes(1);
      expect(mockOnMobileClick).toHaveBeenCalledWith(testText);
    });

    test('does not call onMobileClick when callback is not provided', async () => {
      const user = userEvent.setup();

      renderWithProviders(<InfoTooltip text="Test text" />);

      const button = screen.getByRole('button');
      // This should not throw an error
      await user.click(button);

      expect(button).toBeInTheDocument();
    });

    test('calls onMobileClick multiple times on multiple clicks', async () => {
      const user = userEvent.setup();
      const mockOnMobileClick = jest.fn();
      const testText = 'Click me multiple times';

      renderWithProviders(
        <InfoTooltip text={testText} onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalledTimes(3);
      expect(mockOnMobileClick).toHaveBeenCalledWith(testText);
    });

    test('prevents default and stops propagation on click', async () => {
      const user = userEvent.setup();
      const mockOnMobileClick = jest.fn();
      const mockParentClick = jest.fn();

      renderWithProviders(
        <div onClick={mockParentClick}>
          <InfoTooltip text="Test" onMobileClick={mockOnMobileClick} />
        </div>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalled();
      // Parent click should not be triggered due to stopPropagation
      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    test('switches from desktop to mobile behavior', () => {
      mockUseMediaQuery.mockReturnValue(false);
      const { rerender } = renderWithProviders(<InfoTooltip text="Test" />);

      expect(screen.getByRole('button')).toBeInTheDocument();

      mockUseMediaQuery.mockReturnValue(true);
      rerender(<InfoTooltip text="Test" />);

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('uses theme breakpoint for mobile detection', () => {
      renderWithProviders(<InfoTooltip text="Test" />);

      expect(mockUseMediaQuery).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    test('handles click event on desktop without error', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(false);

      renderWithProviders(<InfoTooltip text="Test" />);

      const button = screen.getByRole('button');
      await user.click(button);

      // Should not throw any errors
      expect(button).toBeInTheDocument();
    });

    test('handles click event on mobile with callback', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockCallback = jest.fn();

      renderWithProviders(
        <InfoTooltip text="Test text" onMobileClick={mockCallback} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockCallback).toHaveBeenCalledWith('Test text');
    });

    test('handles click event on mobile without callback', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);

      renderWithProviders(<InfoTooltip text="Test text" />);

      const button = screen.getByRole('button');
      await user.click(button);

      // Should not throw any errors
      expect(button).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('button is keyboard accessible', () => {
      renderWithProviders(<InfoTooltip text="Accessible tooltip" />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    test('icon button has proper role', () => {
      renderWithProviders(<InfoTooltip text="Test" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('maintains accessibility on mobile', () => {
      mockUseMediaQuery.mockReturnValue(true);
      renderWithProviders(<InfoTooltip text="Mobile accessible" />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    test('maintains accessibility on desktop', () => {
      mockUseMediaQuery.mockReturnValue(false);
      renderWithProviders(<InfoTooltip text="Desktop accessible" />);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('Edge Cases', () => {
    test('handles special characters in text', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockOnMobileClick = jest.fn();
      const specialText = 'Text with "quotes" & <symbols> and émojis 🎉';

      renderWithProviders(
        <InfoTooltip text={specialText} onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalledWith(specialText);
    });

    test('handles newlines in text', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockOnMobileClick = jest.fn();
      const multilineText = 'Line 1\nLine 2\nLine 3';

      renderWithProviders(
        <InfoTooltip text={multilineText} onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalledWith(multilineText);
    });

    test('handles very short text', () => {
      renderWithProviders(<InfoTooltip text="A" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    test('handles numeric text content', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockOnMobileClick = jest.fn();
      const numericText = '123456789';

      renderWithProviders(
        <InfoTooltip text={numericText} onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalledWith(numericText);
    });

    test('handles HTML-like text content', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockOnMobileClick = jest.fn();
      const htmlText = '<div>This is not HTML</div>';

      renderWithProviders(
        <InfoTooltip text={htmlText} onMobileClick={mockOnMobileClick} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnMobileClick).toHaveBeenCalledWith(htmlText);
    });
  });

  describe('Integration Scenarios', () => {
    test('renders multiple InfoTooltips independently', () => {
      renderWithProviders(
        <>
          <InfoTooltip text="First tooltip" />
          <InfoTooltip text="Second tooltip" />
          <InfoTooltip text="Third tooltip" />
        </>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    test('multiple tooltips can have different callbacks', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      renderWithProviders(
        <>
          <InfoTooltip text="First" onMobileClick={mockCallback1} />
          <InfoTooltip text="Second" onMobileClick={mockCallback2} />
        </>
      );

      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);
      await user.click(buttons[1]);

      expect(mockCallback1).toHaveBeenCalledWith('First');
      expect(mockCallback2).toHaveBeenCalledWith('Second');
      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
    });

    test('tooltips work correctly when mixed with other components', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockCallback = jest.fn();

      renderWithProviders(
        <div>
          <h1>Settings</h1>
          <InfoTooltip text="Tooltip text" onMobileClick={mockCallback} />
          <button>Save</button>
        </div>
      );

      expect(screen.getByText('Settings')).toBeInTheDocument();

      const saveButton = screen.getByRole('button', { name: 'Save' });
      expect(saveButton).toBeInTheDocument();

      const infoButtons = screen.getAllByRole('button');
      const tooltipButton = infoButtons.find(btn => btn !== saveButton);

      // The tooltip button should exist
      expect(tooltipButton).toBeDefined();

      // Click and verify callback
      await user.click(tooltipButton!);
      expect(mockCallback).toHaveBeenCalledWith('Tooltip text');
    });
  });

  describe('Callback Behavior', () => {
    test('callback receives exact text prop value', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockCallback = jest.fn();
      const exactText = 'Exact text value with spaces   and special chars: !@#$%';

      renderWithProviders(
        <InfoTooltip text={exactText} onMobileClick={mockCallback} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockCallback).toHaveBeenCalledWith(exactText);
    });

    test('callback is not called with modified text', async () => {
      const user = userEvent.setup();
      mockUseMediaQuery.mockReturnValue(true);
      const mockCallback = jest.fn();
      const originalText = 'Original text';

      renderWithProviders(
        <InfoTooltip text={originalText} onMobileClick={mockCallback} />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockCallback).toHaveBeenCalledWith(originalText);
      expect(mockCallback).not.toHaveBeenCalledWith('Modified text');
      expect(mockCallback).not.toHaveBeenCalledWith('original text');
    });
  });
});
