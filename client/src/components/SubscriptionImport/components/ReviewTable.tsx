import React, { useMemo, useState } from 'react';
import {
  Box, Checkbox, List, Table, TableBody, TableCell,
  TableHead, TablePagination, TableRow, useMediaQuery, useTheme,
} from '@mui/material';
import { ReviewChannel, RowState } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import ReviewTableRow from './ReviewTableRow';
import ReviewTableMobileCard from './ReviewTableMobileCard';

interface ReviewTableProps {
  channels: ReviewChannel[];
  rowStates: Record<string, RowState>;
  dispatch: React.Dispatch<ImportFlowAction>;
}

const ROWS_PER_PAGE = 100;

const ReviewTable: React.FC<ReviewTableProps> = ({ channels, rowStates, dispatch }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [page, setPage] = useState(0);

  const pageChannels = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return channels.slice(start, start + ROWS_PER_PAGE);
  }, [channels, page]);

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const allOnPageSelected = useMemo(() => {
    const eligible = pageChannels.filter((c) => !c.alreadySubscribed);
    if (eligible.length === 0) return false;
    return eligible.every((c) => rowStates[c.channelId]?.selected);
  }, [pageChannels, rowStates]);

  const someOnPageSelected = useMemo(() => {
    const eligible = pageChannels.filter((c) => !c.alreadySubscribed);
    if (eligible.length === 0) return false;
    const selectedCount = eligible.filter((c) => rowStates[c.channelId]?.selected).length;
    return selectedCount > 0 && selectedCount < eligible.length;
  }, [pageChannels, rowStates]);

  const handleHeaderCheckboxChange = () => {
    const eligible = pageChannels.filter((c) => !c.alreadySubscribed);
    if (allOnPageSelected) {
      for (const c of eligible) {
        if (rowStates[c.channelId]?.selected) {
          dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: c.channelId });
        }
      }
    } else {
      for (const c of eligible) {
        if (!rowStates[c.channelId]?.selected) {
          dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: c.channelId });
        }
      }
    }
  };

  if (isMobile) {
    return (
      <Box>
        <List disablePadding>
          {pageChannels.map((channel) => (
            <ReviewTableMobileCard
              key={channel.channelId}
              channel={channel}
              rowState={rowStates[channel.channelId]}
              dispatch={dispatch}
            />
          ))}
        </List>
        {channels.length > ROWS_PER_PAGE && (
          <TablePagination
            component="div"
            count={channels.length}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={ROWS_PER_PAGE}
            rowsPerPageOptions={[ROWS_PER_PAGE]}
          />
        )}
      </Box>
    );
  }

  return (
    <Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                checked={allOnPageSelected}
                indeterminate={someOnPageSelected}
                onChange={handleHeaderCheckboxChange}
                inputProps={{ 'aria-label': 'Select all on page' }}
              />
            </TableCell>
            <TableCell sx={{ width: 56 }} />
            <TableCell>Channel</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" sx={{ width: 56 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {pageChannels.map((channel) => (
            <ReviewTableRow
              key={channel.channelId}
              channel={channel}
              rowState={rowStates[channel.channelId]}
              dispatch={dispatch}
            />
          ))}
        </TableBody>
      </Table>
      {channels.length > ROWS_PER_PAGE && (
        <TablePagination
          component="div"
          count={channels.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[ROWS_PER_PAGE]}
        />
      )}
    </Box>
  );
};

export default ReviewTable;
