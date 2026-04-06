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

  test('renders two tabs', () => {
    render(<SourcePicker {...defaultProps} />);

    expect(screen.getByRole('tab', { name: /google takeout/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /cookies/i })).toBeInTheDocument();
  });

  test('submit button is disabled when no file selected', () => {
    render(<SourcePicker {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    expect(submitButton).toBeDisabled();
  });

  test('shows error alert when error prop is set', () => {
    render(<SourcePicker {...defaultProps} error="Something went wrong" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  });

  test('shows loading indicator when loading is true', () => {
    render(<SourcePicker {...defaultProps} loading />);

    expect(screen.getByRole('button', { name: /uploading/i })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('submit button becomes enabled after file selection', () => {
    render(<SourcePicker {...defaultProps} />);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'subscriptions.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    expect(submitButton).toBeEnabled();
  });

  test('displays selected filename', () => {
    render(<SourcePicker {...defaultProps} />);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'subscriptions.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText('subscriptions.csv')).toBeInTheDocument();
  });

  test('calls onSubmit with source and file when submitted', () => {
    render(<SourcePicker {...defaultProps} />);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'subscriptions.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('takeout', file);
  });

  test('switches to cookies tab and calls onSubmit with cookies source', () => {
    render(<SourcePicker {...defaultProps} />);

    // Switch to cookies tab
    const cookiesTab = screen.getByRole('tab', { name: /cookies/i });
    fireEvent.click(cookiesTab);

    const fileInput = screen.getByTestId('file-input');
    const file = new File(['cookie content'], 'cookies.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitButton = screen.getByRole('button', { name: /upload & preview/i });
    fireEvent.click(submitButton);

    expect(defaultProps.onSubmit).toHaveBeenCalledWith('cookies', file);
  });

  test('does not show error alert when error is null', () => {
    render(<SourcePicker {...defaultProps} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
