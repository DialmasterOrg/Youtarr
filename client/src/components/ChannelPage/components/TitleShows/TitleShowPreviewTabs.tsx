import React, { useState } from 'react';
import { Alert, Box, Chip, LinearProgress, Tab, Tabs, Typography } from '../../../ui';
import {
  EpisodeDownloadState, PreviewEpisodeRef, PreviewUnsupported, TitleShowPreview,
} from '../../../../types/titleShows';

type TabKey = 'episodes' | 'duplicates' | 'gaps' | 'unmatched' | 'unsupported' | 'changes';

const DOWNLOAD_LABELS: Record<EpisodeDownloadState, string> = {
  downloaded: 'Downloaded',
  queued: 'Queued',
  not_downloaded: 'Not downloaded',
};

const LOAD_ALL_NOTE = 'Load all of the channel\'s videos on its page to classify the rest too.';

function unsupportedText(entry: PreviewUnsupported): string {
  if (entry.reason === 'compilation') return `Compilation of episodes ${entry.episode}-${entry.episodeEnd}: not supported yet`;
  if (entry.reason === 'part') return `Part ${entry.part} of episode ${entry.episode}: not supported yet`;
  if (entry.reason === 'missing-number') return 'The title has no season or episode number for this pattern';
  return 'Its season or episode number is out of range';
}

function refText(ref: PreviewEpisodeRef | null): string {
  if (!ref) return 'no show';
  if (ref.status === 'pending_number') return `${ref.showName} (numbered when it downloads)`;
  if (ref.status === 'duplicate') return `a duplicate in ${ref.showName}`;
  if (ref.status === 'opted_out') return 'not an episode';
  return ref.code ? `${ref.code} of ${ref.showName}` : `${ref.showName}`;
}

interface ListProps {
  label: string;
  /** How many items the list shows, and how many there are (the server cuts long lists) */
  shown: number;
  total: number;
  children: React.ReactNode;
}

function List({ label, shown, total, children }: ListProps) {
  return (
    <ul aria-label={label} className="max-h-[320px] divide-y divide-border overflow-auto">
      {children}
      {total > shown && (
        <li className="py-1.5"><Typography variant="caption" color="text.secondary">Showing the first {shown} of {total}.</Typography></li>
      )}
    </ul>
  );
}

interface TitleShowPreviewTabsProps {
  preview: TitleShowPreview | null;
  /** The edited show's key in the preview ('title:<id>' or 'new:<index>') */
  showKey: string;
  loading: boolean;
  error: string | null;
}

