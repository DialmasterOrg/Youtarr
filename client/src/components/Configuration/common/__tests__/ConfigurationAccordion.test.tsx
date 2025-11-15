import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
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

  describe('Expansion Behavior', () => {
    test('is collapsed by default when defaultExpanded is not provided', () => {
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('is collapsed by default when defaultExpanded is false', () => {
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={false} />);
      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('is expanded by default when defaultExpanded is true', () => {
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={true} />);
      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('can be expanded when clicking on collapsed accordion', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} />);

      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(expandButton);

      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });
    });

    test('can be collapsed when clicking on expanded accordion', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={true} />);

      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');

      await user.click(expandButton);

      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      });
    });

    test('content is visible when expanded', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} />);

      const expandButton = within(container).getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Test Content')).toBeVisible();
      });
    });

    test('toggles expansion state multiple times', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} />);

      const expandButton = within(container).getAllByRole('button')[0];

      // Expand
      await user.click(expandButton);
      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });

      // Collapse
      await user.click(expandButton);
      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      });

      // Expand again
      await user.click(expandButton);
      await waitFor(() => {
        expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('Props Combinations', () => {
    test('renders with all props provided', () => {
      const { container } = renderWithProviders(
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

      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
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

    test('renders with chip but collapsed by default', () => {
      const { container } = renderWithProviders(
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

      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('renders with expanded but no chip', () => {
      const { container } = renderWithProviders(
        <ConfigurationAccordion
          title="Expanded No Chip"
          defaultExpanded={true}
        >
          <div>Expanded content</div>
        </ConfigurationAccordion>
      );

      expect(screen.getByText('Expanded No Chip')).toBeInTheDocument();
      expect(screen.getByText('Expanded content')).toBeInTheDocument();

      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
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
    test('has proper ARIA attributes for collapsed state', () => {
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('has proper ARIA attributes for expanded state', () => {
      const { container } = renderWithProviders(<ConfigurationAccordion {...defaultProps} defaultExpanded={true} />);
      const expandButton = within(container).getAllByRole('button')[0];
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });

    test('title is accessible', () => {
      renderWithProviders(<ConfigurationAccordion {...defaultProps} />);
      expect(screen.getByText('Test Section')).toBeInTheDocument();
    });

    test('children content is accessible when expanded', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(
        <ConfigurationAccordion {...defaultProps}>
          <button>Accessible Button</button>
        </ConfigurationAccordion>
      );

      const expandButton = within(container).getAllByRole('button')[0];
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Accessible Button' })).toBeInTheDocument();
      });
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

    test('each accordion maintains independent state', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(
        <>
          <ConfigurationAccordion title="First">
            <div>First content</div>
          </ConfigurationAccordion>
          <ConfigurationAccordion title="Second">
            <div>Second content</div>
          </ConfigurationAccordion>
        </>
      );

      const allButtons = within(container).getAllByRole('button');
      const firstAccordion = allButtons[0];
      const secondAccordion = allButtons[1];

      expect(firstAccordion).toHaveAttribute('aria-expanded', 'false');
      expect(secondAccordion).toHaveAttribute('aria-expanded', 'false');

      await user.click(firstAccordion);

      await waitFor(() => {
        expect(firstAccordion).toHaveAttribute('aria-expanded', 'true');
      });

      expect(secondAccordion).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
