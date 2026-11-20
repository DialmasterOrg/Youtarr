import React, { ChangeEvent } from 'react';
import { Alert, Box, Button, TextField, Typography } from '../../../ui';
import PageControls from '../../../shared/PageControls';
import { ArrPagedList } from '../../hooks/useArrBridgePagedList';

interface ArrBridgeListFrameProps {
  list: ArrPagedList<unknown>;
  intro: string;
  searchLabel: string;
  /** What the search box matches. */
  searchHint: string;
  loadingText: string;
  emptyText: string;
  noMatchText: string;
  /** The rows of the page, shown when there are any. */
  children: React.ReactNode;
}

/**
 * What the Sonarr/Radarr grab and search lists share: the search box,
 * Refresh, the empty and error states, and the page buttons.
 */
export const ArrBridgeListFrame: React.FC<ArrBridgeListFrameProps> = ({
  list, intro, searchLabel, searchHint, loadingText, emptyText, noMatchText, children,
}) => {
  const { items, total, page, pageSize, query, loading, error } = list;
  const firstRow = (page - 1) * pageSize + 1;
  const nothingText = query.trim() ? noMatchText : emptyText;

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="body2" color="text.secondary">
        {intro}
      </Typography>
      <Box className="flex flex-col gap-1">
        <Box className="flex items-stretch gap-2">
          {/* The sizing sits on this wrapper: TextField puts className on an inner element of a column. */}
          <Box className="min-w-0 flex-1">
            <TextField
              size="small"
              type="search"
              fullWidth
              label={searchLabel}
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => list.setQuery(event.target.value)}
            />
          </Box>
          {/* As tall as the field beside it. */}
          <Button variant="outlined" size="small" className="h-auto" disabled={loading} onClick={list.refresh}>
            Refresh
          </Button>
        </Box>
        {/* Under the whole row, so a phone does not wrap it beside the button. */}
        <Typography variant="caption" color="text.secondary" className="px-3.5">
          {searchHint}
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {loading ? loadingText : nothingText}
        </Typography>
      )}
      {!error && items.length > 0 && (
        <>
          {children}
          <Box className="flex flex-wrap items-center justify-between gap-2">
            {/* While a page loads, the rows are still those of the page before. */}
            <Typography variant="body2" color="text.secondary">
              {loading ? 'Loading...' : `${firstRow} to ${firstRow + items.length - 1} of ${total}`}
            </Typography>
            <PageControls page={page} totalPages={Math.ceil(total / pageSize)} onPageChange={list.setPage} compact />
          </Box>
        </>
      )}
    </Box>
  );
};

export default ArrBridgeListFrame;
