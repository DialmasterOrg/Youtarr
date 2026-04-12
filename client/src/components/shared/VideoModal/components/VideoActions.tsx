import React from 'react';
import { Box, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import BlockIcon from '@mui/icons-material/Block';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ProtectionShieldButton from '../../ProtectionShieldButton';
import { VideoModalData } from '../types';

interface VideoActionsProps {
  video: VideoModalData;
  onDelete: () => void;
  onProtectionToggle: () => void;
  onIgnoreToggle: () => void;
  onRatingChange: () => void;
  protectionLoading: boolean;
}

function VideoActions({
  video,
  onDelete,
  onProtectionToggle,
  onIgnoreToggle,
  onRatingChange,
  protectionLoading,
}: VideoActionsProps) {
  const isDownloadedAndPresent = video.isDownloaded && video.status !== 'missing';
  const showProtect = isDownloadedAndPresent;
  const showRating = isDownloadedAndPresent;
  const showIgnore = !video.isDownloaded || video.isIgnored;
  const showDelete = video.isDownloaded || video.status === 'missing';

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {showProtect && (
        <ProtectionShieldButton
          isProtected={video.isProtected}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (!protectionLoading) {
              onProtectionToggle();
            }
          }}
          variant="inline"
          size="small"
        />
      )}

      {showRating && (
        <Button
          size="small"
          startIcon={<StarIcon />}
          onClick={onRatingChange}
          sx={{ textTransform: 'none' }}
        >
          {video.normalizedRating ? `${video.normalizedRating}` : 'Rate'}
        </Button>
      )}

      {showIgnore && (
        <Button
          size="small"
          startIcon={video.isIgnored ? <VisibilityIcon /> : <BlockIcon />}
          onClick={onIgnoreToggle}
          sx={{ textTransform: 'none' }}
        >
          {video.isIgnored ? 'Unignore' : 'Ignore'}
        </Button>
      )}

      {showDelete && (
        <Button
          size="small"
          startIcon={<DeleteIcon />}
          onClick={onDelete}
          color="error"
          sx={{ textTransform: 'none' }}
        >
          Delete
        </Button>
      )}
    </Box>
  );
}

export default VideoActions;
