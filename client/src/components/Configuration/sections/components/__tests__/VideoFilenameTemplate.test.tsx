import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');

import { VideoFilenameTemplate } from '../VideoFilenameTemplate';
import { FILENAME_PRESETS, PLEX_TV_SERIES_PRESET_PREFIX } from '../../../../../utils/filenameTemplate/presets';

const defaultPrefix = '%(uploader,channel,uploader_id).80B - %(title).76B';

type TemplateProps = React.ComponentProps<typeof VideoFilenameTemplate>;

function renderTemplate(props: Partial<TemplateProps> = {}) {
  const element = (next: Partial<TemplateProps>) => (
    <MemoryRouter>
      <VideoFilenameTemplate value={defaultPrefix} onChange={() => {}} token="tok" {...next} />
    </MemoryRouter>
  );
  const view = render(element(props));
  return { ...view, rerenderTemplate: (next: Partial<TemplateProps>) => view.rerender(element({ ...props, ...next })) };
}

const SAMPLE_RESPONSE = {
  fileLine: 'TEDx Talks - How to Get Your Brain... [Hu4Yvq-g7_Y].mp4',
  folderLine: 'TEDx Talks - How to Get Your Brain... - Hu4Yvq-g7_Y',
  fileLineLength: 56,
  folderLineLength: 50,
};

describe('VideoFilenameTemplate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the input with the current value', () => {
    renderTemplate();
    const input = screen.getByLabelText(/video filename template/i) as HTMLInputElement;
    expect(input.value).toBe(defaultPrefix);
  });

  it('calls onChange when the user types', () => {
    const handleChange = jest.fn();
    renderTemplate({ onChange: handleChange });
    const input = screen.getByLabelText(/video filename template/i);
    fireEvent.change(input, { target: { value: '%(title)s' } });
    expect(handleChange).toHaveBeenCalledWith('%(title)s');
  });

  it('renders all five presets and applies one when clicked', () => {
    const handleChange = jest.fn();
    renderTemplate({ value: 'x', onChange: handleChange });
    expect(screen.getByRole('button', { name: /default/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /date prefix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plex youtube-agent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plex tv series/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /title only/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /title only/i }));
    expect(handleChange).toHaveBeenCalledWith('%(title).64B');
  });

  describe('TV show hint next to the Plex TV Series preset', () => {
    it('points TV-style channels at TV shows folders on hover', async () => {
      const user = userEvent.setup();
      renderTemplate();

      await user.hover(screen.getByRole('button', { name: 'About saving channels as TV shows' }));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'For TV-style channels, use a TV shows folder instead. Episodes then get Season folders, SxxEyy names and .nfo files.'
      );
    });

    it('still applies the Plex TV Series preset when clicked', () => {
      const handleChange = jest.fn();
      const tvSeriesPrefix = FILENAME_PRESETS.find((preset) => preset.label === 'Plex TV Series')!.prefix;
      renderTemplate({ value: 'x', onChange: handleChange });

      fireEvent.click(screen.getByRole('button', { name: /plex tv series/i }));

      expect(handleChange).toHaveBeenCalledWith(tvSeriesPrefix);
    });
  });

  test('presets are toggle buttons pressed for the current value', () => {
    renderTemplate({ value: PLEX_TV_SERIES_PRESET_PREFIX });
    expect(screen.getByRole('button', { name: 'Plex TV Series' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the Plex TV Series preset points at TV shows folders', () => {
    renderTemplate({ value: PLEX_TV_SERIES_PRESET_PREFIX });
    expect(screen.getByText(/Want channels as real TV shows\?/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Library folders' })).toHaveAttribute('href', '/settings/library');
  });

  it('does not show preview lines until the user clicks Preview', () => {
    renderTemplate();
    expect(screen.queryByTestId('filename-preview-file')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filename-preview-folder')).not.toBeInTheDocument();
  });

  it('renders both file and folder lines after Preview is clicked and resolves', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });
    renderTemplate();

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('filename-preview-file')).toHaveTextContent(SAMPLE_RESPONSE.fileLine);
    });
    expect(screen.getByTestId('filename-preview-folder')).toHaveTextContent(SAMPLE_RESPONSE.folderLine);
  });

  it('Preview button is disabled when prefix fails client-side validation', () => {
    renderTemplate({ value: '' });
    expect(screen.getByTestId('filename-preview-button')).toBeDisabled();
  });

  it('Preview button is disabled while the request is in flight', async () => {
    let resolveAxios: (value: unknown) => void = () => {};
    axios.post.mockImplementationOnce(
      () => new Promise((resolve) => { resolveAxios = resolve; })
    );
    renderTemplate();

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
    renderTemplate({ value: '%(title)Z' });

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('filename-preview-error')).toHaveTextContent(/unsupported format character/);
    });
  });

  it('shows the structural warning when %(title)s lacks .NB truncation', () => {
    renderTemplate({ value: '%(title)s' });
    expect(screen.getByText(/untruncated/i)).toBeInTheDocument();
  });

  it('shows the oversized-title warning when title byte truncation exceeds the recommended limit', () => {
    renderTemplate({ value: '%(title).150B' });
    expect(screen.getByTestId('oversized-title-warning')).toHaveTextContent(/64B/);
  });

  it('does not show the oversized-title warning at the recommended .64B', () => {
    renderTemplate({ value: '%(title).64B' });
    expect(screen.queryByTestId('oversized-title-warning')).not.toBeInTheDocument();
  });

  it('shows a soft warning when the prefix includes locked suffix tokens', () => {
    renderTemplate({ value: '%(title).76B %(id)s' });
    expect(screen.getByTestId('locked-suffix-warning')).toHaveTextContent(/added automatically/i);
  });

  it('shows a validation error when prefix is empty', () => {
    renderTemplate({ value: '' });
    expect(screen.getByText(/may not be empty/i)).toBeInTheDocument();
  });

  it('shows a validation error when prefix contains a path separator', () => {
    renderTemplate({ value: 'bad/value' });
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
    renderTemplate();

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
    renderTemplate();

    fireEvent.click(screen.getByTestId('filename-preview-button'));

    await waitFor(() => {
      expect(screen.getByTestId('length-warning')).toHaveAttribute('data-severity', 'danger');
    });
  });

  it('marks the preview block stale (opacity-60) after the prefix changes following a successful preview', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });
    const { rerenderTemplate } = renderTemplate();

    fireEvent.click(screen.getByTestId('filename-preview-button'));
    await waitFor(() => {
      expect(screen.getByTestId('filename-preview')).toBeInTheDocument();
    });

    rerenderTemplate({ value: '%(title).50B' });

    expect(screen.getByTestId('filename-preview')).toHaveClass('opacity-60');
  });
});
