import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Grid,
  Card,
  CardHeader,
  Typography,
  LinearProgress,
  Box,
  Alert,
  AlertTitle,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import WebSocketContext from '../../contexts/WebSocketContext';

interface DownloadProgressProps {
  downloadProgressRef: React.MutableRefObject<{
    index: number | null;
    message: string;
  }>;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
}

interface ErrorDetails {
  message: string;
  code?: string;
}

interface ParsedProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  etaSeconds: number;
}

interface VideoInfo {
  channel: string;
  title: string;
  displayTitle: string;
}

interface StructuredProgress {
  jobId: string;
  progress: ParsedProgress;
  stalled: boolean;
  state?: string;
  videoInfo?: VideoInfo;
  downloadType?: string;
  currentChannelName?: string;
  videoCount?: { current: number; total: number; completed: number; skipped: number, skippedThisChannel: number };
}

interface FinalSummary {
  totalDownloaded: number;
  totalSkipped: number;
  jobType: string;
  completedAt?: string;
}

const DownloadProgress: React.FC<DownloadProgressProps> = ({
  downloadProgressRef,
  downloadInitiatedRef,
}) => {
  const [currentProgress, setCurrentProgress] = useState<StructuredProgress | null>(null);
  const [videoCount, setVideoCount] = useState<{ current: number; total: number; completed: number; skipped: number, skippedThisChannel: number }>({
    current: 0,
    total: 0,
    completed: 0,
    skipped: 0,
    skippedThisChannel: 0
  });
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const navigate = useNavigate();
  const wsContext = useContext(WebSocketContext);
  if (!wsContext) {
    throw new Error('WebSocketContext not found');
  }
  const { subscribe, unsubscribe } = wsContext;

  // Derive color from state
  const progressColor = useMemo(() => {
    if (!currentProgress) return '#9e9e9e';

    if (currentProgress.stalled) return '#ffca28'; // Yellow

    switch(currentProgress.state) {
      case 'initiating': return '#9e9e9e'; // Grey
      case 'complete': return '#66bb6a'; // Green
      case 'error': return '#ef5350'; // Red
      default: return '#42a5f5'; // Blue
    }
  }, [currentProgress]);

  const overlayTitle = useMemo(() => {
    if (!currentProgress) {
      return '';
    }
    // Don't show "Unknown title" - just show empty if no title
    const title = currentProgress.videoInfo?.displayTitle || '';
    if (title === 'Unknown title' || title === 'Unknown Title') {
      return '';
    }
    return title;
  }, [currentProgress]);

  // Derive status message from state
  const statusMessage = useMemo(() => {
    if (!currentProgress) return 'Initiating download...';

    if (currentProgress.stalled) return 'Download stalled - retrying...';

    switch(currentProgress.state) {
      case 'initiating': return 'Initiating download...';
      case 'downloading_video': return 'Downloading video stream...';
      case 'downloading_audio': return 'Downloading audio stream...';
      case 'downloading_thumbnail': return 'Downloading thumbnail...';
      case 'merging': return 'Merging formats...';
      case 'metadata': return 'Adding metadata...';
      case 'processing': return 'Processing file...';
      case 'complete': return 'Download completed';
      case 'error': return 'Download failed';
      default: return 'Processing...';
    }
  }, [currentProgress]);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format timestamp to 12-hour format
  const formatTimestamp = (isoString?: string): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    return date.toLocaleString('en-US', options);
  };

  const filter = useCallback((message: any) => {
    return (
      message.destination === 'broadcast' && message.type === 'downloadProgress'
    );
  }, []);

  const processMessagesCallback = useCallback(
    (payload: any) => {
      // Clear previous summary if explicitly requested
      if (payload.clearPreviousSummary) {
        setFinalSummary(null);
        setErrorDetails(null);
      }

      // Check for error messages, especially cookie-related
      if (payload.error || (payload.text && payload.text.includes('Bot detection encountered'))) {
        setErrorDetails({
          message: payload.text || 'Download failed',
          code: payload.errorCode
        });
        setShowProgress(false);
      }

      // Handle enhanced structured progress with video counts
      if (payload.progress) {
        const progress = payload.progress as StructuredProgress;
        setCurrentProgress(progress);
        setShowProgress(true);

        // Update video counts from the progress object (at payload level)
        if (payload.progress.videoCount) {
          setVideoCount({
            current: payload.progress.videoCount.current || 0,
            total: payload.progress.videoCount.total || 0,
            completed: payload.progress.videoCount.completed || 0,
            skipped: payload.progress.videoCount.skipped || 0,
            skippedThisChannel: payload.progress.videoCount.skippedThisChannel || 0
          });
        }

        // Clear any previous final summary when new download starts
        if (progress.state === 'initiating' || progress.state === 'downloading_video') {
          setFinalSummary(null);
          setErrorDetails(null);
        }

        // Handle completion or failure
        if (progress.state === 'complete') {
          // Clear progress after a delay to show final summary
          setTimeout(() => {
            setShowProgress(false);
            setCurrentProgress(null);
            setVideoCount({ current: 0, total: 0, completed: 0, skipped: 0, skippedThisChannel: 0 });
          }, 2000);
        } else if (progress.state === 'failed' || progress.state === 'error') {
          // Show error state
          setShowProgress(false);
          setCurrentProgress(null);
        }
      }

      // Handle final summary
      if (payload.finalSummary) {
        setFinalSummary(payload.finalSummary);
        // Summary will persist until next download starts
      }

      // Also check for video count info in text messages for backwards compatibility
      const line = payload.text?.trim();
      if (line) {
        // Check for playlist total count: "[youtube:tab] Playlist <name>: Downloading X items of Y"
        const playlistMatch = line.match(/\[youtube:tab\].*Downloading (\d+) items of (\d+)/);
        if (playlistMatch) {
          const total = parseInt(playlistMatch[2], 10);
          setVideoCount(prev => ({ ...prev, total }));
        }

        // Check for current item: "[download] Downloading item N of Y"
        const itemMatch = line.match(/\[download\] Downloading item (\d+) of (\d+)/);
        if (itemMatch) {
          const current = parseInt(itemMatch[1], 10);
          const total = parseInt(itemMatch[2], 10);
          setVideoCount(prev => ({ ...prev, current, total }));
        }

        // Don't override server-provided counts
        // Completion tracking is handled by the server now

        // Reset on new download session
        if ((line.includes('[youtube:tab] Extracting URL:') || line.includes('[youtube] Extracting URL:')) && downloadInitiatedRef.current) {
          setVideoCount({ current: 0, total: 0, completed: 0, skipped: 0, skippedThisChannel: 0 });
          setShowProgress(true);
          setFinalSummary(null);
          downloadInitiatedRef.current = false;
        }
      }
    },
    [downloadInitiatedRef]
  );

  useEffect(() => {
    subscribe(filter, processMessagesCallback);
    return () => {
      unsubscribe(processMessagesCallback);
    };
  }, [subscribe, unsubscribe, filter, processMessagesCallback]);

  return (
    <Grid item xs={12} md={12} paddingBottom={'8px'}>
      <Card elevation={8}>
        <CardHeader title='Download Progress' align='center' />

        {/* Show error if available */}
        {errorDetails && !currentProgress && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Alert
              severity="error"
              action={
                errorDetails.code === 'COOKIES_REQUIRED' || errorDetails.message.includes('Bot detection') ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate('/configuration')}
                  >
                    Go to Settings
                  </Button>
                ) : undefined
              }
            >
              <AlertTitle>Download Failed</AlertTitle>
              <Typography variant="body2">
                {errorDetails.message}
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Show final summary if available */}
        {finalSummary && !currentProgress && !errorDetails && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Box sx={{
              p: 1,
              backgroundColor: 'success.light',
              borderRadius: 1,
              textAlign: 'center'
            }}>
              <Typography variant="h6" color="success.contrastText">
                Summary of last job
              </Typography>
              <Typography variant="body1" color="success.contrastText">
                ✓ {(() => {
                  const parts = [];
                  parts.push(`${finalSummary.totalDownloaded} new video${finalSummary.totalDownloaded !== 1 ? 's' : ''} downloaded`);
                  if (finalSummary.totalSkipped > 0) {
                    parts.push(`${finalSummary.totalSkipped} already existed or members only`);
                  }
                  if (parts.length === 0) {
                    return 'No new videos downloaded';
                  }
                  return parts.join(', ');
                })()}
              </Typography>
              <Typography variant="caption" color="success.contrastText" sx={{ mt: 0.5, display: 'block' }}>
                {(() => {
                  const jobTypeLabel = finalSummary.jobType === 'Channel Downloads'
                    ? 'Channel update'
                    : finalSummary.jobType === 'Manually Added Urls'
                    ? 'Manual download'
                    : finalSummary.jobType;
                  return jobTypeLabel + (finalSummary.completedAt ? ` • Completed ${formatTimestamp(finalSummary.completedAt)}` : '');
                })()}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Show progress when active */}
        {currentProgress && showProgress && (
          <Box sx={{ px: 2, pb: 2 }}>
            {/* Thicker progress bar with overlay text */}
            <Box sx={{ position: 'relative', mb: 1 }}>
              <LinearProgress
                variant="determinate"
                value={currentProgress.progress.percent}
                sx={{
                  height: 32,
                  borderRadius: 1,
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: progressColor,
                    transition: 'background-color 0.3s ease'
                  }
                }}
              />

              {/* Overlay text centered on progress bar */}
              <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                px: 1
              }}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    color: currentProgress.progress.percent > 50 ? 'white' : 'black',
                    fontWeight: 'bold',
                    textShadow: currentProgress.progress.percent > 50 ?
                      '1px 1px 2px rgba(0,0,0,0.7)' :
                      '1px 1px 2px rgba(255,255,255,0.7)'
                  }}
                >
                  {overlayTitle}
                </Typography>
              </Box>
            </Box>

            {/* Status row below progress bar */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mt: 0.5
            }}>
              <Typography variant="caption" color="text.secondary">
                {statusMessage}
              </Typography>
              {currentProgress.progress && (
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(currentProgress.progress.speedBytesPerSecond)}/s •{' '}
                  {currentProgress.progress.percent.toFixed(1)}% •{' '}
                  {formatBytes(currentProgress.progress.downloadedBytes)} /{' '}
                  {formatBytes(currentProgress.progress.totalBytes)}
                </Typography>
              )}
            </Box>

            {/* Video count display with context */}
            {videoCount.total > 0 && (
              <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                mt: 1,
                p: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                borderRadius: 1
              }}>
                <Typography variant="body2" color="text.secondary">
                  {(() => {
                    const isChannelDownload = currentProgress.downloadType === 'Channel Downloads';

                    if (isChannelDownload) {
                      const channelName = currentProgress.currentChannelName || 'channels';
                      // Proper handling for when we are skipping all videos
                      const currentCount = videoCount.current - videoCount.skippedThisChannel > 0 ? videoCount.current - videoCount.skippedThisChannel : 0;
                      return `Downloading recent from all channels. Currently "${channelName}": ${currentCount} of ${videoCount.total}`;
                    } else {
                      return `Videos: ${videoCount.current} of ${videoCount.total}`;
                    }
                  })()}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Show placeholder when no activity */}
        {!currentProgress && !finalSummary && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Box sx={{
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
              borderTop: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="body2">
                No download activity at the moment
              </Typography>
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                Downloads will appear here when started
              </Typography>
            </Box>
          </Box>
        )}
      </Card>
    </Grid>
  );
};

export default DownloadProgress;
