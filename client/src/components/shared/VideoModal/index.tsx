import React, { useState, useEffect } from 'react';
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
import DownloadSettingsDialog from '../../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { useConfig } from '../../../hooks/useConfig';

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
  }
  const [channelSettings, setChannelSettings] = useState<ChannelSettings>({});

  useEffect(() => {
    if (!open || !video.channelId || !token) {
      setChannelSettings({});
      return;
    }
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
        }
      } catch {
        // Request failed or was aborted; leave channelSettings at its last value.
      }
    };
    fetchSettings();
    return () => { controller.abort(); };
  }, [open, video.channelId, token]);

  const hasChannelQualityOverride = Boolean(channelSettings.video_quality);
  const defaultResolution = channelSettings.video_quality || config.preferredResolution || '1080';
  const defaultResolutionSource: 'channel' | 'global' = hasChannelQualityOverride ? 'channel' : 'global';
  const hasChannelAudioOverride = Boolean(channelSettings.audio_format);
  const defaultAudioFormat = channelSettings.audio_format || null;
  const defaultAudioFormatSource: 'channel' | 'global' = hasChannelAudioOverride ? 'channel' : 'global';

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
              {localVideo.title}
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
              video={localVideo}
              token={token}
              onDownloadClick={() => setDownloadDialogOpen(true)}
              isMobile={isMobile}
            />
            <VideoActions
              video={localVideo}
              onDelete={() => setDeleteDialogOpen(true)}
              onProtectionToggle={handleProtectionToggle}
              onIgnoreToggle={handleIgnoreToggle}
              onDownloadClick={() => setDownloadDialogOpen(true)}
              onRatingClick={() => setRatingDialogOpen(true)}
              protectionLoading={protectionLoading}
              isMobile={isMobile}
            />
            <VideoMetadata
              video={localVideo}
              metadata={metadata}
              loading={metadataLoading}
            />
            <VideoTechnical
              video={localVideo}
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
        mode="manual"
        token={token}
        defaultResolution={defaultResolution}
        defaultResolutionSource={defaultResolutionSource}
        defaultAudioFormat={defaultAudioFormat}
        defaultAudioFormatSource={defaultAudioFormatSource}
        defaultRating={channelSettings.default_rating ?? null}
      />

      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={handleRatingApply}
        selectedCount={1}
      />

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
