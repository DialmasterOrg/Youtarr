import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
import { getStatusLabel, getStatusColor, getMediaTypeInfo } from '../../../utils/videoStatus';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

  const { metadata, loading: metadataLoading } = useVideoMetadata(
    open ? video.youtubeId : '',
    token
  );

  const isShort = localVideo.mediaType === 'short';
  const useSideBySide = isShort && !isMobile;
  const mediaTypeInfo = getMediaTypeInfo(localVideo.mediaType);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            ...(!isMobile && { maxHeight: '92vh', m: 1.5 }),
          },
        }}
      >
        {/* Header bar - title + close */}
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 1.5,
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {isMobile && (
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close"
              edge="start"
              sx={{ mr: 0.5 }}
            >
              <ArrowBackIcon />
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
          {!isMobile && (
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close"
              edge="end"
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>

        <DialogContent sx={{ p: isMobile ? 1.5 : 2 }}>
          {useSideBySide ? (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ width: 300, flexShrink: 0 }}>
                <VideoPlayer
                  video={localVideo}
                  token={token}
                  onDownloadClick={() => setDownloadDialogOpen(true)}
                  isMobile={isMobile}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <VideoActions
                  video={localVideo}
                  statusChip={{ label: getStatusLabel(localVideo.status), color: getStatusColor(localVideo.status) }}
                  mediaTypeChip={mediaTypeInfo}
                  onDelete={() => setDeleteDialogOpen(true)}
                  onProtectionToggle={handleProtectionToggle}
                  onIgnoreToggle={handleIgnoreToggle}
                  onRatingChange={() => setRatingDialogOpen(true)}
                  protectionLoading={protectionLoading}
                  isMobile={isMobile}
                />
                <Box sx={{ mt: 2 }}>
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
              </Box>
            </Box>
          ) : (
            <>
              <VideoPlayer
                video={localVideo}
                token={token}
                onDownloadClick={() => setDownloadDialogOpen(true)}
                isMobile={isMobile}
              />
              <Box sx={{ mt: 1.5 }}>
                <VideoActions
                  video={localVideo}
                  statusChip={{ label: getStatusLabel(localVideo.status), color: getStatusColor(localVideo.status) }}
                  mediaTypeChip={mediaTypeInfo}
                  onDelete={() => setDeleteDialogOpen(true)}
                  onProtectionToggle={handleProtectionToggle}
                  onIgnoreToggle={handleIgnoreToggle}
                  onRatingChange={() => setRatingDialogOpen(true)}
                  protectionLoading={protectionLoading}
                  isMobile={isMobile}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <VideoMetadata
                  video={localVideo}
                  metadata={metadata}
                  loading={metadataLoading}
                />
              </Box>
              <Box sx={{ mt: 2 }}>
                <VideoTechnical
                  video={localVideo}
                  metadata={metadata}
                  loading={metadataLoading}
                />
              </Box>
            </>
          )}
        </DialogContent>
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
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default VideoModal;
