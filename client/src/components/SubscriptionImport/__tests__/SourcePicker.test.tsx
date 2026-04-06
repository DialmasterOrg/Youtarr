import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SourcePicker from '../components/SourcePicker';

describe('SourcePicker', () => {
  const defaultProps = {
    loading: false,
    error: null,
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders two tabs with cookies as default', () => {
    render(<SourcePicker {...defaultProps} />);

    expect(screen.getByRole('tab', { name: /import using cookies/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /import using csv/i })).toBeInTheDocument();
    // Cookies tab is selected by default
    expect(screen.getByRole('tab', { name: /import using cookies/i })).toHaveAttribute('aria-selected', 'true');
  });

  test('submit button is disabled when no file selected', () => {
    render(<SourcePicker {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    expect(submitButton).toBeDisabled();
  });

  test('shows error alert when error prop is set', () => {
    render(<SourcePicker {...defaultProps} error="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  test('shows loading indicator when loading is true', () => {
    render(<SourcePicker {...defaultProps} loading />);

    expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('submit button becomes enabled after file selection', () => {
    render(<SourcePicker {...defaultProps} />);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['cookie content'], 'cookies.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    expect(submitButton).toBeEnabled();
  });

  test('displays selected filename', () => {
    render(<SourcePicker {...defaultProps} />);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['cookie content'], 'cookies.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('cookies.txt')).toBeInTheDocument();
  });

  test('calls onSubmit with cookies source by default', () => {
    render(<SourcePicker {...defaultProps} />);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['cookie content'], 'cookies.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('cookies', file);
  });

  test('switches to CSV tab and calls onSubmit with takeout source', () => {
    render(<SourcePicker {...defaultProps} />);

    // Switch to CSV tab
    const csvTab = screen.getByRole('tab', { name: /import using csv/i });
    fireEvent.click(csvTab);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'subscriptions.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('takeout', file);
  });

  test('shows cookies privacy note on default tab', () => {
    render(<SourcePicker {...defaultProps} />);

    expect(screen.getByText(/cookies will only be used once/i)).toBeInTheDocument();
  });

  test('shows takeout delay warning on CSV tab', () => {
    render(<SourcePicker {...defaultProps} />);

    const csvTab = screen.getByRole('tab', { name: /import using csv/i });
    fireEvent.click(csvTab);

    expect(screen.getByText(/Google Takeout exports can take 24-72 hours/i)).toBeInTheDocument();
  });

  test('does not show error alert when error is null', () => {
    render(<SourcePicker {...defaultProps} />);

    // Only the info alert about cookies should be present, not an error alert
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
