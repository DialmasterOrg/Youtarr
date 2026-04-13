import React from 'react';
import { Box, Button, Chip, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import BlockIcon from '@mui/icons-material/Block';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ShieldIcon from '@mui/icons-material/Shield';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { VideoModalData } from '../types';
import { VideoStatus } from '../../../../utils/videoStatus';

interface StatusChipInfo {
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}

interface MediaTypeChipInfo {
  label: string;
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  icon: React.ReactElement;
}

interface VideoActionsProps {
  video: VideoModalData;
  statusChip: StatusChipInfo;
  mediaTypeChip: MediaTypeChipInfo | null;
  onDelete: () => void;
  onProtectionToggle: () => void;
  onIgnoreToggle: () => void;
  onRatingChange: () => void;
  protectionLoading: boolean;
  isMobile: boolean;
}

const PILL_SX = {
  textTransform: 'none',
  borderRadius: 5,
  px: 1.5,
  minHeight: 32,
} as const;

function VideoActions({
  video,
  statusChip,
  mediaTypeChip,
  onDelete,
  onProtectionToggle,
  onIgnoreToggle,
  onRatingChange,
  protectionLoading,
  isMobile,
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
        gap: 0.75,
        py: 0.5,
      }}
    >
      {/* Status indicators (filled chips - not clickable) */}
      <Chip
        label={statusChip.label}
        color={statusChip.color}
        size="small"
      />
      {mediaTypeChip && (
        <Chip
          label={mediaTypeChip.label}
          color={mediaTypeChip.color}
          size="small"
          icon={mediaTypeChip.icon}
        />
      )}

      {/* Separator between status and actions */}
      <Box
        sx={{
          width: '1px',
          height: 20,
          bgcolor: 'divider',
          mx: 0.25,
        }}
      />

      {/* Action buttons (outlined pills - clickable) */}
      {showProtect && (
        <Button
          size="small"
          variant={video.isProtected ? 'contained' : 'outlined'}
          color={video.isProtected ? 'primary' : 'inherit'}
          startIcon={video.isProtected ? <ShieldIcon /> : <ShieldOutlinedIcon />}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (!protectionLoading) {
              onProtectionToggle();
            }
          }}
          disabled={protectionLoading}
          aria-label={video.isProtected ? 'Remove protection' : 'Protect from auto-deletion'}
          sx={PILL_SX}
        >
          {video.isProtected ? 'Protected' : 'Protect'}
        </Button>
      )}

      {showRating && (
        <Button
          size="small"
          variant="outlined"
          color={video.normalizedRating ? 'warning' : 'inherit'}
          startIcon={video.normalizedRating ? <StarIcon /> : <StarOutlineIcon />}
          onClick={onRatingChange}
          aria-label="Change rating"
          sx={PILL_SX}
        >
          {video.normalizedRating || 'Rate'}
        </Button>
      )}

      {showIgnore && (
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={video.isIgnored ? <VisibilityIcon /> : <BlockIcon />}
          onClick={onIgnoreToggle}
          aria-label={video.isIgnored ? 'Unignore' : 'Ignore'}
          sx={PILL_SX}
        >
          {video.isIgnored ? 'Unignore' : 'Ignore'}
        </Button>
      )}

      <Box sx={{ flex: 1 }} />

      {showDelete && (
        isMobile ? (
          <Tooltip title="Delete video">
            <IconButton
              size="small"
              color="error"
              onClick={onDelete}
              aria-label="Delete video"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            aria-label="Delete video"
            sx={PILL_SX}
          >
            Delete
          </Button>
        )
      )}
    </Box>
  );
}

export default VideoActions;
