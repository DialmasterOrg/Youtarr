import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Grid,
  Typography,
  LinearProgress,
  Box,
  Alert,
  AlertTitle,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from '../ui';
import { ChevronDown as ExpandMoreIcon, List as QueueIcon, PlaySquare as PlaylistPlayIcon, Square as StopIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebSocketContext from '../../contexts/WebSocketContext';
import { Job } from '../../types/Job';
import TerminateJobDialog from './TerminateJobDialog';

interface DownloadProgressProps {
  downloadProgressRef: React.MutableRefObject<{
    index: number | null;
    message: string;
  }>;
  downloadInitiatedRef: React.MutableRefObject<boolean>;
  pendingJobs: Job[];
  token: string | null;
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

interface FailedVideo {
  youtubeId: string;
  title: string;
  channel: string;
  error: string;
  url?: string;
}

interface FinalSummary {
  totalDownloaded: number;
  totalSkipped: number;
  totalFailed?: number;
  failedVideos?: FailedVideo[];
  jobType: string;
  completedAt?: string;
}

// Format ETA seconds to human readable format (e.g., "2m5s", "1h5m", "45s")
export const formatEta = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 && hours === 0) parts.push(`${secs}s`); // Only show seconds if no hours

  return parts.join('');
};

const DownloadProgress: React.FC<DownloadProgressProps> = ({
  downloadProgressRef,
  downloadInitiatedRef,
  pendingJobs,
  token,
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
  const [warningDetails, setWarningDetails] = useState<{ message: string; reason?: string } | null>(null);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const navigate = useNavigate();
  const wsContext = useContext(WebSocketContext);
  if (!wsContext) {
    throw new Error('WebSocketContext not found');
  }
  const { subscribe, unsubscribe } = wsContext;

  // Derive color from state (using CSS vars)
  const progressColor = useMemo(() => {
    if (!currentProgress) return 'var(--muted-foreground)';

    if (currentProgress.stalled) return 'hsl(var(--warning))';

    switch (currentProgress.state) {
      case 'initiating':
        return 'var(--muted-foreground)';
      case 'complete':
        return 'hsl(var(--success))';
      case 'terminated':
        return 'hsl(var(--warning))';
      case 'error':
        return 'hsl(var(--destructive))';
      default:
        return 'hsl(var(--primary))';
    }
  }, [currentProgress]);

  const overlayContent = useMemo(() => {
    if (!currentProgress) {
      return { title: '', eta: '' };
    }

    // Only hide video title when we're preparing the NEXT video (between videos)
    // All other states (subtitles, metadata processing) are for a specific video we already know
    const isPreparing = currentProgress.state === 'preparing';

    // Don't show "Unknown title" - just show empty if no title
    const title = currentProgress.videoInfo?.displayTitle || '';
    const displayTitle = (title === 'Unknown title' || title === 'Unknown Title' || isPreparing) ? '' : title;

    // Get ETA if available (hide during preparing and other non-download states)
    const showEta =
      currentProgress.state === 'downloading_video' ||
      currentProgress.state === 'downloading_audio' ||
      currentProgress.state === 'downloading_subtitles';
    const eta = currentProgress.progress?.etaSeconds;
    const formattedEta = showEta ? formatEta(eta || 0) : '';

    return {
      title: displayTitle,
      eta: formattedEta
    };
  }, [currentProgress]);

  const overlayTextColor = useMemo(() => {
    const percent = currentProgress?.progress?.percent ?? 0;
    return percent > 50 ? '#ffffff' : 'var(--foreground)';
  }, [currentProgress?.progress?.percent]);

  const overlayTextShadow = useMemo(
    () =>
      overlayTextColor === '#ffffff'
        ? '1px 1px 2px rgba(0, 0, 0, 0.55)'
        : '1px 1px 2px rgba(255, 255, 255, 0.65)',
    [overlayTextColor]
  );

  // Derive status message from state
  const statusMessage = useMemo(() => {
    if (!currentProgress) return 'Initiating download...';

    if (currentProgress.stalled) return 'Download stalled - retrying...';

    switch(currentProgress.state) {
      case 'initiating': return 'Initiating download...';
      case 'preparing': return 'Preparing next video...';
      case 'preparing_subtitles': return 'Preparing subtitles...';
      case 'downloading_subtitles': return 'Downloading subtitles...';
      case 'downloading_video': return 'Downloading video stream...';
      case 'downloading_audio': return 'Downloading audio stream...';
      case 'downloading_thumbnail': return 'Downloading thumbnail...';
      case 'processing_metadata': return 'Processing metadata...';
      case 'merging': return 'Merging formats...';
      case 'metadata': return 'Adding metadata...';
      case 'processing': return 'Processing file...';
      case 'complete': return 'Download completed';
      case 'terminated': return 'Download terminated';
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

  const handleTerminate = async () => {
    setIsTerminating(true);
    try {
      const response = await fetch('/api/jobs/terminate', {
        method: 'POST',
        headers: {
          'x-access-token': token || '',
        },
      });

      if (response.ok) {
        // Success - job will update via WebSocket
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to terminate job');
      }
    } catch (error) {
      console.error('Error terminating job:', error);
      alert('Error terminating job');
    } finally {
      setIsTerminating(false);
      setShowTerminateDialog(false);
    }
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
        setWarningDetails(null);
      }

      // Check for warning messages (terminated downloads)
      if (payload.warning && payload.terminationReason) {
        setWarningDetails({
          message: payload.text || 'Download terminated',
          reason: payload.terminationReason
        });
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
          setWarningDetails(null);
        }

        // Handle completion or failure
        if (progress.state === 'complete') {
          // Clear progress after a delay to show final summary
          setTimeout(() => {
            setShowProgress(false);
            setCurrentProgress(null);
            setVideoCount({ current: 0, total: 0, completed: 0, skipped: 0, skippedThisChannel: 0 });
          }, 2000);
        } else if (progress.state === 'warning') {
          // Clear progress after a delay to show final summary with warnings
          setTimeout(() => {
            setShowProgress(false);
            setCurrentProgress(null);
            setVideoCount({ current: 0, total: 0, completed: 0, skipped: 0, skippedThisChannel: 0 });
          }, 2000);
        } else if (progress.state === 'terminated') {
          // Clear progress after a delay to show final state and allow summary to display
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

  // Determine if terminate button should be shown
  const showTerminateButton = currentProgress &&
                               showProgress &&
                               currentProgress.state !== 'complete' &&
                               currentProgress.state !== 'terminated' &&
                               currentProgress.state !== 'error' &&
                               currentProgress.state !== 'failed';

  return (
    <Grid item xs={12} md={12} paddingBottom={'8px'}>
      <Box>
        <Box className="flex items-center justify-center relative py-4 px-4 border-b border-border">
          <Typography variant="h6" component="h2" className="text-center">
            Download Progress
          </Typography>
          {showTerminateButton && (
            <Box style={{ position: 'absolute', right: 16 }}>
              <Tooltip title="Stop the current download job">
                <Button
                  onClick={() => setShowTerminateDialog(true)}
                  disabled={isTerminating}
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<StopIcon />}
                  className="min-w-auto sm:min-w-[120px] px-2 sm:px-4"
                >
                  <Box component="span" className="hidden sm:inline">
                    Stop Job
                  </Box>
                </Button>
              </Tooltip>
            </Box>
          )}
        </Box>

        {/* Show queued jobs if any */}
        {pendingJobs.length > 0 && (
          <Box className="px-4 pb-2">
            <Accordion
              elevation={0}
              className="bg-muted/50 rounded-[var(--radius-ui)]"
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                className="min-h-[42px]"
              >
                <QueueIcon size={16} className="text-muted-foreground" />
                <Typography variant="body2" color="text.secondary">
                  {pendingJobs.length} {pendingJobs.length === 1 ? 'job' : 'jobs'} queued
                </Typography>
              </AccordionSummary>
              <AccordionDetails className="pt-0 pb-3">
                <Box className="flex flex-wrap gap-2">
                  {pendingJobs.map((job, index) => {
                    const isChannelDownload = job.jobType.includes('Channel Downloads');
                    const label = isChannelDownload ? 'Channel Update' : 'Manual Download';
                    const icon = isChannelDownload ?
                      <PlaylistPlayIcon size={16} /> :
                      <QueueIcon size={16} />;

                    return (
                      <Chip
                        key={job.id}
                        icon={icon}
                        label={`${index + 1}. ${label}`}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    );
                  })}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Show error if available */}
        {errorDetails && !currentProgress && (
          <Box className="px-4 pb-4">
            <Alert
              severity="error"
              action={
                errorDetails.code === 'COOKIES_REQUIRED' ||
                errorDetails.code === 'COOKIES_RECOMMENDED' ||
                errorDetails.message.includes('Bot detection') ||
                errorDetails.message.toLowerCase().includes('cookie') ? (
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate('/settings')}
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

        {/* Show warning if available (terminated downloads) */}
        {warningDetails && !currentProgress && !errorDetails && (
          <Box className="px-4 pb-4">
            <Alert severity="warning">
              <AlertTitle>Download Terminated</AlertTitle>
              <Typography variant="body2">
                {warningDetails.reason || warningDetails.message}
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Show final summary if available */}
        {finalSummary && !currentProgress && !errorDetails && (
          <Box className="px-4 pb-4">
            <Box className={`p-2 rounded-[var(--radius-ui)] text-center ${(finalSummary.totalFailed && finalSummary.totalFailed > 0) ? 'bg-warning/10' : 'bg-success/10'}`}>
              <Typography variant="h6" className={(finalSummary.totalFailed && finalSummary.totalFailed > 0) ? 'text-warning-foreground' : 'text-success-foreground'}>
                Summary of last job
              </Typography>
              <Typography variant="body1" className={(finalSummary.totalFailed && finalSummary.totalFailed > 0) ? 'text-warning-foreground' : 'text-success-foreground'}>
                {(() => {
                  const parts: string[] = [];
                  if (finalSummary.totalDownloaded > 0) {
                    parts.push(`✓ ${finalSummary.totalDownloaded} video${finalSummary.totalDownloaded !== 1 ? 's' : ''} downloaded`);
                  }
                  if (finalSummary.totalFailed && finalSummary.totalFailed > 0) {
                    parts.push(`✗ ${finalSummary.totalFailed} failed`);
                  }
                  if (finalSummary.totalSkipped > 0) {
                    parts.push(`${finalSummary.totalSkipped} skipped (already downloaded or filtered)`);
                  }
                  if (parts.length === 0) {
                    return 'No new videos downloaded';
                  }
                  return parts.join(', ');
                })()}
              </Typography>
              <Typography variant="caption" className={`mt-1 block ${(finalSummary.totalFailed && finalSummary.totalFailed > 0) ? 'text-warning-foreground' : 'text-success-foreground'}`}>
                {(() => {
                  let jobTypeLabel: string;
                  if (finalSummary.jobType.includes('Channel Downloads')) {
                    jobTypeLabel = 'Channel update';
                  } else if (finalSummary.jobType.includes('Manually Added Urls')) {
                    const apiKeyMatch = finalSummary.jobType.match(/\(via API: (.+)\)/);
                    jobTypeLabel = apiKeyMatch ? `API: ${apiKeyMatch[1]}` : 'Manual download';
                  } else {
                    jobTypeLabel = finalSummary.jobType;
                  }
                  return jobTypeLabel + (finalSummary.completedAt ? ` • Completed ${formatTimestamp(finalSummary.completedAt)}` : '');
                })()}
              </Typography>
            </Box>

            {/* Show details of failed videos if any */}
            {finalSummary.failedVideos && finalSummary.failedVideos.length > 0 && (
              <Box className="mt-4">
                <Alert severity="error">
                  <AlertTitle>Failed Downloads</AlertTitle>
                  {(() => {
                    // Group videos by error message
                    const errorGroups = new Map<string, FailedVideo[]>();
                    finalSummary.failedVideos.forEach(video => {
                      const existing = errorGroups.get(video.error) || [];
                      existing.push(video);
                      errorGroups.set(video.error, existing);
                    });

                    return Array.from(errorGroups.entries()).map(([error, videos], groupIndex) => (
                      <Box key={groupIndex} className={groupIndex > 0 ? 'mt-3' : ''}>
                        <Typography variant="body2" component="div" className="font-bold">
                          {videos.length} video{videos.length !== 1 ? 's' : ''} failed:
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div" className="mt-1">
                          {error}
                        </Typography>

                        {/* Only show individual video details if titles are known */}
                        {videos.some(v => v.title !== 'Unknown') && (
                          <Box className="mt-2 pl-4">
                            {videos
                              .filter(v => v.title !== 'Unknown')
                              .map((video, index) => (
                                <Typography key={video.youtubeId || index} variant="caption" component="div" color="text.secondary">
                                  • {video.title}
                                  {video.channel && video.channel !== 'Unknown' && ` by ${video.channel}`}
                                </Typography>
                              ))}
                          </Box>
                        )}
                      </Box>
                    ));
                  })()}
                </Alert>
              </Box>
            )}
          </Box>
        )}

        {/* Show progress when active */}
        {currentProgress && showProgress && (
          <Box className="px-4 pb-4">
            {/* Thicker progress bar with overlay text */}
            <Box className="relative mb-2">
              <LinearProgress
                variant={
                  // Show determinate for actual downloads (video, audio, subtitles)
                  // Show indeterminate for processing stages without progress data
                  currentProgress.state === 'merging' ||
                  currentProgress.state === 'metadata' ||
                  currentProgress.state === 'processing' ||
                  currentProgress.state === 'preparing' ||
                  currentProgress.state === 'preparing_subtitles' ||
                  currentProgress.state === 'processing_metadata'
                    ? 'indeterminate'
                    : 'determinate'
                }
                value={currentProgress.progress?.percent ?? 0}
                height={32}
                barColor={progressColor}
                className="shadow-sm"
              />

              {/* Overlay text centered on progress bar */}
              <Box className="absolute inset-0 flex items-center justify-center px-2">
                <Box className="flex items-center gap-1 max-w-full overflow-hidden">
                  {overlayContent.title && (
                    <Typography
                      variant="body2"
                      noWrap
                      style={{ flex: 1, minWidth: 0, color: overlayTextColor, fontWeight: 'bold', textShadow: overlayTextShadow }}
                    >
                      {overlayContent.title}
                    </Typography>
                  )}
                  {overlayContent.eta && (
                    <Typography
                      variant="body2"
                      style={{ flexShrink: 0, whiteSpace: 'nowrap', color: overlayTextColor, fontWeight: 'bold', textShadow: overlayTextShadow }}
                    >
                      {overlayContent.title ? `· ETA ${overlayContent.eta}` : `ETA ${overlayContent.eta}`}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Status row below progress bar */}
            <Box className="flex justify-between items-center mt-1">
              <Typography variant="caption" color="text.secondary">
                {statusMessage}
              </Typography>
              {/* Show progress details for actual downloads (video, audio, subtitles) */}
              {currentProgress.progress &&
               (currentProgress.state === 'downloading_video' ||
                currentProgress.state === 'downloading_audio' ||
                currentProgress.state === 'downloading_subtitles') && (
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(currentProgress.progress?.speedBytesPerSecond ?? 0)}/s •{' '}
                  {(currentProgress.progress?.percent ?? 0).toFixed(1)}% •{' '}
                  {formatBytes(currentProgress.progress?.downloadedBytes ?? 0)} /{' '}
                  {formatBytes(currentProgress.progress?.totalBytes ?? 0)}
                </Typography>
              )}
            </Box>

            {/* Video count display with context */}
            {videoCount.total > 0 && (
              <Box className="flex justify-center items-center mt-2 px-[5px] py-[3px] bg-card border border-border rounded-[var(--radius-ui)] shadow-sm">
                <Typography variant="body2" className="font-semibold">
                  {(() => {
                    const isChannelDownload = currentProgress.downloadType?.includes('Channel Downloads');

                    if (isChannelDownload) {
                      const channelName = currentProgress.currentChannelName || 'channels';
                      // Don't show the count, the user can see the videos downloading in the progress bar.
                      return `Downloading recent from all channels. Currently "${channelName}"`;
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
          <Box className="px-4 pb-4">
            <Box className="p-6 text-center text-muted-foreground border-t border-border">
              <Typography variant="body2">
                No download activity at the moment
              </Typography>
              <Typography variant="caption" className="mt-2 block">
                Downloads will appear here when started
              </Typography>
            </Box>
          </Box>
        )}

        {/* Terminate Job Dialog */}
        <TerminateJobDialog
          open={showTerminateDialog}
          onClose={() => setShowTerminateDialog(false)}
          onConfirm={handleTerminate}
        />
      </Box>
    </Grid>
  );
};

export default DownloadProgress;
