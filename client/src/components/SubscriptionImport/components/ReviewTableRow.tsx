import React, { useState } from 'react';
import { Checkbox, Chip, IconButton, TableCell, TableRow } from '../../ui';
import { Settings as SettingsIcon } from '../../../lib/icons';
import { ReviewChannel, RowState } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import ChannelThumbnail from './ChannelThumbnail';
import RowSettingsPopover from './RowSettingsPopover';
import SubFolderChip from '../../Subscriptions/components/chips/SubFolderChip';
import QualityChip from '../../Subscriptions/components/chips/QualityChip';
import RatingBadge from '../../shared/RatingBadge';

interface ReviewTableRowProps {
  channel: ReviewChannel;
  rowState: RowState;
  dispatch: React.Dispatch<ImportFlowAction>;
  subfolders: string[];
  defaultSubfolderDisplay: string | null;
  globalPreferredResolution: string;
}

const ReviewTableRow: React.FC<ReviewTableRowProps> = ({
  channel, rowState, dispatch, subfolders, defaultSubfolderDisplay, globalPreferredResolution,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const popoverOpen = Boolean(anchorEl);

  const handleCheckboxChange = () => {
    dispatch({ type: 'TOGGLE_ROW_SELECTION', payload: channel.channelId });
  };

  const handleGearClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  return (
    <TableRow hover className={channel.alreadySubscribed ? 'opacity-60' : undefined}>
      <TableCell className="w-10">
        <Checkbox
          checked={rowState.selected}
          onChange={handleCheckboxChange}
          disabled={channel.alreadySubscribed}
          size="small"
          inputProps={{ 'aria-label': `Select ${channel.title}` }}
        />
      </TableCell>
      <TableCell className="w-14">
        <ChannelThumbnail thumbnailUrl={channel.thumbnailUrl} title={channel.title} size={36} />
      </TableCell>
      <TableCell>{channel.title}</TableCell>
      <TableCell>
        {channel.alreadySubscribed ? (
          <Chip label="Already subscribed" size="small" color="default" />
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <SubFolderChip subFolder={rowState.settings.subFolder} />
            <QualityChip
              videoQuality={rowState.settings.videoQuality}
              globalPreferredResolution={globalPreferredResolution}
            />
            <RatingBadge rating={rowState.settings.defaultRating} />
          </div>
        )}
      </TableCell>
      <TableCell align="right" className="w-14">
        <IconButton
          size="small"
          onClick={handleGearClick}
          aria-label={`Settings for ${channel.title}`}
          disabled={channel.alreadySubscribed}
        >
          <SettingsIcon size={16} />
        </IconButton>
        <RowSettingsPopover
          anchorEl={anchorEl}
          open={popoverOpen}
          onClose={handlePopoverClose}
          channelId={channel.channelId}
          rowState={rowState}
          dispatch={dispatch}
          subfolders={subfolders}
          defaultSubfolderDisplay={defaultSubfolderDisplay}
        />
      </TableCell>
    </TableRow>
  );
};

export default ReviewTableRow;
