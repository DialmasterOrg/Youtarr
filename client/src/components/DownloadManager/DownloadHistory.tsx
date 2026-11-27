import React, { useMemo, useRef, useState } from 'react';
import VideoActivityChip from '../shared/VideoActivityChip';
import {
  Grid,
  Table,
  TableContainer,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Typography,
  IconButton,
  Checkbox,
  Toolbar,
  FormControlLabel,
  Box,
  Collapse,
  Link,
  Card,
  CardHeader,
  CardContent,
} from '../ui';
import { ChevronDown as ExpandMoreIcon, ChevronUp as ExpandLessIcon } from 'lucide-react';
import { Job, FailedVideo } from '../../types/Job';
import { VideoData } from '../../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import { useConfig } from '../../hooks/useConfig';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import PageControls from '../shared/PageControls';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import VideoThumbnail from './VideoThumbnail';
import AvailabilityChip from '../shared/AvailabilityChip';
import { getRemovalState, removalFromRow, removedState } from '../../utils/videoRemoval';
import RemovalDescription from '../shared/RemovalDescription';
import FailedVideoChip from './FailedVideoChip';
import FailedDownloadsDetail from './FailedDownloadsDetail';
import { isArrBridgeJob, jobTypeLabel } from '../../utils/jobTypeLabel';

interface DownloadHistoryProps {
  jobs: Job[];
  currentTime: Date;
  expanded: Record<string, boolean>;
  handleExpandCell: (id: string) => void;
  isMobile: boolean;
  token?: string | null;
  onVideoDeleted?: () => void;
}

const ARR_BRIDGE_HISTORY_LABEL = 'Sonarr/Radarr';
const HIDE_ARR_BRIDGE_STORAGE_KEY = 'youtarr:downloadHistoryHideArrBridge';

