import React, { useState } from 'react';
import { Box, Checkbox, Chip, IconButton, TableCell, TableRow } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { ReviewChannel, RowState } from '../../../types/subscriptionImport';
import { ImportFlowAction } from '../hooks/useImportFlow';
import ChannelThumbnail from './ChannelThumbnail';
import RowSettingsPopover from './RowSettingsPopover';
import SubFolderChip from '../../ChannelManager/components/chips/SubFolderChip';
import QualityChip from '../../ChannelManager/components/chips/QualityChip';
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
    <TableRow
      sx={{
        opacity: channel.alreadySubscribed ? 0.6 : 1,
      }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          checked={rowState.selected}
          onChange={handleCheckboxChange}
          disabled={channel.alreadySubscribed}
          inputProps={{ 'aria-label': `Select ${channel.title}` }}
        />
      </TableCell>
      <TableCell sx={{ width: 56 }}>
        <ChannelThumbnail thumbnailUrl={channel.thumbnailUrl} title={channel.title} size={36} />
      </TableCell>
      <TableCell>{channel.title}</TableCell>
      <TableCell>
        {channel.alreadySubscribed ? (
          <Chip label="Already subscribed" size="small" color="default" />
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <SubFolderChip subFolder={rowState.settings.subFolder} />
            <QualityChip
              videoQuality={rowState.settings.videoQuality}
              globalPreferredResolution={globalPreferredResolution}
            />
            <RatingBadge rating={rowState.settings.defaultRating} />
          </Box>
        )}
      </TableCell>
      <TableCell align="right" sx={{ width: 56 }}>
        <IconButton
          size="small"
          onClick={handleGearClick}
          aria-label={`Settings for ${channel.title}`}
        >
          <SettingsIcon fontSize="small" />
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
