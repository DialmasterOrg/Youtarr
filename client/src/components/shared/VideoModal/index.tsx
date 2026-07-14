import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContentBody,
  Box,
  Typography,
  IconButton,
  Snackbar,
  Alert,
} from '../../ui';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { ChevronLeft as ArrowBackIcon } from '../../../lib/icons';
import VideoPlayer from './components/VideoPlayer';
import VideoMetadata from './components/VideoMetadata';
import VideoActions from './components/VideoActions';
import VideoTechnical from './components/VideoTechnical';
import { useVideoMetadata } from './hooks/useVideoMetadata';
import { useVideoModalActions } from './hooks/useVideoModalActions';
import { VideoModalProps } from './types';
import DeleteVideosDialog from '../DeleteVideosDialog';
import ChangeRatingDialog from '../ChangeRatingDialog';
import AddChannelDialog from '../AddChannelDialog';
import DownloadSettingsDialog from '../../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { useConfig } from '../../../hooks/useConfig';
import { uploadDateToIso } from '../../../utils/formatters';

const SNACKBAR_AUTO_HIDE_MS = 4000;

function VideoModal({
  open,
  onClose,
  video,
  token,
  onVideoDeleted,
  onProtectionChanged,
  onIgnoreChanged,
  onDownloadQueued,
  onRatingChanged,
  onAvailabilityDetected,
  onPublishedDateDetected,
  allowIgnore,
}: VideoModalProps) {
  const isMobile = useMediaQuery('(max-width: 599px)');

  const {
    localVideo,
    snackbar,
    deleteDialogOpen,
    downloadDialogOpen,
    ratingDialogOpen,
    protectionLoading,
    setDeleteDialogOpen,
    setDownloadDialogOpen,
    setRatingDialogOpen,
    handleProtectionToggle,
    handleDeleteConfirm,
    handleIgnoreToggle,
    handleDownloadConfirm,
    handleRatingApply,
    handleSnackbarClose,
  } = useVideoModalActions({
    video,
    token,
    onVideoDeleted,
    onProtectionChanged,
    onIgnoreChanged,
    onDownloadQueued,
    onRatingChanged,
    onClose,
  });

  // Skip metadata fetch for members-only videos that we haven't downloaded -
  // yt-dlp cannot access them and the error just spams the server logs. For
  // already-downloaded members-only videos, the backend still serves cached
  // .info.json so we let the fetch proceed.
  const skipMetadataFetch = video.status === 'members_only' && !video.isDownloaded;
  const shouldFetchMetadata = open && !skipMetadataFetch;
  const { metadata, loading: metadataLoading } = useVideoMetadata(
    shouldFetchMetadata ? video.youtubeId : '',
    token
  );

  const { config } = useConfig(token);

  // Fetch channel-level download settings when modal opens
  interface ChannelSettings {
    video_quality?: string | null;
    audio_format?: string | null;
    default_rating?: string | null;
    enabled?: boolean;
  }
  const [channelSettings, setChannelSettings] = useState<ChannelSettings>({});
  type ChannelSubscription = 'subscribed' | 'unsubscribed' | 'unknown';
  const [channelSubscription, setChannelSubscription] = useState<ChannelSubscription>('unknown');
  const [addChannelOpen, setAddChannelOpen] = useState(false);

  useEffect(() => {
    if (!open || !video.channelId || !token) {
      setChannelSettings({});
      setChannelSubscription('unknown');
      return;
    }
    // Drop the previous channel's state so it cannot leak into this channel
    // while the fetch is in flight, or persist if the fetch fails non-404.
    setChannelSubscription('unknown');
    const controller = new AbortController();
    const fetchSettings = async () => {
      try {
        const resp = await axios.get<ChannelSettings>(
          `/api/channels/${video.channelId}/settings`,
          {
            headers: { 'x-access-token': token },
            signal: controller.signal,
          }
        );
        if (!controller.signal.aborted) {
          setChannelSettings(resp.data);
          setChannelSubscription(resp.data.enabled === true ? 'subscribed' : 'unsubscribed');
        }
      } catch (err: unknown) {
        // Request failed or was aborted; leave channelSettings at its last value.
        if (controller.signal.aborted) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setChannelSubscription('unsubscribed');
      }
    };
    fetchSettings();
    return () => { controller.abort(); };
  }, [open, video.channelId, token]);

  // Promote localVideo to members_only display when the metadata fetch detects
  // a members-only video. The backend stamps the channelvideos row in the same
  // request, so a second open would catch it via getVideoStatus, but on the
  // first open the prop's status is stale (still 'never_downloaded' or similar).
  // Deriving here keeps VideoPlayer/VideoActions in sync without round-tripping.
  const displayVideo = useMemo(() => {
    if (metadata?.availability === 'subscriber_only' && localVideo.status !== 'members_only') {
      return { ...localVideo, status: 'members_only' as const };
    }
    return localVideo;
  }, [localVideo, metadata?.availability]);

  // Notify the parent the first time we promote a video to members_only, so
  // list pages that read availability (e.g. ChannelVideos via getVideoStatus)
  // can update without a manual refresh. Keyed on youtubeId so we fire once
  // per video and re-arm when the modal switches to a different one.
  const promotedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      metadata?.availability === 'subscriber_only' &&
      localVideo.status !== 'members_only' &&
      promotedForRef.current !== video.youtubeId
    ) {
      promotedForRef.current = video.youtubeId;
      onAvailabilityDetected?.(video.youtubeId, 'subscriber_only');
    }
  }, [metadata?.availability, localVideo.status, video.youtubeId, onAvailabilityDetected]);

  // Notify the parent the first time the metadata fetch yields an authoritative
  // upload date (from the .info.json), so list pages can replace an estimated or
  // approximate date with the exact one without a manual refresh. The backend
  // stamps the channelvideos row in the same request; this just keeps the
  // already-rendered list in sync. Keyed on youtubeId so it fires once per video
  // and re-arms when the modal switches videos.
  const datePropagatedForRef = useRef<string | null>(null);
  useEffect(() => {
    const uploadDate = metadata?.uploadDate;
    if (uploadDate && datePropagatedForRef.current !== video.youtubeId) {
      const isoDate = uploadDateToIso(uploadDate);
      if (isoDate) {
        datePropagatedForRef.current = video.youtubeId;
        onPublishedDateDetected?.(video.youtubeId, isoDate);
      }
    }
  }, [metadata?.uploadDate, video.youtubeId, onPublishedDateDetected]);

  const hasChannelQualityOverride = Boolean(channelSettings.video_quality);
  const defaultResolution = channelSettings.video_quality || config.preferredResolution || '1080';
  const defaultResolutionSource: 'channel' | 'global' = hasChannelQualityOverride ? 'channel' : 'global';
  const hasChannelAudioOverride = Boolean(channelSettings.audio_format);
  const defaultAudioFormat = channelSettings.audio_format || null;
  const defaultAudioFormatSource: 'channel' | 'global' = hasChannelAudioOverride ? 'channel' : 'global';

  const canAddChannel = channelSubscription === 'unsubscribed' && Boolean(video.channelId);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        {/* Header bar - title + close */}
        <DialogTitle onClose={!isMobile ? onClose : undefined}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              minWidth: 0,
            }}
          >
            {isMobile && (
              <IconButton
                onClick={onClose}
                size="large"
                aria-label="Close"
                edge="start"
              >
                <ArrowBackIcon size={24} />
              </IconButton>
            )}
            <Typography
              variant="h6"
              component="span"
              sx={{
                flex: 1,
                minWidth: 0,
                fontSize: isMobile ? '1rem' : '1.15rem',
                fontWeight: 600,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {displayVideo.title}
            </Typography>
          </span>
        </DialogTitle>
        <DialogContentBody
          style={{
            padding: isMobile
              ? 'var(--video-modal-content-padding-mobile, 8px)'
              : 'var(--video-modal-content-padding-desktop, 12px)',
          }}
        >
          <Box
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--video-modal-content-gap, 12px)',
              width: '100%',
              minWidth: 0,
            }}
          >
            <VideoPlayer
              video={displayVideo}
              token={token}
              onDownloadClick={() => setDownloadDialogOpen(true)}
              isMobile={isMobile}
            />
            <VideoActions
              video={displayVideo}
              onDelete={() => setDeleteDialogOpen(true)}
              onProtectionToggle={handleProtectionToggle}
              onIgnoreToggle={handleIgnoreToggle}
              onDownloadClick={() => setDownloadDialogOpen(true)}
              onRatingClick={() => setRatingDialogOpen(true)}
              protectionLoading={protectionLoading}
              isMobile={isMobile}
              allowIgnore={allowIgnore}
            />
            <VideoMetadata
              video={displayVideo}
              metadata={metadata}
              loading={metadataLoading}
              onAddChannel={canAddChannel ? () => setAddChannelOpen(true) : undefined}
            />
            <VideoTechnical
              video={displayVideo}
              metadata={metadata}
              loading={metadataLoading}
            />
          </Box>
        </DialogContentBody>
      </Dialog>

      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        videoCount={1}
      />

      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        onConfirm={handleDownloadConfirm}
        videoCount={1}
        missingVideoCount={displayVideo.status === 'missing' ? 1 : 0}
        mode="manual"
        token={token}
        defaultResolution={defaultResolution}
        defaultResolutionSource={defaultResolutionSource}
        defaultAudioFormat={defaultAudioFormat}
        defaultAudioFormatSource={defaultAudioFormatSource}
      />

      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={handleRatingApply}
        selectedCount={1}
      />

      {video.channelId && (
        <AddChannelDialog
          open={addChannelOpen}
          onClose={() => setAddChannelOpen(false)}
          channelName={displayVideo.channelName}
          channelUrl={`https://www.youtube.com/channel/${video.channelId}`}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={SNACKBAR_AUTO_HIDE_MS}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          className="w-full"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default VideoModal;
