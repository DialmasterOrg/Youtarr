import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, List, ListItem, TextField, Typography } from '../../ui';
import { CheckCircle as CheckCircleIcon, XCircle as CancelIcon } from '../../../lib/icons';
import { formatDuration } from '../../../utils';
import { hasDownloadFilters, PlaylistFilterValues, usePlaylistFilterPreview } from '../hooks/usePlaylistFilterPreview';

interface PlaylistDownloadFiltersProps {
  value: PlaylistFilterValues;
  onChange: (next: PlaylistFilterValues) => void;
  playlistId: string;
  token: string | null;
  // Whether the playlist has filters saved now. Clearing them all is then an
  // edit worth previewing: it is the one that releases the most videos.
  hasSavedFilters: boolean;
  // Whether automatic downloads are running; changes how waiting videos are described.
  autoDownload: boolean;
  disabled?: boolean;
}

const SECONDS_PER_MINUTE = 60;
// The longest duration the server accepts.
const MAX_DURATION_SECONDS = 24 * 60 * SECONDS_PER_MINUTE;
const REGEX_DOCS_URL = 'https://docs.python.org/3/library/re.html#regular-expression-syntax';

const TITLE_FILTER_EXAMPLES = [
  { label: 'Only titles containing a phrase', pattern: '(?i)full episode' },
  { label: 'Titles containing any of several phrases', pattern: '(?i)(interview|podcast)' },
  { label: 'Everything except titles containing a word', pattern: '(?i)^(?!.*trailer).*' },
];

type DurationField = 'min_duration' | 'max_duration';

function toMinutesInput(seconds: number | null): string {
  return seconds == null ? '' : String(Math.floor(seconds / SECONDS_PER_MINUTE));
}

// Blank, zero and anything that is not a whole number of minutes mean no limit.
// The server compares exact seconds, so a maximum is saved as the last second
// of its final minute: "10" keeps a 10:59 video, as a channel maximum does.
// A 24-hour maximum is the exception: it is already the server's limit.
function toSeconds(minutesInput: string, field: DurationField): number | null {
  const minutes = Number(minutesInput);
  if (minutesInput.trim() === '' || !Number.isInteger(minutes) || minutes <= 0) return null;
  const seconds = minutes * SECONDS_PER_MINUTE;
  if (field === 'min_duration' || seconds === MAX_DURATION_SECONDS) return seconds;
  return seconds + SECONDS_PER_MINUTE - 1;
}

// Waiting videos are a fact about the playlist, not a consequence of the edit:
// the same ones may be waiting under the saved filters too.
function waitingMessage(count: number, autoDownload: boolean): string {
  const videos = `${count} ${count === 1 ? 'video' : 'videos'} found since this playlist started following`;
  const outcome = autoDownload
    ? `${count === 1 ? 'is' : 'are'} waiting to download automatically`
    : 'will download once auto-download is resumed';
  return `With these filters, ${videos} ${outcome}. To skip them, save these filters, then use Follow from now.`;
}

/**
 * The download filters of a playlist: which videos Youtarr picks by itself.
 * Controlled, with durations in seconds; the preview asks the server about the
 * values as entered, so a filter can be checked before it is saved.
 */
