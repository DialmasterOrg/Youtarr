import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');

import { VideoFilenameTemplate } from '../VideoFilenameTemplate';

const defaultPrefix = '%(uploader,channel,uploader_id).80B - %(title).76B';

const SAMPLE_RESPONSE = {
  fileLine: 'TEDx Talks - How to Get Your Brain... [Hu4Yvq-g7_Y].mp4',
  folderLine: 'TEDx Talks - How to Get Your Brain... - Hu4Yvq-g7_Y',
  fileLineLength: 56,
  folderLineLength: 50,
};

describe('VideoFilenameTemplate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the input with the current value', () => {
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />);
    const input = screen.getByLabelText(/video filename template/i) as HTMLInputElement;
    expect(input.value).toBe(defaultPrefix);
  });

  it('calls onChange when the user types', () => {
    const handleChange = jest.fn();
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={handleChange} token="tok" />);
    const input = screen.getByLabelText(/video filename template/i);
    fireEvent.change(input, { target: { value: '%(title)s' } });
    expect(handleChange).toHaveBeenCalledWith('%(title)s');
  });

  it('renders all four presets and applies one when clicked', () => {
    const handleChange = jest.fn();
    render(<VideoFilenameTemplate value="x" onChange={handleChange} token="tok" />);
    expect(screen.getByRole('button', { name: /default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /date prefix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plex youtube-agent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /title only/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /title only/i }));
    expect(handleChange).toHaveBeenCalledWith('%(title).64B');
  });

  it('does not show preview lines until the user clicks Preview', () => {
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />);
    expect(screen.queryByTestId('filename-preview-file')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filename-preview-folder')).not.toBeInTheDocument();
  });

  it('renders both file and folder lines after Preview is clicked and resolves', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />);

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('filename-preview-file')).toHaveTextContent(SAMPLE_RESPONSE.fileLine);
    });
    expect(screen.getByTestId('filename-preview-folder')).toHaveTextContent(SAMPLE_RESPONSE.folderLine);
  });

  it('Preview button is disabled when prefix fails client-side validation', () => {
    render(<VideoFilenameTemplate value="" onChange={() => {}} token="tok" />);
    expect(screen.getByTestId('filename-preview-button')).toBeDisabled();
  });

  it('Preview button is disabled while the request is in flight', async () => {
    let resolveAxios: (value: unknown) => void = () => {};
    axios.post.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAxios = resolve; })
    );
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />);

    fireEvent.click(screen.getByTestId('filename-preview-button'));
    expect(screen.getByTestId('filename-preview-button')).toBeDisabled();

    resolveAxios({ data: SAMPLE_RESPONSE });
    await waitFor(() => {
      expect(screen.getByTestId('filename-preview-button')).not.toBeDisabled();
    });
  });

  it('shows the yt-dlp error message verbatim when the server returns 400', async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error:
            'Template rejected by yt-dlp: yt-dlp: error: invalid default output template "%(title)Z": unsupported format character \'Z\' (0x5a) at index 8',
        },
      },
    });
    render(<VideoFilenameTemplate value="%(title)Z" onChange={() => {}} token="tok" />);

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('filename-preview-error')).toHaveTextContent(/unsupported format character/);
    });
  });

  it('shows the structural warning when %(title)s lacks .NB truncation', () => {
    render(<VideoFilenameTemplate value="%(title)s" onChange={() => {}} token="tok" />);
    expect(screen.getByText(/untruncated/i)).toBeInTheDocument();
  });

  it('shows the oversized-title warning when title byte truncation exceeds the recommended limit', () => {
    render(<VideoFilenameTemplate value="%(title).150B" onChange={() => {}} token="tok" />);
    expect(screen.getByTestId('oversized-title-warning')).toHaveTextContent(/64B/);
  });

  it('does not show the oversized-title warning at the recommended .64B', () => {
    render(<VideoFilenameTemplate value="%(title).64B" onChange={() => {}} token="tok" />);
    expect(screen.queryByTestId('oversized-title-warning')).not.toBeInTheDocument();
  });

  it('shows a soft warning when the prefix includes locked suffix tokens', () => {
    render(<VideoFilenameTemplate value="%(title).76B %(id)s" onChange={() => {}} token="tok" />);
    expect(screen.getByTestId('locked-suffix-warning')).toHaveTextContent(/added automatically/i);
  });

  it('shows a validation error when prefix is empty', () => {
    render(<VideoFilenameTemplate value="" onChange={() => {}} token="tok" />);
    expect(screen.getByText(/may not be empty/i)).toBeInTheDocument();
  });

  it('shows a validation error when prefix contains a path separator', () => {
    render(<VideoFilenameTemplate value="bad/value" onChange={() => {}} token="tok" />);
    expect(screen.getByText(/path separator/i)).toBeInTheDocument();
  });

  it('renders the length warning at warn severity when the previewed line exceeds 110 chars', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        fileLine: 'a'.repeat(120),
        folderLine: 'a'.repeat(115),
        fileLineLength: 120,
        folderLineLength: 115,
      },
    });
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />);

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('length-warning')).toHaveAttribute('data-severity', 'warn');
    });
  });

  it('renders the length warning at danger severity when the previewed line exceeds 130 chars', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        fileLine: 'a'.repeat(140),
        folderLine: 'a'.repeat(135),
        fileLineLength: 140,
        folderLineLength: 135,
      },
    });
    render(<VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />);

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('length-warning')).toHaveAttribute('data-severity', 'danger');
    });
  });

  it('marks the preview block stale (opacity-60) after the prefix changes following a successful preview', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });
    const { rerender } = render(
      <VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" />
    );

    fireEvent.click(screen.getByTestId('filename-preview-button'));
    await waitFor(() => {
      expect(screen.getByTestId('filename-preview')).toBeInTheDocument();
    });

    rerender(<VideoFilenameTemplate value="%(title).50B" onChange={() => {}} token="tok" />);

    expect(screen.getByTestId('filename-preview')).toHaveClass('opacity-60');
  });
});