/** What a show's patterns do to the channel's known videos. */
function TitleShowPreviewTabs({ preview, showKey, loading, error }: TitleShowPreviewTabsProps) {
  const [tab, setTab] = useState<TabKey>('episodes');
  if (!preview) {
    return (
      <Box className="flex flex-col gap-2">
        {loading && <LinearProgress />}
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    );
  }
  const show = preview.shows.find((entry) => entry.key === showKey) || null;
  const duplicates = preview.duplicates.filter((entry) => entry.showKey === showKey);
  const gaps = preview.gaps.filter((entry) => entry.showKey === showKey);
  const unsupported = preview.unsupported.filter((entry) => entry.showKey === showKey);
  const episodes = show ? show.episodes : [];
  const duplicateCount = show ? show.counts.duplicates : duplicates.length;
  const unsupportedCount = show ? show.counts.unsupported : unsupported.length;

  return (
    <Box className="flex flex-col gap-2">
      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="caption" color="text.secondary">
        Based on {preview.knownVideos} known videos. {LOAD_ALL_NOTE}
      </Typography>
      {preview.staysOutside > 0 && (
        <Typography variant="caption" color="text.secondary">
          {preview.staysOutside === 1
            ? '1 downloaded video is outside the downloads folder: its file stays where it is.'
            : `${preview.staysOutside} downloaded videos are outside the downloads folder: their files stay where they are.`}
        </Typography>
      )}
      <Tabs value={tab} onChange={(_event, value) => setTab(value as TabKey)} variant="scrollable" aria-label="Preview">
        <Tab value="episodes" label={`Episodes (${show ? show.counts.episodes : 0})`} />
        <Tab value="duplicates" label={`Duplicates (${duplicateCount})`} />
        <Tab value="gaps" label={`Gaps (${gaps.filter((gap) => gap.missing.length > 0).length})`} />
        <Tab value="unmatched" label={`Unmatched (${preview.unmatched.count})`} />
        <Tab value="unsupported" label={`Not supported (${unsupportedCount})`} />
        <Tab value="changes" label={`Would change (${preview.changeCount})`} />
      </Tabs>

      {tab === 'episodes' && (
        <List label="Episodes" shown={episodes.length} total={show ? show.counts.episodes : 0}>
          {episodes.map((episode) => (
            <li key={episode.youtubeId} className="flex flex-wrap items-center gap-2 py-1.5">
              {episode.code
                ? <Chip label={episode.code} size="small" variant="outlined" />
                : <Chip label="Numbered when it downloads" size="small" variant="outlined" />}
              <Typography variant="body2" className="min-w-0 flex-1 break-words">{episode.episodeTitle || episode.title}</Typography>
              <Typography variant="caption" color="text.secondary">{DOWNLOAD_LABELS[episode.downloadState]}</Typography>
            </li>
          ))}
          {episodes.length === 0 && <li className="py-1.5"><Typography variant="body2" color="text.secondary">No video matches yet.</Typography></li>}
        </List>
      )}

      {tab === 'duplicates' && (
        <List label="Duplicates" shown={duplicates.length} total={duplicateCount}>
          {duplicates.map((duplicate) => (
            <li key={duplicate.youtubeId} className="flex flex-col py-1.5">
              <Typography variant="body2" className="break-words">{duplicate.title || duplicate.youtubeId}</Typography>
              <Typography variant="caption" color="text.secondary">
                Duplicate of {duplicate.code}: {duplicate.duplicateOfTitle || duplicate.duplicateOf}
                {duplicate.downloaded ? ' (this copy is downloaded and stays where it is)' : ' (ignored, not downloaded)'}
              </Typography>
            </li>
          ))}
        </List>
      )}

      {tab === 'gaps' && (
        <List label="Gaps" shown={gaps.length} total={gaps.length}>
          {gaps.map((gap) => (
            <li key={gap.season} className="py-1.5">
              <Typography variant="body2">
                Season {gap.season}: {gap.have} of {gap.highest}
                {gap.missing.length > 0 ? `; missing ${gap.missing.map((n) => `E${n}`).join(', ')}${gap.truncated ? ', ...' : ''}` : ''}
              </Typography>
            </li>
          ))}
        </List>
      )}

      {tab === 'unmatched' && (
        <List label="Unmatched videos" shown={preview.unmatched.videos.length} total={preview.unmatched.count}>
          {preview.unmatched.videos.map((video) => (
            <li key={video.youtubeId} className="py-1.5">
              <Typography variant="body2" className="break-words">{video.title}</Typography>
            </li>
          ))}
        </List>
      )}

      {tab === 'unsupported' && (
        <List label="Not supported" shown={unsupported.length} total={unsupportedCount}>
          {unsupported.map((entry) => (
            <li key={entry.youtubeId} className="flex flex-col py-1.5">
              <Typography variant="body2" className="break-words">{entry.title || entry.youtubeId}</Typography>
              <Typography variant="caption" color="text.secondary">{unsupportedText(entry)}</Typography>
            </li>
          ))}
        </List>
      )}

      {tab === 'changes' && (
        <Box className="flex flex-col gap-1">
          {preview.filesToMove > 0 && (
            <Alert severity="info">
              {preview.filesToMove} downloaded {preview.filesToMove === 1 ? 'video moves' : 'videos move'} when you save: you review the move first.
            </Alert>
          )}
          <List label="Changes" shown={preview.changes.length} total={preview.changeCount}>
            {preview.changes.map((change) => (
              <li key={change.youtubeId} className="flex flex-col py-1.5">
                <Typography variant="body2" className="break-words">{change.title}</Typography>
                <Typography variant="caption" color="text.secondary">{`${refText(change.from)} -> ${refText(change.to)}`}</Typography>
              </li>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

export default TitleShowPreviewTabs;
