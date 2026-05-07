import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VideoFilenameTemplate } from '../VideoFilenameTemplate';

const defaultPrefix = '%(uploader,channel,uploader_id).80B - %(title).76B';

describe('VideoFilenameTemplate', () => {
  it('renders the input with the current value', () => {
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} />);
    const input = screen.getByLabelText(/video filename template/i) as HTMLInputElement;
    expect(input.value).toBe(defaultPrefix);
  });

  it('calls onChange when the user types', () => {
    const handleChange = jest.fn();
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={handleChange} />);
    const input = screen.getByLabelText(/video filename template/i);
    fireEvent.change(input, { target: { value: '%(title)s' } });
    expect(handleChange).toHaveBeenCalledWith('%(title)s');
  });

  it('renders all four presets and applies one when clicked', () => {
    const handleChange = jest.fn();
    render(<VideoFilenameTemplate value="" onChange={handleChange} />);
    expect(screen.getByRole('button', { name: /default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /date prefix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plex youtube-agent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /title only/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /title only/i }));
    expect(handleChange).toHaveBeenCalledWith('%(title).76B');
  });

  it('shows both folder and file preview lines', () => {
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} />);
    expect(screen.getByTestId('filename-preview-file')).toHaveTextContent(/\[.+\]\.\w+$/);
    expect(screen.getByTestId('filename-preview-folder')).toHaveTextContent(/ - [A-Za-z0-9_-]{10,12}$/);
  });

  it('shows the simulated disclaimer and "only applies to new downloads" notice', () => {
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} />);
    expect(screen.getByText(/simulated/i)).toBeInTheDocument();
    expect(screen.getByText(/only applies to new downloads/i)).toBeInTheDocument();
  });

  it('shows a yellow warning when rendered length is between 111 and 130 chars', () => {
    // Add enough literal chars after a short token to push the longer line into the warn band.
    const longPrefix = '%(uploader)s - ' + 'A'.repeat(90);
    render(<VideoFilenameTemplate value={longPrefix} onChange={() => {}} />);
    expect(screen.getByTestId('length-warning')).toHaveAttribute('data-severity', 'warn');
  });

  it('shows a red warning when rendered length exceeds 130 chars', () => {
    const veryLongPrefix = '%(uploader)s - ' + 'A'.repeat(150);
    render(<VideoFilenameTemplate value={veryLongPrefix} onChange={() => {}} />);
    expect(screen.getByTestId('length-warning')).toHaveAttribute('data-severity', 'danger');
  });

  it('shows the structural warning when %(title)s lacks .NB truncation', () => {
    render(<VideoFilenameTemplate value="%(title)s" onChange={() => {}} />);
    expect(screen.getByText(/untruncated/i)).toBeInTheDocument();
  });

  it('shows the oversized-title warning when title byte truncation exceeds 76B', () => {
    render(<VideoFilenameTemplate value="%(title).150B" onChange={() => {}} />);
    expect(screen.getByTestId('oversized-title-warning')).toHaveTextContent(/76B/);
  });

  it('does not show the oversized-title warning at the recommended .76B', () => {
    render(<VideoFilenameTemplate value="%(title).76B" onChange={() => {}} />);
    expect(screen.queryByTestId('oversized-title-warning')).not.toBeInTheDocument();
  });

  it('shows a soft warning when the prefix includes locked suffix tokens', () => {
    render(<VideoFilenameTemplate value="%(title).76B %(id)s" onChange={() => {}} />);
    expect(screen.getByTestId('locked-suffix-warning')).toHaveTextContent(/added automatically/i);
  });

  it('shows a validation error when prefix is empty', () => {
    render(<VideoFilenameTemplate value="" onChange={() => {}} />);
    expect(screen.getByText(/may not be empty/i)).toBeInTheDocument();
  });

  it('shows a validation error when prefix contains a path separator', () => {
    render(<VideoFilenameTemplate value="bad/value" onChange={() => {}} />);
    expect(screen.getByText(/path separator/i)).toBeInTheDocument();
  });

  it('shows the first renderer warning when the preview cannot resolve a token', () => {
    render(<VideoFilenameTemplate value="%(uploder)s" onChange={() => {}} />);
    expect(screen.getByTestId('filename-preview-warning')).toHaveTextContent(/uploder/);
  });

  it('shows a validation error for invalid yt-dlp truncation syntax', () => {
    render(<VideoFilenameTemplate value="%(title).40" onChange={() => {}} />);
    expect(screen.getByText(/truncation/i)).toBeInTheDocument();
  });
});
