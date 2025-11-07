import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DatabaseErrorOverlay from '../DatabaseErrorOverlay';

describe('DatabaseErrorOverlay', () => {
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders overlay with connection error', () => {
    const errors = ['Cannot connect to database at localhost:3321. Error: Connection refused'];

    render(<DatabaseErrorOverlay errors={errors} onRetry={mockOnRetry} />);

    expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
    expect(screen.getByText('Database Issue Detected')).toBeInTheDocument();
    expect(screen.getByText('Cannot Connect to Database')).toBeInTheDocument();
    expect(
      screen.getByText(/The application cannot connect to the database server/i)
    ).toBeInTheDocument();
  });

  test('renders all provided errors', () => {
    const errors = [
      'Cannot connect to database at localhost:3321',
      'Table "channels" is missing column "new_field"',
      'Table "videos" is missing column "metadata"',
    ];

    render(<DatabaseErrorOverlay errors={errors} onRetry={mockOnRetry} />);

    errors.forEach((error) => {
      expect(screen.getByText(error)).toBeInTheDocument();
    });
  });

  test('renders troubleshooting steps', () => {
    render(<DatabaseErrorOverlay errors={['Cannot connect to database']} onRetry={mockOnRetry} />);

    // For connection errors, should show DB container troubleshooting
    expect(
      screen.getByText(/Check database container status/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/docker compose ps/i)).toBeInTheDocument();
  });

  test('calls onRetry when Try Again button is clicked', async () => {
    const user = userEvent.setup();
    render(<DatabaseErrorOverlay errors={['Test error']} onRetry={mockOnRetry} />);

    const retryButton = screen.getByTestId('retry-button');
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  test('renders retry button with correct text and icon', () => {
    render(<DatabaseErrorOverlay errors={['Test error']} onRetry={mockOnRetry} />);

    const retryButton = screen.getByRole('button', { name: /refresh & check again/i });
    expect(retryButton).toBeInTheDocument();
  });

  test('renders footer note about reloading', () => {
    render(<DatabaseErrorOverlay errors={['Test error']} onRetry={mockOnRetry} />);

    expect(
      screen.getByText(
        /After fixing the issue, click "Refresh & Check Again" to reload the application/i
      )
    ).toBeInTheDocument();
  });

  test('renders with empty errors array', () => {
    render(<DatabaseErrorOverlay errors={[]} onRetry={mockOnRetry} />);

    expect(screen.getByTestId('database-error-overlay')).toBeInTheDocument();
    expect(screen.getByText('Database Issue Detected')).toBeInTheDocument();
  });

  test('has correct styling for full-page blocking overlay', () => {
    render(<DatabaseErrorOverlay errors={['Test error']} onRetry={mockOnRetry} />);

    const overlay = screen.getByTestId('database-error-overlay');

    // Check that it has position fixed (indicates full-page overlay)
    expect(overlay).toHaveStyle({
      position: 'fixed',
      top: 0,
      left: 0,
    });
  });

  test('renders schema validation error correctly', () => {
    const errors = [
      'Table "channels" is missing column "new_field" (type: STRING, nullable: true)',
      'Table "videos" nullable mismatch on column "title"',
    ];

    render(<DatabaseErrorOverlay errors={errors} onRetry={mockOnRetry} />);

    expect(screen.getByText(/Table "channels" is missing column "new_field"/)).toBeInTheDocument();
    expect(screen.getByText(/Table "videos" nullable mismatch/)).toBeInTheDocument();
  });

  test('renders error header with error icon', () => {
    render(<DatabaseErrorOverlay errors={['Test error']} onRetry={mockOnRetry} />);

    // Check for the error heading
    const heading = screen.getByRole('heading', { name: /database issue detected/i });
    expect(heading).toBeInTheDocument();
  });

  test('renders error details section when errors exist', () => {
    const errors = ['Database connection failed', 'Port 3321 is not accessible'];

    render(<DatabaseErrorOverlay errors={errors} onRetry={mockOnRetry} />);

    expect(screen.getByText('Specific Errors:')).toBeInTheDocument();
    expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    expect(screen.getByText('Port 3321 is not accessible')).toBeInTheDocument();
  });
});
