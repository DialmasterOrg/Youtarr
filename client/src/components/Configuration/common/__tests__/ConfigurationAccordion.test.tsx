import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ConfigurationAccordion } from '../ConfigurationAccordion';
import { renderWithProviders } from '../../../../test-utils';

describe('ConfigurationAccordion Component', () => {
  const defaultProps = {
    title: 'Test Section',
    children: <div>Test Content</div>,
  };

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    test('displays the title correctly', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    test('renders children content', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    test('renders complex children correctly', () => {
      const complexChildren = (
        <div>
          <h3>Complex Content</h3>
          <p>Paragraph text</p>
          <button>Action Button</button>
        </div>
      );

      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} defaultExpanded={true}>
          {complexChildren}
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Complex Content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph text')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
    });

    test('renders with accordion structure', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByText('Test Section')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('Chip Rendering', () => {
    test('does not render chip when chipLabel is not provided', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    test('renders chip with label when chipLabel is provided', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Optional" />
      );
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });

    test('renders chip with default color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Default" />
      );
      const chip = screen.getByText('Default');
      expect(chip).toBeInTheDocument();
    });

    test('renders chip with primary color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Primary" chipColor="primary" />
      );
      const chip = screen.getByText('Primary');
      expect(chip).toBeInTheDocument();
    });

    test('renders chip with secondary color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Secondary" chipColor="secondary" />
      );
      const chip = screen.getByText('Secondary');
      expect(chip).toBeInTheDocument();
    });

    test('renders chip with error color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Error" chipColor="error" />
      );
      const chip = screen.getByText('Error');
      expect(chip).toBeInTheDocument();
    });

    test('renders chip with info color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Info" chipColor="info" />
      );
      const chip = screen.getByText('Info');
      expect(chip).toBeInTheDocument();
    });

    test('renders chip with success color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Success" chipColor="success" />
      );
      const chip = screen.getByText('Success');
      expect(chip).toBeInTheDocument();
    });

    test('renders chip with warning color', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps} chipLabel="Warning" chipColor="warning" />
      );
      const chip = screen.getByText('Warning');
      expect(chip).toBeInTheDocument();
    });
  });

  describe('Status Banner', () => {
    test('renders status banner text when provided', () => {
      renderWithProviders(
        <ConfigurationAccordion
          {...defaultProps}
          statusBanner={{
            enabled: true,
            label: 'Feature Toggle',
            onToggle: jest.fn(),
            onText: 'On',
            offText: 'Off',
          }}
        />
      );

      expect(screen.getByText('On')).toBeInTheDocument();
    });

    test('calls status banner toggle callback', async () => {
      const user = userEvent.setup();
      const onToggle = jest.fn();

      renderWithProviders(
        <ConfigurationAccordion
          {...defaultProps}
          statusBanner={{
            enabled: false,
            label: 'Feature Toggle',
            onToggle,
          }}
        />
      );

      const toggle = screen.getByRole('checkbox', { name: /Feature Toggle/i });
      await user.click(toggle);

      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('Section Behavior', () => {
    test('renders content collapsed by default', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Test Section' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('defaultExpanded=false keeps content collapsed', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={false} />);
      expect(screen.getByRole('button', { name: 'Test Section' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('defaultExpanded=true shows content', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={true} />);
      expect(screen.getByText('Test Content')).toBeVisible();
    });

    test('title is rendered as interactive button', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Test Section' })).toBeInTheDocument();
    });
  });

  describe('Props Combinations', () => {
    test('renders with all props provided', () => {
      renderWithProviders(
        <ConfigurationAccordion
          title="Full Props Test"
          chipLabel="Beta"
          chipColor="warning"
          defaultExpanded={true}
        >
          <div>Full content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Full Props Test')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
      expect(screen.getByText('Full content')).toBeInTheDocument();
    });

    test('renders with minimal props', () => {
      renderWithProviders(
        <ConfigurationAccordion title="Minimal">
          <div>Minimal content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Minimal')).toBeInTheDocument();
      expect(screen.getByText('Minimal content')).toBeInTheDocument();
    });

    test('renders with chip and visible content', () => {
      renderWithProviders(
        <ConfigurationAccordion
          title="Chip Test"
          chipLabel="New"
          chipColor="success"
        >
          <div>Content with chip</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Chip Test')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chip Test New' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('renders with defaultExpanded and no chip', () => {
      renderWithProviders(
        <ConfigurationAccordion
          title="Expanded No Chip"
          defaultExpanded={true}
        >
          <div>Expanded content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Expanded No Chip')).toBeInTheDocument();
      expect(screen.getByText('Expanded content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string title', () => {
      renderWithProviders(
        <ConfigurationAccordion title="">
          <div>Content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('handles empty string chipLabel', () => {
      renderWithProviders(
        <ConfigurationAccordion title="Test" chipLabel="">
          <div>Content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('handles very long title', () => {
      const longTitle = 'This is a very long title that might wrap or overflow in the accordion header';
      renderWithProviders(
        <ConfigurationAccordion title={longTitle}>
          <div>Content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test('handles very long chip label', () => {
      const longLabel = 'Very Long Chip Label';
      renderWithProviders(
        <ConfigurationAccordion title="Test" chipLabel={longLabel}>
          <div>Content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    test('handles multiple nested children', () => {
      renderWithProviders(
        <ConfigurationAccordion title="Nested">
          <div>
            <div>
              <div>
                <span>Deeply nested content</span>
              </div>
            </div>
          </div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Deeply nested content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('exposes accordion expansion ARIA attributes', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Test Section' })).toHaveAttribute('aria-expanded', 'false');
    });

    test('keeps content accessible when expanded interaction is enabled', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={true} />);
      expect(screen.getByText('Test Content')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Test Section' })).toHaveAttribute('aria-expanded', 'true');
    });

    test('title is accessible', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    test('children content is accessible', () => {
      renderWithProviders(
        <ConfigurationAccordion {...defaultProps}>
          <button>Accessible Button</button>
        </ConfigurationAccordion>
      );
      expect(screen.getByRole('button', { name: 'Accessible Button' })).toBeInTheDocument();
    });
  });

  describe('Integration with Multiple Accordions', () => {
    test('renders multiple accordions independently', () => {
      renderWithProviders(
        <>
          <ConfigurationAccordion title="First Section">
            <div>First content</div>
          </ConfigurationAccordion>
          <ConfigurationAccordion title="Second Section" defaultExpanded={true}>
            <div>Second content</div>
          </ConfigurationAccordion>
          <ConfigurationAccordion title="Third Section" chipLabel="New">
            <div>Third content</div>
          </ConfigurationAccordion>
        </>
      );

      expect(screen.getByText('First Section')).toBeInTheDocument();
      expect(screen.getByText('Second Section')).toBeInTheDocument();
      expect(screen.getByText('Third Section')).toBeInTheDocument();
      expect(screen.getByText('New')).toBeInTheDocument();
    });

    test('each section renders independently', () => {
      renderWithProviders(
        <>
          <ConfigurationAccordion title="First">
            <div>First content</div>
          </ConfigurationAccordion>
          <ConfigurationAccordion title="Second">
            <div>Second content</div>
          </ConfigurationAccordion>
        </>
      );
      expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
