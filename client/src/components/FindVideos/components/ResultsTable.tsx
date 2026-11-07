import React from 'react';
import {
  Checkbox,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableSortLabel,
} from '../../ui';
import { formatDurationClock } from '../../../utils';
import { defaultDirectionFor, ResultSort, SortKey } from '../sortResults';
import {
  isSelectableForDownload,
  ResultSelection,
  SearchResult,
  THUMB_WIDTH,
  THUMB_HEIGHT,
} from '../types';
import {
  AddChannelHandler,
  DownloadButton,
  PublishedDate,
  ResultChannel,
  ResultStatusChip,
  ShortBadge,
  ViewCount,
} from './resultParts';

type ColumnKey = Exclude<SortKey, 'relevance'>;

interface ResultsTableProps {
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  selection?: ResultSelection;
  sort?: ResultSort;
  onSortChange?: (key: SortKey) => void;
  onAddChannel?: AddChannelHandler;
  onDownloadOne?: (result: SearchResult) => void;
}

interface SortableHeaderProps {
  column: ColumnKey;
  label: string;
  className: string;
  sort?: ResultSort;
  onSortChange?: (key: SortKey) => void;
}

function SortableHeader({ column, label, className, sort, onSortChange }: SortableHeaderProps) {
  const active = sort?.key === column;
  const direction = active ? sort.direction : defaultDirectionFor(column);
  return (
    <TableCell
      component="th"
      className={className}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {onSortChange ? (
        <TableSortLabel active={active} direction={direction} onClick={() => onSortChange(column)}>
          {label}
        </TableSortLabel>
      ) : (
        label
      )}
    </TableCell>
  );
}

export default function ResultsTable({
  results, onResultClick, selection, sort, onSortChange, onAddChannel, onDownloadOne,
}: ResultsTableProps) {
  const headerProps = { sort, onSortChange };
  return (
    <TableContainer>
      {/* Minimum widths keep the title readable at tablet widths; the container scrolls instead. */}
      <Table size="small" className="table-auto min-w-[760px]">
        <TableHead>
          <TableRow>
            {selection && <TableCell component="th" className="w-[40px]" aria-label="Select" />}
            <TableCell component="th" className="w-[140px]">Thumbnail</TableCell>
            <SortableHeader column="title" label="Title" className="min-w-[240px] w-[40%]" {...headerProps} />
            <SortableHeader column="channel" label="Channel" className="min-w-[160px] w-[20%]" {...headerProps} />
            <SortableHeader column="published" label="Published" className="w-[120px] whitespace-nowrap" {...headerProps} />
            <SortableHeader column="duration" label="Duration" className="w-[110px] whitespace-nowrap" {...headerProps} />
            <SortableHeader column="views" label="Views" className="w-[80px] whitespace-nowrap" {...headerProps} />
            <TableCell component="th" className="w-[150px] whitespace-nowrap">Status</TableCell>
            {onDownloadOne && <TableCell component="th" className="w-[48px]" aria-label="Actions" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result) => {
            const selectable = Boolean(selection) && isSelectableForDownload(result.status);
            const checked = selectable && selection!.isChecked(result.youtubeId);
            return (
              <TableRow
                key={result.youtubeId}
                hover
                onClick={() => onResultClick(result)}
                className="cursor-pointer"
                aria-label={`Open ${result.title}`}
              >
                {selection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {selectable ? (
                      <Checkbox
                        checked={checked}
                        onChange={() => selection.toggle(result.youtubeId)}
                        inputProps={{
                          'aria-label': `Select ${result.title} for download`,
                          'data-testid': `select-row-${result.youtubeId}`,
                        }}
                      />
                    ) : null}
                  </TableCell>
                )}
                <TableCell>
                  <div
                    className="relative inline-block overflow-hidden bg-[var(--media-placeholder-background)] rounded-[var(--radius-thumb)]"
                    style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                  >
                    {result.thumbnailUrl && (
                      <img
                        src={result.thumbnailUrl}
                        alt=""
                        className="block object-cover rounded-[var(--radius-thumb)]"
                        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                        loading="lazy"
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" className="line-clamp-2 whitespace-normal">
                    {result.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <ResultChannel
                    result={result}
                    variant="body2"
                    className="text-muted-foreground truncate"
                    onAddChannel={onAddChannel}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <PublishedDate publishedAt={result.publishedAt} fallback="N/A" />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {formatDurationClock(result.duration) || '-'}
                    <ShortBadge duration={result.duration} />
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {result.viewCount === null ? '-' : <ViewCount viewCount={result.viewCount} icon={false} />}
                </TableCell>
                <TableCell>
                  <ResultStatusChip status={result.status} />
                </TableCell>
                {onDownloadOne && (
                  <TableCell>
                    <DownloadButton result={result} onDownload={onDownloadOne} />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
