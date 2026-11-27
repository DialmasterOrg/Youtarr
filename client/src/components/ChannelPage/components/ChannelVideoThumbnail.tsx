import React from 'react';
import { Checkbox, Tooltip } from '../../ui';
import { Block as BlockIcon, CheckCircleOutline as CheckCircleOutlineIcon, Delete as DeleteIcon } from '../../../lib/icons';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { decodeHtml } from '../../../utils/formatters';
import ProtectionShieldButton from '../../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../../shared/ThumbnailClickOverlay';
import { DurationBadge, YoutubeRemovedBanner } from '../../shared/thumbnailOverlays';
import StillLiveDot from '../StillLiveDot';
import { ChannelVideoRowState } from '../channelVideoRowState';

interface ChannelVideoThumbnailProps {
  video: ChannelVideo;
  row: ChannelVideoRowState;
  // 'card' fills the top of a grid card; 'row' is the fixed box of a list row.
  size: 'card' | 'row';
  isMobile: boolean;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onToggleProtection: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
  onVideoClick?: (video: ChannelVideo) => void;
}

// Distances from the thumbnail's edges, and icon sizes, in pixels.
const LAYOUTS = {
  card: { corner: 8, liveDot: 8, checkbox: 4, shield: 6, icon: 16 },
  row: { corner: 2, liveDot: 4, checkbox: 2, shield: 3, icon: 18 },
};

const SELECTION_TINT: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

// A channel video's thumbnail with everything drawn over it: the selection
// checkbox and tints, the live dot, the ignore button and the protection shield.
function ChannelVideoThumbnail({
  video,
  row,
  size,
  isMobile,
  onCheckChange,
  onDeletionChange,
  onToggleIgnore,
  onToggleProtection,
  onMobileTooltip,
  onVideoClick,
}: ChannelVideoThumbnailProps) {
  const { isStillLive, canDownload, canDelete, isChecked, isDeleteChecked, isDeleteHeld } = row;
  const isCard = size === 'card';
  const layout = LAYOUTS[size];
  const isIgnored = row.status === 'ignored';
  const radius = isCard ? 'var(--radius-ui)' : 'var(--radius-thumb)';
  const box: React.CSSProperties = isCard
    ? { paddingTop: isMobile ? '52%' : '56.25%' }
    : { width: 120, minWidth: 120, height: 90, alignSelf: 'center' };

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: 'var(--media-placeholder-background)',
        borderRadius: radius,
        overflow: 'hidden',
        ...box,
      }}
    >
      <img
        src={video.thumbnail}
        alt={decodeHtml(video.title)}
        loading="lazy"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          // Shorts use contain to show the full portrait thumbnail with black bars.
          objectFit: video.media_type === 'short' ? 'contain' : 'cover',
          borderRadius: radius,
        }}
      />
      {onVideoClick && (
        <ThumbnailClickOverlay
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onVideoClick(video);
          }}
        />
      )}
      {video.youtube_removed && <YoutubeRemovedBanner compact={!isCard} />}
      {/* The channel listing reports no duration for shorts. */}
      {video.media_type !== 'short' && <DurationBadge duration={video.duration} compact={!isCard} />}

      {(canDownload || canDelete) && (
        <Checkbox
          checked={canDownload ? isChecked : isDeleteChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => (canDownload ? onCheckChange : onDeletionChange)(video.youtube_id, e.target.checked)}
          style={{
            position: 'absolute',
            top: layout.checkbox,
            left: layout.checkbox,
            backgroundColor: 'var(--media-overlay-background)',
            color: 'var(--media-overlay-foreground)',
            transition: 'all 0.2s',
            zIndex: 3,
          }}
        />
      )}

      {isStillLive && (
        <div style={{ position: 'absolute', top: layout.liveDot, left: layout.liveDot, zIndex: 2 }}>
          <StillLiveDot isMobile={isMobile || !isCard} onMobileClick={onMobileTooltip} />
        </div>
      )}
      {canDownload && isChecked && (
        <div style={{ ...SELECTION_TINT, backgroundColor: 'var(--media-overlay-selection-background)' }} />
      )}
      {canDelete && isDeleteChecked && (
        <div style={{ ...SELECTION_TINT, backgroundColor: 'var(--media-overlay-delete-selection-background)' }} />
      )}
      {isDeleteHeld && (
        <div
          style={{
            position: 'absolute',
            top: layout.corner,
            left: layout.corner,
            color: 'var(--media-overlay-foreground)',
            backgroundColor: 'var(--media-overlay-delete-indicator-background)',
            padding: 4,
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <DeleteIcon size={layout.icon} data-testid="DeleteIcon" />
        </div>
      )}

      {/* Ignoring applies to videos with no file on disk: never downloaded, missing or deleted. */}
      {!isStillLive && (!video.added || video.removed) && (
        <Tooltip
          title={isIgnored ? 'Click to unignore (allow auto-downloads)' : 'Click to ignore (prevent auto-downloads)'}
          arrow
          placement="top"
        >
          <button
            aria-label={isIgnored ? 'Click to unignore' : 'Click to ignore'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleIgnore(video.youtube_id);
            }}
            style={{
              position: 'absolute',
              top: layout.corner,
              right: layout.corner,
              background: isIgnored ? 'var(--warning)' : 'var(--media-overlay-ignore-button-background)',
              color: 'var(--media-overlay-foreground)',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'all 0.2s',
              zIndex: 3,
            }}
          >
            {isIgnored
              ? <CheckCircleOutlineIcon size={layout.icon} data-testid="CheckCircleOutlineIcon" />
              : <BlockIcon size={layout.icon} data-testid="BlockIcon" />}
          </button>
        </Tooltip>
      )}

      {video.added && !video.removed && (
        <ProtectionShieldButton
          isProtected={video.protected || false}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onToggleProtection(video.youtube_id);
          }}
          size={isCard ? undefined : 'small'}
          style={{ position: 'absolute', bottom: layout.shield, left: layout.shield, zIndex: 2 }}
        />
      )}
    </div>
  );
}

export default ChannelVideoThumbnail;
