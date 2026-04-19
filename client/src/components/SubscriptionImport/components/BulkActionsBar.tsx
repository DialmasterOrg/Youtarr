import React, { useMemo } from 'react';
import { Button, Chip, Typography } from '../../ui';
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
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card px-4 py-3">
      <Chip
        size="small"
        color={selectedCount > 0 ? 'primary' : 'default'}
        label={`${selectedCount} of ${eligibleCount} selected`}
      />
      <Button variant="text" size="small" onClick={handleSelectAll}>Select all</Button>
      <Button variant="text" size="small" onClick={handleDeselectAll}>Deselect all</Button>
      <Button variant="text" size="small" onClick={handleToggleAutoDownload}>
        {allAutoDownloadEnabled ? 'Disable auto-download' : 'Enable auto-download'}
      </Button>
      <div className="flex-1" />
      <Typography variant="caption" color="secondary" className="mr-2">
        Review settings before starting the import.
      </Typography>
      <Button
        variant="contained"
        disabled={selectedCount === 0 || importDisabled}
        onClick={onStartImport}
      >
        Import selected ({selectedCount})
      </Button>
    </div>
  );
};

export default BulkActionsBar;
