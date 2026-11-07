import React from 'react';
import { Box, Button, Chip, Tooltip } from '../../../ui';
import RatingBadge from '../../../shared/RatingBadge';
import {
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Block as BlockIcon,
  Eye as VisibilityIcon,
  Shield as ShieldIcon,
  ShieldCheck as ShieldOutlinedIcon,
} from '../../../../lib/icons';
import { FileX as MarkDeletedIcon, Youtube as YoutubeIcon } from 'lucide-react';
import { VideoModalData } from '../types';
import {
  getMediaTypeInfo,
  getStatusChipStyle,
  getStatusChipVariant,
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  isRemovedStatus,
} from '../../../../utils/videoStatus';
import { SHARED_STATUS_CHIP_STYLE, SHARED_THEMED_CHIP_STYLE } from '../../../shared/chipStyles';
import { YOUTUBE_URL_BASE } from '../constants';

interface VideoActionsProps {
  video: VideoModalData;
  onDelete: () => void;
  onProtectionToggle: () => void;
  onIgnoreToggle: () => void;
  onDownloadClick: () => void;
  onRatingClick: () => void;
  onMarkDeleted: () => void;
  protectionLoading: boolean;
  markDeletedPending: boolean;
  isMobile: boolean;
  allowIgnore?: boolean;
}

