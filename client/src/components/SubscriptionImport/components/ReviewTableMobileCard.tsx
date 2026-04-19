import React, { useState } from 'react';
import { Checkbox, Chip, IconButton, Typography } from '../../ui';
import { Settings as SettingsIcon } from '../../../lib/icons';
import { ReviewChannel, RowState } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import ChannelThumbnail from './ChannelThumbnail';
import RowSettingsSheet from './RowSettingsSheet';
import SubFolderChip from '../../ChannelManager/components/chips/SubFolderChip';
import QualityChip from '../../ChannelManager/components/chips/QualityChip';
import RatingBadge from '../../shared/RatingBadge';

interface ReviewTableMobileCardProps {
  channel: ReviewChannel;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders: string[];
  defaultSubfolderDisplay: string | null;
  globalPreferredResolution: string;
}

const ReviewTableMobileCard: React.FC<ReviewTableMobileCardProps> = ({
  channel, rowState, dispatch, subfolders, defaultSubfolderDisplay, globalPreferredResolution,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleCheckboxChange = () => {
    dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: channel.channelId });
  };

  return (
    <div className={`mb-3 flex items-start justify-between gap-3 rounded-[var(--radius-ui)] border border-[var(--border-strong)] bg-card p-3 ${channel.alreadySubscribed ? 'opacity-60' : ''}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ChannelThumbnail thumbnailUrl={channel.thumbnailUrl} title={channel.title} size={36} />
        <div className="min-w-0 flex-1">
          <Typography variant="body2" noWrap className="font-semibold">
            {channel.title}
          </Typography>
          {channel.alreadySubscribed ? (
            <div className="mt-2">
              <Chip label="Already subscribed" size="small" color="default" />
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <SubFolderChip subFolder={rowState.settings.subFolder} />
              <QualityChip
                videoQuality={rowState.settings.videoQuality}
                globalPreferredResolution={globalPreferredResolution}
              />
              <RatingBadge rating={rowState.settings.defaultRating} />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Checkbox
          checked={rowState.selected}
          onChange={handleCheckboxChange}
          disabled={channel.alreadySubscribed}
          size="small"
          inputProps={{ 'aria-label': `Select ${channel.title}` }}
        />
        <IconButton
          size="small"
          onClick={() => setSheetOpen(true)}
          aria-label={`Settings for ${channel.title}`}
          disabled={channel.alreadySubscribed}
        >
          <SettingsIcon size={16} />
        </IconButton>
      </div>

      <RowSettingsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onOpen={() => setSheetOpen(true)}
        channelId={channel.channelId}
        rowState={rowState}
        dispatch={dispatch}
        subfolders={subfolders}
        defaultSubfolderDisplay={defaultSubfolderDisplay}
      />
    </div>
  );
};

export default ReviewTableMobileCard;
