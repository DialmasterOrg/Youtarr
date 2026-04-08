import React, { useMemo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ReviewChannel, RowState } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';

interface BulkActionsBarProps {
  channels: ReviewChannel[];
  rowStates: Record<string, RowState>;
  dispatch: React.Dispatch<ImportFlowAction>;
  onStartImport: () => void;
  importDisabled: boolean;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  channels, rowStates, dispatch, onStartImport, importDisabled,
}) => {
  const { selectedCount, eligibleCount, allAutoDownloadEnabled } = useMemo(() => {
    let selected = 0;
    let eligible = 0;
    let allAutoOn = true;
    let hasSelected = false;

    for (const channel of channels) {
      const row = rowStates[channel.channelId];
      if (!channel.alreadySubscribed) {
        eligible++;
      }
      if (row?.selected) {
        selected++;
        hasSelected = true;
        if (!row.settings.autoDownloadEnabled) {
          allAutoOn = false;
        }
      }
    }

    return {
      selectedCount: selected,
      eligibleCount: eligible,
      allAutoDownloadEnabled: hasSelected && allAutoOn,
    };
  }, [channels, rowStates]);

  const handleSelectAll = () => {
    dispatch({ type: 'SELECT_ALL' });
  };

  const handleDeselectAll = () => {
    dispatch({ type: 'DESELECT_ALL' });
  };

  const handleToggleAutoDownload = () => {
    dispatch({ type: 'TOGGLE_ALL_AUTO_DOWNLOAD', payload: !allAutoDownloadEnabled });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        py: 1.5,
        px: 1,
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
        {selectedCount} of {eligibleCount} selected
      </Typography>

      <Button variant="text" size="small" onClick={handleSelectAll}>
        Select all
      </Button>

      <Button variant="text" size="small" onClick={handleDeselectAll}>
        Deselect all
      </Button>

      <Button variant="text" size="small" onClick={handleToggleAutoDownload}>
        {allAutoDownloadEnabled ? 'Disable auto-download' : 'Enable auto-download'}
      </Button>

      <Box sx={{ flex: 1 }} />

      <Button
        variant="contained"
        disabled={selectedCount === 0 || importDisabled}
        onClick={onStartImport}
      >
        Import selected ({selectedCount})
      </Button>
    </Box>
  );
};

export default BulkActionsBar;