const PlaylistDownloadFilters: React.FC<PlaylistDownloadFiltersProps> = ({
  value,
  onChange,
  playlistId,
  token,
  hasSavedFilters,
  autoDownload,
  disabled = false,
}) => {
  const [showExamples, setShowExamples] = useState(false);
  const { preview, loading, error, runPreview, clearPreview } = usePlaylistFilterPreview({ token, playlistId });
  const resultRef = useRef<HTMLDivElement>(null);

  // The result renders below the button, at the end of a scrolling dialog, so
  // without this a preview on a short screen appears to do nothing.
  useEffect(() => {
    if (!preview && !error) return;
    resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [preview, error]);

  // Results describe the filters they were run with, so they are dropped when
  // the filters change, whether by an edit here or because the parent replaced them.
  const { min_duration: minDuration, max_duration: maxDuration, title_filter_regex: titleFilter } = value;
  useEffect(() => {
    clearPreview();
  }, [clearPreview, playlistId, minDuration, maxDuration, titleFilter]);

  const changeDuration = (field: DurationField, minutesInput: string) =>
    onChange({ ...value, [field]: toSeconds(minutesInput, field) });
  const changeTitleFilter = (pattern: string) => onChange({ ...value, title_filter_regex: pattern || null });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
          Download Filters
        </Typography>
        <Typography variant="caption" color="text.secondary" className="block">
          Automatic downloads and Download all only pick videos that pass these filters. Videos that do not pass
          stay in the list, marked Filtered, and still download when you select them yourself. A channel&apos;s own
          filters do not apply to playlist downloads.
        </Typography>
      </div>

      {/* The fields' labels float above their borders, so each row needs room above it. */}
      <div className="flex flex-col gap-5 pt-2">
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-3">
          <TextField
            label="Min Duration (mins)"
            type="number"
            value={toMinutesInput(value.min_duration)}
            onChange={(e) => changeDuration('min_duration', e.target.value)}
            placeholder="No minimum"
            fullWidth
            size="small"
            disabled={disabled}
            inputProps={{ min: 0 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Max Duration (mins)"
            type="number"
            value={toMinutesInput(value.max_duration)}
            onChange={(e) => changeDuration('max_duration', e.target.value)}
            placeholder="No maximum"
            fullWidth
            size="small"
            disabled={disabled}
            inputProps={{ min: 0 }}
            InputLabelProps={{ shrink: true }}
          />
        </div>

        <div>
          <TextField
            label="Title Filter (Python Regex)"
            value={value.title_filter_regex ?? ''}
            onChange={(e) => changeTitleFilter(e.target.value)}
            placeholder="e.g., (?i)full episode"
            fullWidth
            size="small"
            disabled={disabled}
            InputLabelProps={{ shrink: true }}
          />
          <Typography variant="caption" color="text.secondary" className="block mt-1">
            Only videos whose title matches are picked. Matching is case sensitive unless the pattern starts with
            (?i), the same as channel title filters.{' '}
            <a href={REGEX_DOCS_URL} target="_blank" rel="noopener noreferrer" className="underline">
              Python regex syntax
            </a>
          </Typography>
          <Button variant="text" size="sm" onClick={() => setShowExamples((shown) => !shown)}>
            {showExamples ? 'Hide examples' : 'Show examples'}
          </Button>
          {showExamples && (
            <div className="mt-1 flex flex-col gap-2 rounded-md border border-border bg-muted p-3">
              {TITLE_FILTER_EXAMPLES.map((example) => (
                <div key={example.pattern} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Typography variant="caption" className="block" style={{ fontWeight: 600 }}>
                      {example.label}
                    </Typography>
                    <code className="break-all text-xs">{example.pattern}</code>
                  </div>
                  <Button
                    variant="outlined"
                    size="sm"
                    disabled={disabled}
                    aria-label={`Use ${example.pattern}`}
                    onClick={() => changeTitleFilter(example.pattern)}
                  >
                    Use
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <Button
          variant="outlined"
          size="sm"
          loading={loading}
          disabled={disabled || loading || !(hasSavedFilters || hasDownloadFilters(value))}
          onClick={() => void runPreview(value)}
        >
          Preview filters
        </Button>
      </div>

      <div ref={resultRef} className="flex flex-col gap-2">
        {error && <Alert severity="error">{error}</Alert>}

        {preview && (
          <>
            <Typography variant="body2">
              {`${preview.matchCount} of ${preview.totalCount} videos in this playlist match.`}
            </Typography>
            {preview.waitingCount != null && preview.waitingCount > 0 && (
              <Alert severity="info">{waitingMessage(preview.waitingCount, autoDownload)}</Alert>
            )}
            <div className="max-h-52 overflow-y-auto rounded-md border border-border">
              <List dense>
                {preview.videos.map((video) => (
                  <ListItem key={video.youtube_id} className="flex items-start gap-2 text-xs">
                    <span
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
                      style={{ color: video.matches ? 'var(--success)' : 'var(--muted-foreground)' }}
                    >
                      {video.matches ? <CheckCircleIcon size={14} aria-hidden /> : <CancelIcon size={14} aria-hidden />}
                      {video.matches ? 'Matches' : 'Skipped'}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{video.title || video.youtube_id}</span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                      {formatDuration(video.duration)}
                    </span>
                  </ListItem>
                ))}
              </List>
            </div>
            {preview.truncated && (
              <Typography variant="caption" color="text.secondary">
                {`Showing the ${preview.videos.length} most recently discovered videos; the count covers all ${preview.totalCount}.`}
              </Typography>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PlaylistDownloadFilters;
