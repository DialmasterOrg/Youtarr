import React from 'react';
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigurationCard } from '../ConfigurationCard';
import { renderWithProviders } from '../../../../test-utils';

describe('ConfigurationCard Component', () => {
  const defaultProps = {
    title: 'Test Card Title',
    children: <div>Test Content</div>,
  };

  describe('Component Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} />);
      expect(screen.getByText('Test Card Title')).toBeInTheDocument();
    });

    test('displays the title correctly', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    test('renders title as h2 heading', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test Card Title');
    });

    test('renders children content', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} />);
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
        <ConfigurationCard {...defaultProps}>
          {complexChildren}
        </ConfigurationCard>
      );

      expect(screen.getByText('Complex Content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph text')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
    });
  });

  describe('Subtitle Rendering', () => {
    test('does not render subtitle when not provided', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} />);

      // Verify only the title is present, no subtitle
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test Card Title');

      // There should only be the main heading
      const allHeadings = screen.getAllByRole('heading');
      expect(allHeadings).toHaveLength(1);
    });

    test('renders subtitle when provided', () => {
      renderWithProviders(
        <ConfigurationCard {...defaultProps} subtitle="This is a subtitle" />
      );
      expect(screen.getByText('This is a subtitle')).toBeInTheDocument();
    });

    test('renders subtitle with correct text', () => {
      const subtitle = 'Configure your application settings below';
      renderWithProviders(
        <ConfigurationCard {...defaultProps} subtitle={subtitle} />
      );
      expect(screen.getByText(subtitle)).toBeInTheDocument();
    });

    test('renders both title and subtitle together', () => {
      renderWithProviders(
        <ConfigurationCard
          title="Settings"
          subtitle="Manage your preferences"
        >
          <div>Content</div>
        </ConfigurationCard>
      );
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Manage your preferences')).toBeInTheDocument();
    });

    test('handles empty string subtitle', () => {
      renderWithProviders(
        <ConfigurationCard {...defaultProps} subtitle="" />
      );
      expect(screen.getByText('Test Card Title')).toBeInTheDocument();
    });

    test('handles very long subtitle', () => {
      const longSubtitle = 'This is a very long subtitle that contains a lot of explanatory text about the configuration section and what options are available';
      renderWithProviders(
        <ConfigurationCard {...defaultProps} subtitle={longSubtitle} />
      );
      expect(screen.getByText(longSubtitle)).toBeInTheDocument();
    });
  });

  describe('Props Combinations', () => {
    test('renders with all props provided', () => {
      renderWithProviders(
        <ConfigurationCard
          title="Full Props Test"
          subtitle="Complete configuration card"
        >
          <div>Full content</div>
        </ConfigurationCard>
      );

      expect(screen.getByText('Full Props Test')).toBeInTheDocument();
      expect(screen.getByText('Complete configuration card')).toBeInTheDocument();
      expect(screen.getByText('Full content')).toBeInTheDocument();
    });

    test('renders with minimal props (title and children only)', () => {
      renderWithProviders(
        <ConfigurationCard title="Minimal">
          <div>Minimal content</div>
        </ConfigurationCard>
      );

      expect(screen.getByText('Minimal')).toBeInTheDocument();
      expect(screen.getByText('Minimal content')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty string title', () => {
      renderWithProviders(
        <ConfigurationCard title="">
          <div>Content</div>
        </ConfigurationCard>
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    test('handles very long title', () => {
      const longTitle = 'This is a very long title for a configuration card that might wrap to multiple lines in the user interface';
      renderWithProviders(
        <ConfigurationCard title={longTitle}>
          <div>Content</div>
        </ConfigurationCard>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    test('handles multiple nested children', () => {
      renderWithProviders(
        <ConfigurationCard title="Nested">
          <div>
            <div>
              <div>
                <span>Deeply nested content</span>
              </div>
            </div>
          </div>
        </ConfigurationCard>
      );

      expect(screen.getByText('Deeply nested content')).toBeInTheDocument();
    });

    test('handles children with form elements', () => {
      renderWithProviders(
        <ConfigurationCard title="Form Card">
          <form>
            <input type="text" placeholder="Enter value" />
            <button type="submit">Submit</button>
          </form>
        </ConfigurationCard>
      );

      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    test('handles children with multiple elements', () => {
      renderWithProviders(
        <ConfigurationCard title="Multiple Elements">
          <div>First element</div>
          <div>Second element</div>
          <div>Third element</div>
        </ConfigurationCard>
      );

      expect(screen.getByText('First element')).toBeInTheDocument();
      expect(screen.getByText('Second element')).toBeInTheDocument();
      expect(screen.getByText('Third element')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper heading structure', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Test Card Title');
    });

    test('title is accessible', () => {
      renderWithProviders(<ConfigurationCard {...defaultProps} />);
      expect(screen.getByText('Test Card Title')).toBeInTheDocument();
    });

    test('subtitle is accessible when provided', () => {
      renderWithProviders(
        <ConfigurationCard {...defaultProps} subtitle="Accessible subtitle" />
      );
      expect(screen.getByText('Accessible subtitle')).toBeInTheDocument();
    });

    test('children content is accessible', () => {
      renderWithProviders(
        <ConfigurationCard {...defaultProps}>
          <button aria-label="Accessible action">Click me</button>
        </ConfigurationCard>
      );

      expect(screen.getByRole('button', { name: 'Accessible action' })).toBeInTheDocument();
    });

    test('form controls within children are accessible', () => {
      renderWithProviders(
        <ConfigurationCard title="Form Settings">
          <label htmlFor="username">Username</label>
          <input id="username" type="text" />
        </ConfigurationCard>
      );

      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });
  });

  describe('Integration with Multiple Cards', () => {
    test('renders multiple cards independently', () => {
      renderWithProviders(
        <>
          <ConfigurationCard title="First Card">
            <div>First content</div>
          </ConfigurationCard>
          <ConfigurationCard title="Second Card" subtitle="Second subtitle">
            <div>Second content</div>
          </ConfigurationCard>
          <ConfigurationCard title="Third Card">
            <div>Third content</div>
          </ConfigurationCard>
        </>
      );

      expect(screen.getByText('First Card')).toBeInTheDocument();
      expect(screen.getByText('Second Card')).toBeInTheDocument();
      expect(screen.getByText('Third Card')).toBeInTheDocument();
      expect(screen.getByText('Second subtitle')).toBeInTheDocument();
    });

    test('each card displays its own content independently', () => {
      renderWithProviders(
        <>
          <ConfigurationCard title="Card 1">
            <button>Button 1</button>
          </ConfigurationCard>
          <ConfigurationCard title="Card 2">
            <button>Button 2</button>
          </ConfigurationCard>
        </>
      );

      expect(screen.getByRole('button', { name: 'Button 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Button 2' })).toBeInTheDocument();
    });

    test('renders cards with different subtitles', () => {
      renderWithProviders(
        <>
          <ConfigurationCard title="Card 1" subtitle="Subtitle 1">
            <div>Content 1</div>
          </ConfigurationCard>
          <ConfigurationCard title="Card 2" subtitle="Subtitle 2">
            <div>Content 2</div>
          </ConfigurationCard>
          <ConfigurationCard title="Card 3">
            <div>Content 3</div>
          </ConfigurationCard>
        </>
      );

      expect(screen.getByText('Subtitle 1')).toBeInTheDocument();
      expect(screen.getByText('Subtitle 2')).toBeInTheDocument();
      expect(screen.queryByText('Subtitle 3')).not.toBeInTheDocument();
    });
  });

  describe('Content Variations', () => {
    test('renders with text content', () => {
      renderWithProviders(
        <ConfigurationCard title="Text Card">
          Plain text content
        </ConfigurationCard>
      );

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });

    test('renders with React fragment children', () => {
      renderWithProviders(
        <ConfigurationCard title="Fragment Card">
          <>
            <div>Fragment item 1</div>
            <div>Fragment item 2</div>
          </>
        </ConfigurationCard>
      );

      expect(screen.getByText('Fragment item 1')).toBeInTheDocument();
      expect(screen.getByText('Fragment item 2')).toBeInTheDocument();
    });

    test('renders with conditional content', () => {
      const showExtra = true;
      renderWithProviders(
        <ConfigurationCard title="Conditional Card">
          <div>Base content</div>
          {showExtra && <div>Extra content</div>}
        </ConfigurationCard>
      );

      expect(screen.getByText('Base content')).toBeInTheDocument();
      expect(screen.getByText('Extra content')).toBeInTheDocument();
    });

    test('renders with list content', () => {
      renderWithProviders(
        <ConfigurationCard title="List Card">
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
        </ConfigurationCard>
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });
  });
});
