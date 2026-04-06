import React, { useState } from 'react';
import { Box, Card, Checkbox, Chip, IconButton, Typography } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
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
    <Card
      variant="outlined"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.5,
        mb: 1,
        opacity: channel.alreadySubscribed ? 0.6 : 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
        <ChannelThumbnail thumbnailUrl={channel.thumbnailUrl} title={channel.title} size={36} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
            {channel.title}
          </Typography>
          {channel.alreadySubscribed ? (
            <Chip label="Already subscribed" size="small" color="default" sx={{ mt: 0.5 }} />
          ) : (
            <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <SubFolderChip subFolder={rowState.settings.subFolder} />
              <QualityChip
                videoQuality={rowState.settings.videoQuality}
                globalPreferredResolution={globalPreferredResolution}
              />
              <RatingBadge rating={rowState.settings.defaultRating} />
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ml: 1 }}>
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
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Box>

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
    </Card>
  );
};

export default ReviewTableMobileCard;
