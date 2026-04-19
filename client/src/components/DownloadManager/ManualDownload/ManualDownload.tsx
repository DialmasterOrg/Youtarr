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
} from '../../ui';
import { TransitionGroup } from 'react-transition-group';
import { useMediaQuery, breakpoints } from '../../../hooks/useMediaQuery';
import {
  Download as DownloadIcon,
  X as ClearIcon,
  ListPlus as PlaylistAddIcon
} from 'lucide-react';
import axios from 'axios';
import UrlInput from './UrlInput';
import VideoChip from './VideoChip';
import DownloadSettingsDialog from './DownloadSettingsDialog';
import BulkImportDialog from './BulkImportDialog';
import { VideoInfo, ValidationResponse, DownloadSettings } from './types';

const ENRICH_CHUNK_SIZE = 25;

interface EnrichedVideoMeta {
  title: string;
  channelName: string;
}

async function enrichBulkImports(
  ids: string[],
  token: string | null,
  onChunk: (chunk: Record<string, EnrichedVideoMeta>) => void
): Promise<void> {
  for (let i = 0; i < ids.length; i += ENRICH_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + ENRICH_CHUNK_SIZE);
    try {
      const { data } = await axios.post<{ enriched: Record<string, EnrichedVideoMeta> }>(
        '/api/bulkEnrichVideos',
        { ids: chunk },
        { headers: { 'x-access-token': token || '' } }
      );
      if (data?.enriched) onChunk(data.enriched);
    } catch (err) {
      console.error('Bulk enrichment chunk failed:', err);
    }
  }
}

interface ManualDownloadProps {
  onStartDownload: (urls: string[], settings?: DownloadSettings | null) => void;
  token: string | null;
  defaultResolution?: string;
}

const ManualDownload: React.FC<ManualDownloadProps> = ({ onStartDownload, token, defaultResolution = '1080' }) => {
  const isMobile = useMediaQuery(breakpoints.down('sm'));
  const [validatedVideos, setValidatedVideos] = useState<VideoInfo[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [previouslyDownloadedCount, setPreviouslyDownloadedCount] = useState(0);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [isEnrichingBulk, setIsEnrichingBulk] = useState(false);

  const handleBulkImport = useCallback((videos: VideoInfo[]) => {
    setValidatedVideos(prev => [...prev, ...videos]);
    setShowBulkImport(false);
    setSuccessMessage(`Added ${videos.length} URL${videos.length !== 1 ? 's' : ''} to download queue.`);

    const ids = videos.map(v => v.youtubeId).filter(Boolean);
    if (ids.length === 0) return;

    setIsEnrichingBulk(true);
    void enrichBulkImports(ids, token, (chunk) => {
      setValidatedVideos(prev => prev.map(v => {
        const meta = chunk[v.youtubeId];
        if (!meta || !v.isBulkImport) return v;
        return {
          ...v,
          videoTitle: meta.title || v.videoTitle,
          channelName: meta.channelName || v.channelName,
          isBulkImport: false,
        };
      }));
    }).finally(() => {
      setIsEnrichingBulk(false);
    });
  }, [token]);

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
      <Paper elevation={1} className="p-4 mb-4">
        <Typography variant="h6" gutterBottom className="flex items-center gap-2">
          <PlaylistAddIcon size={20} />
          Add Videos to Download
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mb-4">
          Paste YouTube video URLs to add to queue
        </Typography>
        <Box className="flex flex-col gap-4">
          <Box className="w-full">
            <UrlInput
              onValidate={validateUrl}
              isValidating={isValidating}
              disabled={isDownloading}
            />
          </Box>
          <Box className="flex justify-center">
            <Button
              variant="outlined"
              onClick={() => setShowBulkImport(true)}
              startIcon={<PlaylistAddIcon />}
              disabled={isDownloading}
              className="w-full md:w-[20vw]"
              sx={{ whiteSpace: 'nowrap', minHeight: 56 }}
            >
              Bulk Import
            </Button>
          </Box>
        </Box>
      </Paper>

      {validatedVideos.length > 0 && (
        <Paper elevation={1} className="p-4 mb-4">
          <Box className="flex justify-between items-center mb-4">
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
              className="text-foreground border-border hover:bg-muted hover:border-foreground hover:text-foreground"
            >
              Clear All
            </Button>
          </Box>

          <Divider className="mb-4" />

          <Box
            className="mb-4 max-h-[400px] overflow-y-auto"
          >
            <TransitionGroup
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: '12px'
              }}
            >
              {validatedVideos.map((video) => (
                <Collapse key={video.youtubeId} timeout={300}>
                  <VideoChip
                    video={video}
                    onDelete={handleRemoveVideo}
                    isEnriching={isEnrichingBulk}
                  />
                </Collapse>
              ))}
            </TransitionGroup>
          </Box>

          <Box className="flex justify-end gap-4">
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
                className="bg-primary text-primary-foreground hover:bg-primary/90"
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
        token={token}
      />

      <BulkImportDialog
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        existingVideoIds={new Set(validatedVideos.map(v => v.youtubeId))}
      />
    </Box>
  );
};

export default ManualDownload;
