import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  Divider,
  Paper,
  CircularProgress,
  Badge,
  Collapse
} from '@mui/material';
import { TransitionGroup } from 'react-transition-group';
import {
  Download as DownloadIcon,
  Clear as ClearIcon,
  PlaylistAdd as PlaylistAddIcon
} from '@mui/icons-material';
import axios from 'axios';
import UrlInput from './UrlInput';
import VideoChip from './VideoChip';
import DownloadSettingsDialog from './DownloadSettingsDialog';
import { VideoInfo, ValidationResponse, DownloadSettings } from './types';

interface ManualDownloadProps {
  onStartDownload: (urls: string[], settings?: DownloadSettings | null) => void;
  token: string | null;
  defaultResolution?: string;
}

const ManualDownload: React.FC<ManualDownloadProps> = ({ onStartDownload, token, defaultResolution = '1080' }) => {
  const [validatedVideos, setValidatedVideos] = useState<VideoInfo[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [previouslyDownloadedCount, setPreviouslyDownloadedCount] = useState(0);

  const validateUrl = useCallback(async (url: string): Promise<boolean> => {
    setIsValidating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await axios.post<ValidationResponse>(
        '/api/checkYoutubeVideoURL',
        { url },
        {
          headers: {
            'x-access-token': token || '',
          },
        }
      );
      const { data } = response;

      if (!data.isValidUrl) {
        setErrorMessage('Invalid YouTube URL. Please check the URL and try again.');
        return false;
      }

      if (data.isMembersOnly) {
        setErrorMessage('This video is members-only and cannot be downloaded.');
        return false;
      }

      // Don't block already downloaded videos, just mark them

      if (data.metadata) {
        const videoInfo: VideoInfo = {
          ...data.metadata,
          media_type: data.metadata.media_type || 'video',
          isAlreadyDownloaded: data.isAlreadyDownloaded || false,
          isMembersOnly: false  // Always false since we return early if true
        };

        const alreadyInList = validatedVideos.some(v => v.youtubeId === videoInfo.youtubeId);
        if (alreadyInList) {
          setErrorMessage('This video is already in your download list.');
          return false;
        }

        setValidatedVideos(prev => [...prev, videoInfo]);

        // Update count of previously downloaded videos
        if (videoInfo.isAlreadyDownloaded) {
          setPreviouslyDownloadedCount(prev => prev + 1);
          setSuccessMessage('Video added to download list (previously downloaded).');
        } else {
          setSuccessMessage('Video added to download list.');
        }
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error validating URL:', error);
      if (error.response?.status === 429) {
        setErrorMessage('Too many requests. Please wait a moment and try again.');
      } else if (error.response?.data?.error) {
        setErrorMessage(error.response.data.error);
      } else {
        setErrorMessage('Failed to validate URL. Please try again.');
      }
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [validatedVideos, token]);

  const handleRemoveVideo = useCallback((youtubeId: string) => {
    setValidatedVideos(prev => {
      const videoToRemove = prev.find(v => v.youtubeId === youtubeId);
      if (videoToRemove?.isAlreadyDownloaded) {
        setPreviouslyDownloadedCount(count => Math.max(0, count - 1));
      }
      return prev.filter(v => v.youtubeId !== youtubeId);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setValidatedVideos([]);
    setPreviouslyDownloadedCount(0);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (validatedVideos.length === 0) {
      setErrorMessage('No videos to download.');
      return;
    }

    setShowSettingsDialog(true);
  }, [validatedVideos]);

  const handleConfirmDownload = useCallback(async (settings: DownloadSettings | null) => {
    setShowSettingsDialog(false);

    setIsDownloading(true);
    try {
      const urls = validatedVideos.map(v => v.url);
      await onStartDownload(urls, settings);
      const videoCount = validatedVideos.length;
      setSuccessMessage(`Started downloading ${videoCount} video${videoCount !== 1 ? 's' : ''}.`);
      setValidatedVideos([]);
      setPreviouslyDownloadedCount(0);
    } catch (error) {
      console.error('Error starting download:', error);
      setErrorMessage('Failed to start download. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [validatedVideos, onStartDownload]);

  return (
    <Box>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaylistAddIcon />
          Add Videos to Download
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Paste YouTube video URLs to add to queue
        </Typography>
        <UrlInput
          onValidate={validateUrl}
          isValidating={isValidating}
          disabled={isDownloading}
        />
      </Paper>

      {validatedVideos.length > 0 && (
        <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              <Typography variant="h6">
                Download Queue
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {validatedVideos.length > 0
                  ? `${validatedVideos.length} video${validatedVideos.length !== 1 ? 's' : ''} to download`
                  : 'No videos in queue'}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={handleClearAll}
              startIcon={<ClearIcon />}
            >
              Clear All
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              mb: 2,
              maxHeight: 400,
              overflowY: 'auto'
            }}
          >
            <TransitionGroup
              style={{
                display: 'grid',
                gridTemplateColumns: window.innerWidth < 900 ? '1fr' : '1fr 1fr',
                gap: '8px'
              }}
            >
              {validatedVideos.map((video) => (
                <Collapse key={video.youtubeId} timeout={300}>
                  <VideoChip
                    video={video}
                    onDelete={handleRemoveVideo}
                  />
                </Collapse>
              ))}
            </TransitionGroup>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Badge
              badgeContent={validatedVideos.length}
              color="primary"
              data-testid="download-count-badge"
            >
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenSettings}
                disabled={validatedVideos.length === 0 || isDownloading}
                startIcon={isDownloading ? <CircularProgress size={20} /> : <DownloadIcon />}
              >
                {isDownloading ? 'Starting...' : 'Download Videos'}
              </Button>
            </Badge>
          </Box>
        </Paper>
      )}

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <DownloadSettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onConfirm={handleConfirmDownload}
        videoCount={validatedVideos.length}
        missingVideoCount={previouslyDownloadedCount}
        defaultResolution={defaultResolution}
        mode="manual"
        defaultResolutionSource="global"
      />
    </Box>
  );
};

export default ManualDownload;