function readHideArrBridgeJobs(): boolean {
  try {
    return localStorage.getItem(HIDE_ARR_BRIDGE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function cleanJobTypeLabel(jobType: string): string {
  if (jobType.startsWith('Playlist Retry: ')) return jobTypeLabel(jobType);
  if (jobType.startsWith('Auto-retry')) return 'Auto-retry';
  if (jobType.includes('Channel Downloads')) return 'Channel Downloads';
  if (isArrBridgeJob(jobType)) return ARR_BRIDGE_HISTORY_LABEL;
  if (jobType.includes('Manually Added Urls')) {
    const apiKeyMatch = jobType.match(/\(via API: (.+)\)/);
    return apiKeyMatch ? `Manual Videos (API: ${apiKeyMatch[1]})` : 'Manual Videos';
  }
  return jobType;
}

// Failures handed off to an auto-retry job report their final outcome on the
// retry job's row; showing them here too would double-count them.
function getDisplayableFailedVideos(job: Job): FailedVideo[] {
  return (job.data?.failedVideos || []).filter((video) => !video.autoRetryQueued);
}

function getDiagnosisTitles(job: Job): string[] {
  return (job.data?.diagnoses || []).map((diagnosis) => diagnosis.title);
}

// The short source name for a job row; cleanJobTypeLabel gives the fuller one.
function shortJobTypeLabel(jobType: string): string {
  if (jobType.startsWith('Auto-retry')) return 'Auto-retry';
  if (jobType.startsWith('Playlist Retry: ')) return 'Playlist retries';
  if (jobType.includes('Channel Downloads')) return 'Channels';
  if (isArrBridgeJob(jobType)) return ARR_BRIDGE_HISTORY_LABEL;
  if (jobType.includes('Manually Added Urls')) {
    const apiKeyMatch = jobType.match(/\(via API: (.+)\)/);
    return apiKeyMatch ? `API: ${apiKeyMatch[1]}` : 'Manual Videos';
  }
  if (jobType === 'Playlist Downloads' || jobType.startsWith('Playlist: ')) return 'Playlists';
  return '';
}

// "MM-DD h:mm AM"
function formatJobTimeCreated(value: Job['timeCreated']): string {
  const timeCreated = new Date(value);
  const month = String(timeCreated.getMonth() + 1).padStart(2, '0');
  const day = String(timeCreated.getDate()).padStart(2, '0');
  const minutes = String(timeCreated.getMinutes()).padStart(2, '0');
  const period = timeCreated.getHours() >= 12 ? 'PM' : 'AM';
  const hours = timeCreated.getHours() % 12 || 12;
  return `${month}-${day} ${hours}:${minutes} ${period}`;
}

// The status text of a finished job, or how long a running one has taken.
function describeJobDuration(job: Job, videoCount: number, currentTime: Date): string {
  if (job.status !== 'In Progress') {
    return videoCount === 0 ? `${job.status} - no new videos` : job.status;
  }
  const duration = new Date(currentTime.getTime() - new Date(job.timeInitiated).getTime());
  const mm = String(duration.getUTCMinutes()).padStart(2, '0');
  const ss = String(duration.getUTCSeconds()).padStart(2, '0');
  return `${mm}m${ss}s`;
}

// What the phone cards and the desktop table both show for one job.
function describeJobRow(job: Job, currentTime: Date) {
  const videos: VideoData[] = job.data?.videos || [];
  return {
    videos,
    durationString: describeJobDuration(job, videos.length, currentTime),
    formattedTimeCreated: formatJobTimeCreated(job.timeCreated),
    formattedJobType: shortJobTypeLabel(job.jobType),
    failedForJob: getDisplayableFailedVideos(job),
  };
}

interface JobSummaryChipsProps {
  job: Job;
  failedCount: number;
  // Whether to count the job's missing and deleted videos.
  showAvailability: boolean;
}

const JobSummaryChips: React.FC<JobSummaryChipsProps> = ({ job, failedCount, showAvailability }) => {
  const videos: VideoData[] = job.data?.videos || [];
  const countIn = (state: 'missing' | 'deleted') =>
    showAvailability ? videos.filter((v) => getRemovalState(v.removed, v.removed_reason) === state).length : 0;
  const missingCount = countIn('missing');
  const deletedCount = countIn('deleted');

  return (
    <>
      {missingCount > 0 && (
        <AvailabilityChip
          state="missing"
          label={`${missingCount} missing`}
          tooltip={`${missingCount} of ${videos.length} video files not found on disk`}
        />
      )}
      {deletedCount > 0 && (
        <AvailabilityChip
          state="deleted"
          label={`${deletedCount} deleted`}
          tooltip={`${deletedCount} of ${videos.length} videos ${deletedCount === 1 ? 'was' : 'were'} deleted by Youtarr or marked as deleted`}
        />
      )}
      {failedCount > 0 && (
        <FailedVideoChip count={failedCount} diagnosisTitles={getDiagnosisTitles(job)} />
      )}
    </>
  );
};

function jobVideoToModalData(video: VideoData): VideoModalData {
  const isDownloaded = Boolean(video.filePath || video.audioFilePath) && !video.removed;
  const status: VideoModalData['status'] = video.removed
    ? removedState(video.removed_reason)
    : isDownloaded
    ? 'downloaded'
    : 'never_downloaded';
  return {
    removal: removalFromRow(video),
    youtubeId: video.youtubeId,
    title: video.youTubeVideoName,
    channelName: video.youTubeChannelName,
    thumbnailUrl: `/images/videothumb-${video.youtubeId}.jpg`,
    duration: video.duration,
    publishedAt: video.originalDate || null,
    addedAt: video.timeCreated || null,
    mediaType: video.media_type || 'video',
    status,
    isDownloaded,
    filePath: video.filePath || null,
    fileSize: video.fileSize ? Number(video.fileSize) : null,
    audioFilePath: video.audioFilePath || null,
    audioFileSize: video.audioFileSize ? Number(video.audioFileSize) : null,
    isProtected: video.protected || false,
    isIgnored: false,
    normalizedRating: video.normalized_rating || null,
    ratingSource: video.rating_source || null,
    databaseId: video.id,
    channelId: video.channel_id || null,
  };
}

const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  jobs,
  currentTime,
  expanded,
  handleExpandCell,
  isMobile,
  token = null,
  onVideoDeleted,
}) => {
  const [modalVideo, setModalVideo] = useState<VideoData | null>(null);
  const [showNoVideoJobs, setShowNoVideoJobs] = useState(false);
  const [hideArrBridgeJobs, setHideArrBridgeJobs] = useState(readHideArrBridgeJobs);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [visibleCount, setVisibleCount] = useState(12);
  const { config } = useConfig(token);
  const useInfiniteScroll = config.channelVideosHotLoad ?? false;

  const handleImageError = (youtubeId: string) => {
    setImageErrors((prev) => ({ ...prev, [youtubeId]: true }));
  };

  // Offered only where there is something to hide, and remembered per browser.
  const hasArrBridgeJobs = jobs.some((job) => isArrBridgeJob(job.jobType));
  const handleHideArrBridgeJobs = (hide: boolean) => {
    try {
      localStorage.setItem(HIDE_ARR_BRIDGE_STORAGE_KEY, String(hide));
    } catch {
      // localStorage may be unavailable (private mode, quota); keep the in-memory value
    }
    setHideArrBridgeJobs(hide);
  };
  const hideArrBridgeControl = hasArrBridgeJobs ? (
    <FormControlLabel
      control={<Checkbox checked={hideArrBridgeJobs} onChange={(e) => handleHideArrBridgeJobs(e.target.checked)} />}
      label="Hide Sonarr/Radarr grabs"
    />
  ) : null;

  const jobsToDisplay = jobs
    .filter((job) => !job.jobType?.includes('Import Subscriptions'))
    .filter((job) => !(hideArrBridgeJobs && isArrBridgeJob(job.jobType)))
    .filter((job) => {
      if (showNoVideoJobs) {
        return true;
      }

      if (!job.data?.videos) {
        return true;
      }

      return job.data.videos.length > 0 || getDisplayableFailedVideos(job).length > 0;
    });

  const totalPages = Math.max(1, Math.ceil(jobsToDisplay.length / itemsPerPage));
  const hasMoreHotLoadItems = visibleCount < jobsToDisplay.length;
  const currentJobs = useMemo(() => {
    if (useInfiniteScroll) {
      return jobsToDisplay.slice(0, visibleCount);
    }

    const indexOfLastJob = currentPage * itemsPerPage;
    const indexOfFirstJob = indexOfLastJob - itemsPerPage;
    return jobsToDisplay.slice(indexOfFirstJob, indexOfLastJob);
  }, [useInfiniteScroll, jobsToDisplay, visibleCount, currentPage, itemsPerPage]);

  React.useEffect(() => {
    setCurrentPage(1);
    setVisibleCount(itemsPerPage);
  }, [showNoVideoJobs, hideArrBridgeJobs, itemsPerPage]);

  // No loading flag: revealing more of the jobs already held is immediate.
  const loadMoreRef = useInfiniteScrollTrigger({
    enabled: useInfiniteScroll,
    hasNextPage: hasMoreHotLoadItems,
    onLoadNextPage: () => setVisibleCount((prev) => Math.min(prev + itemsPerPage, jobsToDisplay.length)),
  });

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentPage < totalPages) setCurrentPage((p) => p + 1);
    },
    onSwipedRight: () => {
      if (currentPage > 1) setCurrentPage((p) => p - 1);
    },
    trackMouse: true,
  });

    const modalElement = modalVideo ? (
      <VideoModal
        open
        onClose={() => setModalVideo(null)}
        video={jobVideoToModalData(modalVideo)}
        token={token}
        onVideoDeleted={() => {
          setModalVideo(null);
          onVideoDeleted?.();
        }}
      />
    ) : null;

    if (isMobile) {
      return (
        <>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Download History" />
            <CardContent>
              <Toolbar disableGutters className="mb-2">
                <FormControlLabel
                  control={<Checkbox checked={showNoVideoJobs} onChange={(e) => { setShowNoVideoJobs(e.target.checked); setCurrentPage(1); }} />}
                  label="Show jobs without videos"
                />
                {hideArrBridgeControl}
              </Toolbar>
              {!useInfiniteScroll && (
                <Box className="flex justify-center mb-2">
                  <PageControls page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} compact />
                </Box>
              )}

              <Box {...handlers}>
                <Box className="flex flex-col gap-2.5">
                  {currentJobs.length === 0 && (
                    <Typography variant="body2">No jobs currently</Typography>
                  )}

                  {currentJobs.map((job) => {
                    const isExpanded = !!expanded[job.id];

                    const { videos, durationString, formattedTimeCreated, formattedJobType, failedForJob } =
                      describeJobRow(job, currentTime);

                    const singleVideo = videos[0];
                    const hasMultiple = videos.length > 1;
                    const titleText = singleVideo?.youTubeVideoName || (hasMultiple ? `Multiple (${videos.length})` : cleanJobTypeLabel(job.jobType));
                    const channelText = !hasMultiple ? singleVideo?.youTubeChannelName : undefined;
                    const showThumbnail = !hasMultiple && !!singleVideo;
                    const hasExpandable = hasMultiple || failedForJob.length > 0;

                    return (
                      <Box
                        key={job.id}
                        style={{ border: 'var(--border-weight) solid var(--border)', borderRadius: 'var(--radius-ui)' }}
                        className="p-3"
                      >
                        <Box className="flex items-start justify-between gap-2">
                          <Box className="flex items-center gap-2 flex-wrap min-w-0">
                            <Typography variant="subtitle2" className="font-semibold">
                              {hasMultiple ? (
                                `Multiple (${videos.length})`
                              ) : singleVideo ? (
                                <Link
                                  component="button"
                                  type="button"
                                  onClick={() => setModalVideo(singleVideo)}
                                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                                >
                                  {singleVideo.youTubeVideoName}
                                  <VideoActivityChip youtubeId={singleVideo.youtubeId} />
                                </Link>
                              ) : (
                                titleText
                              )}
                            </Typography>
                            <JobSummaryChips job={job} failedCount={failedForJob.length} showAvailability={hasMultiple} />
                          </Box>
                          {hasExpandable && (
                            <IconButton size="small" onClick={() => handleExpandCell(job.id)}>
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          )}
                        </Box>

                        {channelText && (
                          <Typography variant="caption" color="secondary" className="mt-0.5 block">
                            {channelText}
                          </Typography>
                        )}

                        <Box className="mt-2 flex items-start gap-3">
                          {showThumbnail && singleVideo && (
                            <VideoThumbnail
                              video={singleVideo}
                              width={96}
                              height={72}
                              onClick={() => setModalVideo(singleVideo)}
                              hasError={!!imageErrors[singleVideo.youtubeId]}
                              onError={() => handleImageError(singleVideo.youtubeId)}
                              iconSize={24}
                            />
                          )}

                          {hasMultiple ? (
                            <Box className="min-w-0 flex flex-1 flex-col gap-0.5">
                              <Box className="flex items-baseline gap-1 flex-wrap">
                                <Typography variant="caption" color="secondary">Date:</Typography>
                                <Typography variant="caption" className="font-medium">{formattedTimeCreated}</Typography>
                              </Box>
                              <Box className="flex items-baseline gap-x-4 gap-y-0.5 flex-wrap">
                                {formattedJobType && (
                                  <Box className="flex items-baseline gap-1">
                                    <Typography variant="caption" color="secondary">Source:</Typography>
                                    <Typography variant="caption" className="font-medium">{formattedJobType}</Typography>
                                  </Box>
                                )}
                                <Box className="flex items-baseline gap-1">
                                  <Typography variant="caption" color="secondary">Status:</Typography>
                                  <Typography variant="caption" className="font-medium">{durationString}</Typography>
                                </Box>
                              </Box>
                            </Box>
                          ) : (
                            <Box className="min-w-0 flex flex-1 flex-col gap-0.5">
                              <Typography variant="caption" color="secondary">
                                Date: {formattedTimeCreated}
                              </Typography>
                              {formattedJobType && (
                                <Typography variant="caption" color="secondary">
                                  Source: {formattedJobType}
                                </Typography>
                              )}
                              <Typography variant="caption" color="secondary">
                                Status: {durationString}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {hasExpandable && (
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box className="mt-1.5 flex flex-col gap-1.5">
                              {videos.map((video: VideoData) => (
                                <Box key={video.youtubeId} className="flex flex-col">
                                  <Link
                                    component="button"
                                    type="button"
                                    onClick={() => setModalVideo(video)}
                                    style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                                  >
                                    {video.youTubeVideoName}
                                  </Link>
                                  <Box className="flex items-center gap-2 flex-wrap">
                                    <Typography variant="caption" color="secondary">
                                      {video.youTubeChannelName}
                                    </Typography>
                                    <VideoActivityChip youtubeId={video.youtubeId} />
                                    {video.removed && <AvailabilityChip state={removedState(video.removed_reason)} tooltip={<RemovalDescription row={video} />} />}
                                  </Box>
                                </Box>
                              ))}
                              <FailedDownloadsDetail
                                failedVideos={failedForJob}
                                diagnoses={job.data?.diagnoses}
                              />
                            </Box>
                          </Collapse>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {!useInfiniteScroll && (
                <Box className="flex justify-center mt-4">
                  <PageControls page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </Box>
              )}

              {useInfiniteScroll && hasMoreHotLoadItems && (
                <div ref={loadMoreRef} style={{ height: 24, width: '100%', marginTop: 8 }} />
              )}
            </CardContent>
          </Card>
        </Grid>
        {modalElement}
        </>
      );
    }

    return (
      <>
      <Grid item xs={12}>
        <Box>
          <CardHeader title="Download History" className="px-0 pt-0" />
          <Toolbar disableGutters className="justify-between mb-2">
            <FormControlLabel
              control={<Checkbox checked={showNoVideoJobs} onChange={(e) => { setShowNoVideoJobs(e.target.checked); setCurrentPage(1); }} />}
              label="Show jobs with no videos"
            />
            {hideArrBridgeControl}
          </Toolbar>

          <TableContainer>
            <div {...handlers}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date / Time</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentJobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>No jobs currently running</TableCell>
                    </TableRow>
                  )}

                  {currentJobs.map((job) => {
                    const isExpanded = !!expanded[job.id];

                    const { videos, durationString, formattedTimeCreated, formattedJobType, failedForJob } =
                      describeJobRow(job, currentTime);

                    if (videos.length > 1 || failedForJob.length > 0) {
                      const summaryLabel = videos.length > 1
                        ? `Multiple (${videos.length})`
                        : videos[0]?.youTubeVideoName || cleanJobTypeLabel(job.jobType);
                      return (
                        <React.Fragment key={job.id}>
                          <TableRow hover onClick={() => handleExpandCell(job.id)}>
                            <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedTimeCreated}</TableCell>
                            <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>
                              <Box className="flex items-center gap-2 flex-wrap">
                                <span>{summaryLabel}</span>
                                <JobSummaryChips job={job} failedCount={failedForJob.length} showAvailability />
                              </Box>
                            </TableCell>
                            <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedJobType}</TableCell>
                            <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{job.status}</TableCell>
                            <TableCell align="right">
                              <Box style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--foreground)' }}>
                                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </Box>
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell colSpan={5} style={{ padding: 0, border: 'none' }}>
                              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                <Box className="p-2">
                                  {videos.length > 0 && (
                                  <Table size="small">
                                    <TableBody>
                                      {videos.map((video: VideoData) => (
                                        <TableRow key={video.youtubeId}>
                                          <TableCell style={{ width: 180 }}>{formattedTimeCreated}</TableCell>
                                          <TableCell>
                                            <Box className="flex items-start gap-2 flex-wrap">
                                              <Link
                                                component="button"
                                                type="button"
                                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setModalVideo(video); }}
                                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                                              >
                                                {video.youTubeVideoName}
                                              </Link>
                                              <VideoActivityChip youtubeId={video.youtubeId} />
                                              {video.removed && <AvailabilityChip state={removedState(video.removed_reason)} tooltip={<RemovalDescription row={video} />} />}
                                            </Box>
                                            <Typography variant="caption" color="secondary" className="block">{video.youTubeChannelName}</Typography>
                                          </TableCell>
                                          <TableCell>{formattedJobType}</TableCell>
                                          <TableCell>{job.status}</TableCell>
                                          <TableCell />
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  )}
                                  <FailedDownloadsDetail
                                    failedVideos={failedForJob}
                                    diagnoses={job.data?.diagnoses}
                                  />
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    }

                    const singleVideo = videos[0];
                    return (
                      <TableRow key={job.id} hover>
                        <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedTimeCreated}</TableCell>
                        <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>
                          {singleVideo ? (
                            <Box className="flex items-start gap-3">
                              <span aria-hidden="true" style={{ display: 'none' }}>1</span>
                              <VideoThumbnail
                                video={singleVideo}
                                width={128}
                                height={72}
                                onClick={() => setModalVideo(singleVideo)}
                                hasError={!!imageErrors[singleVideo.youtubeId]}
                                onError={() => handleImageError(singleVideo.youtubeId)}
                                iconSize={32}
                              />
                              <Box className="min-w-0 flex-1">
                                <Link
                                  component="button"
                                  type="button"
                                  onClick={() => setModalVideo(singleVideo)}
                                  style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                                >
                                  {singleVideo.youTubeVideoName}
                                  <VideoActivityChip youtubeId={singleVideo.youtubeId} />
                                </Link>
                                <Typography variant="caption" color="secondary" className="block">{singleVideo.youTubeChannelName}</Typography>
                              </Box>
                            </Box>
                          ) : job.status === 'In Progress' ? (
                            <span>---</span>
                          ) : (
                            <span>None</span>
                          )}
                        </TableCell>
                        <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedJobType || '---'}</TableCell>
                        <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{durationString}</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TableContainer>

          {!useInfiniteScroll && (
            <Box className="flex justify-center mt-4">
              <PageControls page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </Box>
          )}

          {useInfiniteScroll && hasMoreHotLoadItems && (
            <div ref={loadMoreRef} style={{ height: 24, width: '100%', marginTop: 8 }} />
          )}
        </Box>
      </Grid>
      {modalElement}
      </>
    );
  };

  export default DownloadHistory;
