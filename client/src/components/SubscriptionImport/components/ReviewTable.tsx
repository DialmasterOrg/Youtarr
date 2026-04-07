import React, { useEffect, useMemo, useState } from 'react';
import {
  Checkbox,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '../../ui';
import { ReviewChannel, RowState } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import ReviewTableRow from './ReviewTableRow';
import ReviewTableMobileCard from './ReviewTableMobileCard';
import useMediaQuery from '../../../hooks/useMediaQuery';
import PageControls from '../../shared/PageControls';

interface ReviewTableProps {
  channels: ReviewChannel[];
  rowStates: Record<string, RowState>;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders: string[];
  defaultSubfolderDisplay: string | null;
  globalPreferredResolution: string;
}

const ROWS_PER_PAGE = 50;

const ReviewTable: React.FC<ReviewTableProps> = ({
  channels, rowStates, dispatch, subfolders, defaultSubfolderDisplay, globalPreferredResolution,
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(channels.length / ROWS_PER_PAGE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageChannels = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return channels.slice(start, start + ROWS_PER_PAGE);
  }, [channels, page]);

  const allOnPageSelected = useMemo(() => {
    const eligible = pageChannels.filter((channel) => !channel.alreadySubscribed);
    if (eligible.length === 0) return false;
    return eligible.every((channel) => rowStates[channel.channelId]?.selected);
  }, [pageChannels, rowStates]);

  const someOnPageSelected = useMemo(() => {
    const eligible = pageChannels.filter((channel) => !channel.alreadySubscribed);
    if (eligible.length === 0) return false;
    const selectedCount = eligible.filter((channel) => rowStates[channel.channelId]?.selected).length;
    return selectedCount > 0 && selectedCount < eligible.length;
  }, [pageChannels, rowStates]);

  const handleHeaderCheckboxChange = () => {
    const eligible = pageChannels.filter((channel) => !channel.alreadySubscribed);
    for (const channel of eligible) {
      const isSelected = rowStates[channel.channelId]?.selected;
      if ((allOnPageSelected && isSelected) || (!allOnPageSelected && !isSelected)) {
        dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: channel.channelId });
      }
    }
  };

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card px-4 py-3">
          <Typography variant="body2" color="secondary">
            {channels.length} channels ready for review
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={allOnPageSelected}
                indeterminate={someOnPageSelected}
                onChange={handleHeaderCheckboxChange}
                inputProps={{ 'aria-label': 'Select all on page' }}
              />
            }
            label="Page"
          />
        </div>
        <div>
          {pageChannels.map((channel) => (
            <ReviewTableMobileCard
              key={channel.channelId}
              channel={channel}
              rowState={rowStates[channel.channelId]}
              dispatch={dispatch}
              subfolders={subfolders}
              defaultSubfolderDisplay={defaultSubfolderDisplay}
              globalPreferredResolution={globalPreferredResolution}
            />
          ))}
        </div>
        <PageControls page={page} totalPages={totalPages} onPageChange={setPage} compact />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell component="th" className="w-10">
              <Checkbox
                checked={allOnPageSelected}
                indeterminate={someOnPageSelected}
                onChange={handleHeaderCheckboxChange}
                inputProps={{ 'aria-label': 'Select all on page' }}
              />
            </TableCell>
            <TableCell component="th" className="w-14" />
            <TableCell component="th">Channel</TableCell>
            <TableCell component="th">Settings</TableCell>
            <TableCell component="th" align="right" className="w-14" />
          </TableRow>
        </TableHead>
        <TableBody>
          {pageChannels.map((channel) => (
            <ReviewTableRow
              key={channel.channelId}
              channel={channel}
              rowState={rowStates[channel.channelId]}
              dispatch={dispatch}
              subfolders={subfolders}
              defaultSubfolderDisplay={defaultSubfolderDisplay}
              globalPreferredResolution={globalPreferredResolution}
            />
          ))}
        </TableBody>
      </Table>
      <PageControls page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
};

export default ReviewTable;
