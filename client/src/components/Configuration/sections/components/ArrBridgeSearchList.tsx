import React, { useId, useState } from 'react';
import { Box, Button, Chip, Typography } from '../../../ui';
import { ArrPagedList } from '../../hooks/useArrBridgePagedList';
import { ArrBridgeListFrame } from './ArrBridgeListFrame';
import {
  ArrSearch,
  ArrSearchCandidate,
  ArrSearchStage,
  REJECTION_LABELS,
  SEARCH_NOTE_LABELS,
  SEARCH_STAGE_LABELS,
  TITLE_STAGE_SKIPPED_LABELS,
  describeAsked,
  formatLength,
  labelOf,
  offeredFirst,
  searchOutcome,
} from '../../utils/arrBridgeSearches';
import { youtubeVideoUrl } from '../../../../utils/youtubeUrls';

// The last column is a fixed width: with "auto", a row with the button and
// a row without one would put their other columns in different places.
const ROW_COLUMNS = 'md:grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_9rem]';
const CANDIDATE_COLUMNS = 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]';

interface ArrBridgeSearchListProps {
  list: ArrPagedList<ArrSearch>;
}

const formatWhen = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const CandidateRow: React.FC<{ candidate: ArrSearchCandidate }> = ({ candidate }) => (
  <li className={`grid gap-1 border-0 border-t border-solid border-[var(--border)] py-2 ${CANDIDATE_COLUMNS}`}>
    <span className="min-w-0">
      <a
        href={youtubeVideoUrl(candidate.youtubeId)}
        target="_blank"
        rel="noopener noreferrer"
        className="break-words text-primary underline"
      >
        {candidate.title || candidate.youtubeId}
      </a>
      <span className="block text-muted-foreground">
        {[candidate.channelName, formatLength(candidate.duration)].filter(Boolean).join(', ')}
      </span>
    </span>
    {candidate.outcome === 'offered' ? (
      <span className="min-w-0">
        <Chip size="small" color="success" label="Offered" />
        {candidate.releaseTitle && <span className="mt-1 block break-all font-mono">{candidate.releaseTitle}</span>}
      </span>
    ) : (
      <span className="min-w-0 break-words text-muted-foreground">
        {candidate.reason ? labelOf(REJECTION_LABELS, candidate.reason) : 'Not offered'}
      </span>
    )}
  </li>
);

const StageDetails: React.FC<{ stage: ArrSearchStage }> = ({ stage }) => {
  const label = labelOf(SEARCH_STAGE_LABELS, stage.matcher);
  return (
    <Box className="rounded-[var(--radius-ui)] border border-[var(--border)] bg-muted/30 p-3">
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="body2" color="text.secondary">
        Searched YouTube for <span className="break-words font-mono">{stage.query}</span>:{' '}
        {stage.results === 1 ? '1 result' : `${stage.results} results`}
      </Typography>
      {stage.candidates.length > 0 && (
        <ul className="m-0 mt-2 list-none p-0" aria-label={`Results: ${label}`}>
          {offeredFirst(stage.candidates).map((candidate, index) => (
            // One search can list a video twice, so the id alone is no key.
            <CandidateRow key={`${candidate.youtubeId}-${index}`} candidate={candidate} />
          ))}
        </ul>
      )}
    </Box>
  );
};

const SearchRow: React.FC<{ search: ArrSearch }> = ({ search }) => {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const asked = describeAsked(search);
  const { label, tone } = searchOutcome(search);
  const hasStages = search.stages.length > 0;

  return (
    <li className="border-0 border-t border-solid border-[var(--border)] py-3 text-sm">
      <Box className={`grid items-start gap-2 ${ROW_COLUMNS}`}>
        <span className="min-w-0">
          <span className="break-words font-medium">{asked}</span>
          {search.note && (
            <span className="mt-1 block break-words text-muted-foreground">
              {labelOf(SEARCH_NOTE_LABELS, search.note)}
            </span>
          )}
          {search.count > 1 && (
            <span className="mt-1 block text-muted-foreground">
              Asked {search.count} times since {formatWhen(search.firstAt)}.
            </span>
          )}
        </span>
        <span className="min-w-0">
          <Chip size="small" color={tone} label={label} />
        </span>
        <span className="text-muted-foreground">{formatWhen(search.at)}</span>
        <span className="md:text-right">
          {hasStages && (
            <Button
              variant="text"
              aria-expanded={open}
              aria-controls={detailsId}
              aria-label={`${open ? 'Hide' : 'Show'} results for ${asked}`}
              onClick={() => setOpen((isOpen) => !isOpen)}
            >
              {open ? 'Hide results' : 'Show results'}
            </Button>
          )}
        </span>
      </Box>
      {hasStages && open && (
        <Box id={detailsId} className="mt-2 flex flex-col gap-2">
          {search.titleStageSkipped && (
            <Typography variant="body2" color="text.secondary">
              {labelOf(TITLE_STAGE_SKIPPED_LABELS, search.titleStageSkipped)}
            </Typography>
          )}
          {search.stages.map((stage) => (
            <StageDetails key={stage.matcher} stage={stage} />
          ))}
        </Box>
      )}
    </li>
  );
};

/**
 * What Sonarr and Radarr searched for, and what became of each video
 * YouTube returned, one page at a time.
 */
export const ArrBridgeSearchList: React.FC<ArrBridgeSearchListProps> = ({ list }) => (
  <ArrBridgeListFrame
    list={list}
    intro="The newest searches first, kept for 30 days. This list does not update by itself."
    searchLabel="Filter searches"
    searchHint="Matches what was asked for: the name, an episode (S01E02), a season (S01), a year or an air date (2024-05-01)."
    loadingText="Loading the recent searches..."
    emptyText="No searches yet."
    noMatchText="No searches match this filter."
  >
    <Box className={`hidden gap-2 text-sm font-semibold text-muted-foreground md:grid ${ROW_COLUMNS}`} aria-hidden="true">
      <span>Asked for</span>
      <span>Answer</span>
      <span>When</span>
      <span />
    </Box>
    <ul className="m-0 list-none p-0" aria-label="Recent searches">
      {list.items.map((search) => (
        <SearchRow key={search.id} search={search} />
      ))}
    </ul>
  </ArrBridgeListFrame>
);

export default ArrBridgeSearchList;