function VideoActions({
  video,
  onDelete,
  onProtectionToggle,
  onIgnoreToggle,
  onDownloadClick,
  onRatingClick,
  onMarkDeleted,
  protectionLoading,
  markDeletedPending,
  isMobile,
  allowIgnore = true,
}: VideoActionsProps) {
  const isDownloadedAndPresent = video.isDownloaded && !isRemovedStatus(video.status);
  const showProtect = isDownloadedAndPresent;
  const showDownload = !isDownloadedAndPresent && video.status !== 'queued' && video.status !== 'downloading';
  const showIgnore = (!isDownloadedAndPresent || video.isIgnored) && allowIgnore;
  const showDelete = isDownloadedAndPresent;
  const showMarkDeleted = video.status === 'missing' && video.databaseId !== null;
  const mediaTypeInfo = getMediaTypeInfo(video.mediaType);
  const statusLabel = video.status === 'downloaded' ? 'Available' : getStatusLabel(video.status);
  const youtubeUrl = `${YOUTUBE_URL_BASE}${video.youtubeId}`;
  const useIconOnlyActions = isMobile;
  const compactChipStyle = {
    height: 'var(--video-modal-action-control-height, 28px)',
    fontSize: 'var(--ui-chip-small-font-size, 0.75rem)',
    paddingLeft: 8,
    paddingRight: 8,
    boxSizing: 'border-box',
  } as React.CSSProperties;
  const iconOnlyActionButtonStyle = {
    width: 'var(--video-modal-action-control-min-width, 28px)',
    minWidth: 'var(--video-modal-action-control-min-width, 28px)',
    height: 'var(--video-modal-action-control-height, 28px)',
    padding: 0,
    flexShrink: 0,
    boxSizing: 'border-box',
  } as React.CSSProperties;
  const labeledActionButtonStyle = {
    height: 'var(--video-modal-action-control-height, 28px)',
    minWidth: 'var(--video-modal-action-control-min-width, 28px)',
    paddingLeft: 'var(--video-modal-action-control-padding-x, 8px)',
    paddingRight: 'var(--video-modal-action-control-padding-x, 8px)',
    flexShrink: 0,
    boxSizing: 'border-box',
  } as React.CSSProperties;
  const actionButtonStyle = useIconOnlyActions ? iconOnlyActionButtonStyle : labeledActionButtonStyle;

  return (
    <Box
      style={{
        display: 'flex',
        // On a phone, a labeled button that does not fit moves to a second line instead of being cut off.
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        alignItems: 'center',
        gap: 'var(--video-modal-action-row-gap, 8px)',
        paddingTop: 'var(--video-modal-action-row-padding-y, 2px)',
        paddingBottom: 'var(--video-modal-action-row-padding-y, 2px)',
        width: '100%',
        minWidth: 0,
        overflowX: 'hidden',
      }}
    >
      <Chip
        icon={getStatusIcon(video.status)}
        label={statusLabel}
        color={getStatusColor(video.status)}
        variant={getStatusChipVariant(video.status)}
        size="small"
        style={{
          ...SHARED_THEMED_CHIP_STYLE,
          ...getStatusChipStyle(video.status),
          ...compactChipStyle,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      />

      {mediaTypeInfo && (
        <Chip
          label={mediaTypeInfo.label}
          color={mediaTypeInfo.color}
          size="small"
          icon={mediaTypeInfo.icon}
          variant="outlined"
          style={{
            ...SHARED_STATUS_CHIP_STYLE,
            ...compactChipStyle,
            flexShrink: 0,
          }}
        />
      )}

      <Box
        style={{
          width: '1px',
          height: 24,
          backgroundColor: 'var(--video-modal-action-divider, var(--border))',
          marginLeft: 1,
          marginRight: 1,
          flexShrink: 0,
        }}
      />

      <RatingBadge
        rating={video.normalizedRating}
        ratingSource={video.ratingSource}
        showNA
        ariaLabel="Change rating"
        onClick={onRatingClick}
        size="small"
        style={{
          height: 'var(--video-modal-action-control-height, 28px)',
          boxSizing: 'border-box',
        }}
      />

      {showDownload && (
        <Tooltip title="Download video">
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={onDownloadClick}
            aria-label="Download video"
            startIcon={useIconOnlyActions ? undefined : <DownloadIcon size={16} />}
            style={actionButtonStyle}
          >
            {useIconOnlyActions ? <DownloadIcon size={16} /> : 'Download'}
          </Button>
        </Tooltip>
      )}

      {showProtect && (
        <Tooltip title={video.isProtected ? 'Remove protection' : 'Protect from auto-deletion'}>
          <Button
            size="small"
            variant={video.isProtected ? 'contained' : 'outlined'}
            color={video.isProtected ? 'primary' : 'inherit'}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (!protectionLoading) {
                onProtectionToggle();
              }
            }}
            disabled={protectionLoading}
            aria-label={video.isProtected ? 'Remove protection' : 'Protect from auto-deletion'}
            startIcon={useIconOnlyActions ? undefined : (video.isProtected ? <ShieldIcon size={16} /> : <ShieldOutlinedIcon size={16} />)}
            style={actionButtonStyle}
          >
            {useIconOnlyActions
              ? (video.isProtected ? <ShieldIcon size={16} /> : <ShieldOutlinedIcon size={16} />)
              : (video.isProtected ? 'Protected' : 'Protect')}
          </Button>
        </Tooltip>
      )}

      {showIgnore && (
        <Tooltip title={video.isIgnored ? 'Unignore' : 'Ignore'}>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={onIgnoreToggle}
            aria-label={video.isIgnored ? 'Unignore' : 'Ignore'}
            startIcon={useIconOnlyActions ? undefined : (video.isIgnored ? <VisibilityIcon size={16} /> : <BlockIcon size={16} />)}
            style={actionButtonStyle}
          >
            {useIconOnlyActions
              ? (video.isIgnored ? <VisibilityIcon size={16} /> : <BlockIcon size={16} />)
              : (video.isIgnored ? 'Unignore' : 'Ignore')}
          </Button>
        </Tooltip>
      )}

      <Tooltip title="Open in YouTube">
        <Button
          asChild
          size="small"
          variant="outlined"
          color="inherit"
          style={actionButtonStyle}
        >
          <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in YouTube">
            {useIconOnlyActions ? <YoutubeIcon size={18} /> : 'Open in'}
            {!useIconOnlyActions && <YoutubeIcon size={18} />}
          </a>
        </Button>
      </Tooltip>

      <Box style={{ flex: 1, minWidth: isMobile ? 0 : 12 }} />

      {showMarkDeleted && (
        // Labeled even on a phone: it acts on the first tap, and its icon alone does not say what it does.
        <Tooltip title="The file is really gone: hide this video from the Videos page by default">
          <Button
            size="small"
            variant="outlined"
            color="warning"
            onClick={onMarkDeleted}
            disabled={markDeletedPending}
            aria-label="Mark as deleted"
            startIcon={<MarkDeletedIcon size={16} />}
            style={labeledActionButtonStyle}
          >
            Mark as deleted
          </Button>
        </Tooltip>
      )}

      {showDelete && (
        <Tooltip title="Delete video">
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={onDelete}
            aria-label="Delete video"
            startIcon={useIconOnlyActions ? undefined : <DeleteIcon size={16} />}
            style={actionButtonStyle}
          >
            {useIconOnlyActions ? <DeleteIcon size={16} /> : 'Delete'}
          </Button>
        </Tooltip>
      )}
    </Box>
  );
}

export default VideoActions;
