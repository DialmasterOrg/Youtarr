import React, { ChangeEvent, useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LIBRARY_FOLDERS_PATH } from '../../../../utils/libraryLayouts';
import {
  Box,
  TextField,
  Typography,
  Button,
  CircularProgress,
  Tooltip,
} from '../../../ui';
import { Info as InfoIcon, Tv } from '../../../../lib/icons';
import { cn } from '../../../../lib/cn';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
import { settingDescriptionId } from '../../common/SettingRow';
import {
  FILENAME_PRESETS,
  PLEX_TV_SERIES_PRESET_PREFIX,
} from '../../../../utils/filenameTemplate/presets';
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
  /** Id of the template input; its SettingRow label and description point at it */
  inputId?: string;
}

const PHONE_QUERY = '(max-width: 767px)';

const SEVERITY_TEXT: Record<'warn' | 'danger', string> = {
  warn:
    "Long filename. With deep subfolders or non-ASCII channel names, the full path may approach Windows' 260-character limit, which would cause downloads to fail.",
  danger:
    "Filename is very long. Downloads are likely to fail on Windows and SMB-mounted NAS shares (260-char path limit). Pure CJK or emoji content can also exceed Linux/macOS' 255-byte per-filename limit.",
};

const TV_SHOW_HINT =
  'For TV-style channels, use a TV shows folder instead. Episodes then get Season folders, SxxEyy names and .nfo files.';

export const VideoFilenameTemplate: React.FC<VideoFilenameTemplateProps> = ({
  value,
  onChange,
  token,
  saveRequirement,
  onPreviewSuccess,
  inputId = 'videoFilenamePrefix',
}) => {
  const phone = useMediaQuery(PHONE_QUERY);
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
      <TextField
        id={inputId}
        fullWidth
        className="[&_input]:font-mono"
        value={value}
        onChange={handleChange as React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>}
        error={!validation.ok}
        helperText={validation.error}
        aria-describedby={settingDescriptionId(inputId)}
        inputProps={{ 'aria-label': 'Video filename template' }}
      />

      <Box className="flex flex-wrap gap-2">
        {FILENAME_PRESETS.map((preset) => {
          const presetButton = (
            <Button
              key={preset.label}
              variant="outlined"
              size="small"
              aria-pressed={value === preset.prefix}
              className={cn(value === preset.prefix && 'border-primary bg-primary/10', phone ? 'min-h-[44px]' : 'h-[30px]')}
              onClick={() => onChange(preset.prefix)}
              title={preset.description}
            >
              {preset.label}
            </Button>
          );
          if (preset.prefix !== PLEX_TV_SERIES_PRESET_PREFIX) return presetButton;
          return (
            <Box key={preset.label} className="inline-flex items-center gap-1">
              {presetButton}
              <Tooltip title={TV_SHOW_HINT} placement="top">
                <button
                  type="button"
                  aria-label="About saving channels as TV shows"
                  className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-[44px] max-md:min-w-[44px]"
                >
                  <InfoIcon size={16} aria-hidden />
                </button>
              </Tooltip>
            </Box>
          );
        })}
      </Box>

      {value === PLEX_TV_SERIES_PRESET_PREFIX && (
        <p data-testid="tv-series-tip" className="flex items-start gap-2 rounded-ui bg-muted p-2 text-[13px] text-muted-foreground">
          <Tv size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-info" />
          <span>
            Want channels as real TV shows? Download them to a TV shows folder instead: episodes get Season folders, SxxEyy names and
            .nfo files, and this template doesn&apos;t apply there. This preset doesn&apos;t convert anything: switching a folder to TV
            shows is a separate step you review first.{' '}
            <RouterLink to={LIBRARY_FOLDERS_PATH} className="text-primary underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center">Library folders</RouterLink>
          </span>
        </p>
      )}

      <Box className={cn('flex gap-3', phone ? 'flex-col items-stretch' : 'items-center')}>
        <Button
          data-testid="filename-preview-button"
          variant="outlined"
          size="small"
          fullWidth={phone}
          className={cn(phone && 'min-h-[44px]')}
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
            %(title).64B
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
            .64B
          </span>{' '}
          is not recommended. Larger values can push full paths past Windows{'’'} 260-character limit, especially with deep subfolders or non-ASCII channel names. Stick with{' '}
          <span className="font-mono px-1 py-0.5 rounded text-xs bg-muted">
            %(title).64B
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
