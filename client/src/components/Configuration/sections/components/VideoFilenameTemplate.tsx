import React, { ChangeEvent, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  Link,
  CircularProgress,
} from '../../../ui';
import { FILENAME_PRESETS } from '../../../../utils/filenameTemplate/presets';
import {
  validatePrefix,
  lengthSeverity,
  hasUntruncatedTitle,
  hasLockedSuffixToken,
  hasOversizedTitleTruncation,
} from '../../../../utils/filenameTemplate/validate';
import { useFilenamePreview } from '../../hooks/useFilenamePreview';

interface VideoFilenameTemplateProps {
  value: string;
  onChange: (newValue: string) => void;
  token: string | null;
  saveRequirement?: string | null;
  onPreviewSuccess?: (prefix: string) => void;
}

const SEVERITY_TEXT: Record<'warn' | 'danger', string> = {
  warn:
    "Long filename. With deep subfolders or non-ASCII channel names, the full path may approach Windows' 260-character limit, which would cause downloads to fail.",
  danger:
    "Filename is very long. Downloads are likely to fail on Windows and SMB-mounted NAS shares (260-char path limit). Pure CJK or emoji content can also exceed Linux/macOS' 255-byte per-filename limit.",
};

export const VideoFilenameTemplate: React.FC<VideoFilenameTemplateProps> = ({
  value,
  onChange,
  token,
  saveRequirement,
  onPreviewSuccess,
}) => {
  const validation = useMemo(() => validatePrefix(value), [value]);
  const preview = useFilenamePreview(token);
  const isStale = preview.isStale(value);

  // Length severity reflects the rendered preview when available; without a
  // preview yet (or on error) we have no rendered length to compare against,
  // so we hide the warning rather than guess.
  const longerLength = preview.data
    ? Math.max(preview.data.fileLineLength, preview.data.folderLineLength)
    : 0;
  const severity = preview.data ? lengthSeverity(longerLength) : 'ok';

  const showStructural = hasUntruncatedTitle(value);
  const showOversizedTitle = hasOversizedTitleTruncation(value);
  const showLockedSuffixWarning = hasLockedSuffixToken(value);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handlePreviewClick = async () => {
    const result = await preview.run(value);
    if (result) {
      onPreviewSuccess?.(value);
    }
  };

  const previewDisabled = !validation.ok || preview.loading;

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="subtitle2" className="font-bold">
        Video Filename Template
      </Typography>
      <Typography variant="caption" color="text.secondary">
        How yt-dlp names downloaded video files and per-video folders. Youtarr always appends{' '}
        <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
          [VIDEO_ID].EXT
        </span>{' '}
        to filenames and{' '}
        <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
          - VIDEO_ID
        </span>{' '}
        to folder names so it can re-find your videos on disk. Only applies to new downloads.{' '}
        <Link
          href="https://github.com/yt-dlp/yt-dlp#output-template"
          target="_blank"
          rel="noopener noreferrer"
        >
          See yt-dlp output template docs
        </Link>
        .
      </Typography>

      <TextField
        fullWidth
        label="Video Filename Template"
        value={value}
        onChange={handleChange as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>}
        error={!validation.ok}
        helperText={validation.error}
        inputProps={{ style: { fontFamily: 'monospace' } }}
      />

      <Box className="flex flex-wrap gap-2">
        {FILENAME_PRESETS.map((preset) => (
          <Button
            key={preset.label}
            variant="outlined"
            size="small"
            onClick={() => onChange(preset.prefix)}
            title={preset.description}
          >
            {preset.label}
          </Button>
        ))}
      </Box>

      <Box className="flex items-center gap-3">
        <Button
          data-testid="filename-preview-button"
          variant="contained"
          size="small"
          onClick={handlePreviewClick}
          disabled={previewDisabled}
          startIcon={preview.loading ? <CircularProgress size={14} /> : undefined}
        >
          {preview.loading ? 'Rendering...' : 'Preview'}
        </Button>
        <Typography variant="caption" color="text.secondary">
          Renders this template against a sample video using yt-dlp.
        </Typography>
      </Box>

      {saveRequirement && (
        <Box
          data-testid="filename-preview-save-requirement"
          className="rounded p-2 bg-warning/10 text-warning"
        >
          <Typography variant="caption">{saveRequirement}</Typography>
        </Box>
      )}

      {preview.error && (
        <Box
          data-testid="filename-preview-error"
          className="rounded p-2 bg-destructive/10 text-destructive"
        >
          <Typography variant="caption" className="font-mono whitespace-pre-wrap break-words">
            {preview.error}
          </Typography>
        </Box>
      )}

      {preview.data && (
        <Box
          data-testid="filename-preview"
          className={isStale ? 'rounded p-3 bg-muted opacity-60' : 'rounded p-3 bg-muted'}
        >
          <Typography variant="caption" color="text.secondary">
            Preview (sample video)
            {isStale && ' • click Preview to refresh'}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            className="mt-2 block font-semibold"
          >
            Folder
          </Typography>
          <pre
            data-testid="filename-preview-folder"
            className="m-0 mt-1 px-2 py-1.5 rounded border border-border bg-background text-sm font-mono whitespace-pre-wrap break-all"
          >
            {preview.data.folderLine}
          </pre>
          <Typography variant="caption" color="text.secondary" className="block mt-1">
            {preview.data.folderLineLength} characters
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            className="mt-2 block font-semibold"
          >
            File
          </Typography>
          <pre
            data-testid="filename-preview-file"
            className="m-0 mt-1 px-2 py-1.5 rounded border border-border bg-background text-sm font-mono whitespace-pre-wrap break-all"
          >
            {preview.data.fileLine}
          </pre>
          <Typography variant="caption" color="text.secondary" className="block mt-1">
            {preview.data.fileLineLength} characters
          </Typography>
        </Box>
      )}

      {severity !== 'ok' && (
        <Box
          data-testid="length-warning"
          data-severity={severity}
          className={
            severity === 'danger'
              ? 'rounded p-2 bg-destructive/10 text-destructive'
              : 'rounded p-2 bg-warning/10 text-warning'
          }
        >
          <Typography variant="caption">{SEVERITY_TEXT[severity]}</Typography>
        </Box>
      )}

      {showStructural && (
        <Typography variant="caption" color="text.secondary">
          Untruncated{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            %(title)s
          </span>{' '}
          can produce arbitrarily long filenames depending on the video. Consider{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            %(title).76B
          </span>
          .
        </Typography>
      )}

      {showOversizedTitle && (
        <Typography
          data-testid="oversized-title-warning"
          variant="caption"
          color="text.secondary"
        >
          Title byte truncation above{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            .76B
          </span>{' '}
          is not recommended. Larger values can push full paths past Windows{'’'} 260-character limit, especially with deep subfolders or non-ASCII channel names. Stick with{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            %(title).76B
          </span>{' '}
          or smaller.
        </Typography>
      )}

      {showLockedSuffixWarning && (
        <Typography
          data-testid="locked-suffix-warning"
          variant="caption"
          color="text.secondary"
        >
          Video ID and extension are added automatically. Including{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            %(id)s
          </span>{' '}
          or{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            %(ext)s
          </span>{' '}
          in the prefix will duplicate them.
        </Typography>
      )}
    </Box>
  );
};
