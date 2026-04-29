import React from 'react';
import {
  Checkbox,
  Typography,
  Chip,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '../../ui';
import { CalendarToday as CalendarTodayIcon } from '../../../lib/icons';
import {
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  getStatusChipVariant,
  getStatusChipStyle,
  VideoStatus,
} from '../../../utils/videoStatus';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from '../../shared/chipStyles';
import { formatDurationClock } from '../../../utils';
import {
  isSelectableForDownload,
  ResultSelection,
  SearchResult,
  THUMB_WIDTH,
  THUMB_HEIGHT,
} from '../types';

function StatusChip({ status }: { status: VideoStatus }) {
  return (
    <Chip
      icon={getStatusIcon(status)}
      label={getStatusLabel(status)}
      size="small"
      color={getStatusColor(status)}
      variant={getStatusChipVariant(status)}
      style={{
        ...SHARED_THEMED_CHIP_SMALL_STYLE,
        ...getStatusChipStyle(status),
      }}
    />
  );
}

interface ResultsTableProps {
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  selection?: ResultSelection;
}

export default function ResultsTable({ results, onResultClick, selection }: ResultsTableProps) {
  return (
    <TableContainer>
      <Table size="small" className="table-fixed">
        <TableHead>
          <TableRow>
            {selection && <TableCell component="th" className="w-[40px]" aria-label="Select" />}
            <TableCell component="th" className="w-[140px]">Thumbnail</TableCell>
            <TableCell component="th" className="w-[40%]">Title</TableCell>
            <TableCell component="th" className="w-[22%]">Channel</TableCell>
            <TableCell component="th" className="w-[110px] whitespace-nowrap">Published</TableCell>
            <TableCell component="th" className="w-[90px] whitespace-nowrap">Duration</TableCell>
            <TableCell component="th" className="w-[160px] whitespace-nowrap">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((result) => {
            const status: VideoStatus = result.status;
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
                  <Typography variant="body2" className="text-muted-foreground">
                    {result.channelName}
                  </Typography>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {result.publishedAt ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarTodayIcon size={12} />
                      {new Date(result.publishedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    'N/A'
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDurationClock(result.duration) || '-'}
                </TableCell>
                <TableCell>
                  <StatusChip status={status} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
