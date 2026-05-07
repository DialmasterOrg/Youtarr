import React, { ChangeEvent, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  Button,
  Link,
} from '../../../ui';
import { renderForPreview } from '../../../../utils/filenameTemplate/renderer';
import { SAMPLE_VIDEO_METADATA } from '../../../../utils/filenameTemplate/sampleInfoJson';
import { FILENAME_PRESETS } from '../../../../utils/filenameTemplate/presets';
import {
  validatePrefix,
  lengthSeverity,
  hasUntruncatedTitle,
  hasLockedSuffixToken,
  hasOversizedTitleTruncation,
} from '../../../../utils/filenameTemplate/validate';

interface VideoFilenameTemplateProps {
  value: string;
  onChange: (newValue: string) => void;
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
}) => {
  const validation = useMemo(() => validatePrefix(value), [value]);
  const preview = useMemo(
    () => renderForPreview(value, SAMPLE_VIDEO_METADATA),
    [value]
  );
  // The full path includes both the per-video folder AND the file name; warn on the longer one.
  const longerLength = Math.max(preview.fileLineLength, preview.folderLineLength);
  const severity = lengthSeverity(longerLength);
  const showStructural = hasUntruncatedTitle(value);
  const showOversizedTitle = hasOversizedTitleTruncation(value);
  const showLockedSuffixWarning = hasLockedSuffixToken(value);
  const previewWarning = preview.warnings[0];

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

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

      <Box className="rounded p-3 bg-muted">
        <Typography variant="caption" color="text.secondary">
          Preview (sample video)
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          className="mt-2 block font-semibold"
        >
          Folder
        </Typography>
        <Typography
          data-testid="filename-preview-folder"
          variant="body2"
          className="font-mono break-all"
        >
          {preview.folderLine}
        </Typography>
        <Typography variant="caption" color="text.secondary" className="block">
          {preview.folderLineLength} characters
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          className="mt-2 block font-semibold"
        >
          File
        </Typography>
        <Typography
          data-testid="filename-preview-file"
          variant="body2"
          className="font-mono break-all"
        >
          {preview.fileLine}
        </Typography>
        <Typography variant="caption" color="text.secondary" className="block">
          {preview.fileLineLength} characters
        </Typography>

        <Typography
          variant="caption"
          color="text.secondary"
          className="mt-2 block italic"
        >
          Simulated against a sample video; actual filenames may vary slightly.
        </Typography>
        {previewWarning && (
          <Typography
            data-testid="filename-preview-warning"
            variant="caption"
            color="warning"
            className="mt-2 block"
          >
            {previewWarning}
          </Typography>
        )}
      </Box>

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
