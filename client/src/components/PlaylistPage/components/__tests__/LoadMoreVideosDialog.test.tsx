import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoadMoreVideosDialog from '../LoadMoreVideosDialog';

describe('LoadMoreVideosDialog', () => {
  const mockOnCancel = jest.fn();
  const mockOnConfirm = jest.fn();

  const defaultProps = {
    open: true,
    onCancel: mockOnCancel,
    onConfirm: mockOnConfirm,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the title and slow-fetch warning when open', () => {
    render(<LoadMoreVideosDialog {...defaultProps} />);

    expect(screen.getByText('Load More Videos')).toBeInTheDocument();
    expect(
      screen.getByText(/load up to 5000 videos from this playlist/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/can take quite some time to complete/i)
    ).toBeInTheDocument();
  });

  test('warns that unavailable videos will not be loaded', () => {
    render(<LoadMoreVideosDialog {...defaultProps} />);

    expect(
      screen.getByText(/private, members-only, and deleted videos/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/fewer videos than YouTube reports/i)
    ).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<LoadMoreVideosDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Load More Videos')).not.toBeInTheDocument();
  });

  test('calls onCancel when Cancel is clicked', () => {
    render(<LoadMoreVideosDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  test('calls onConfirm when Continue is clicked', () => {
    render(<LoadMoreVideosDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });
});
