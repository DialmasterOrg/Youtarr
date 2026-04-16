import React, { useMemo, useRef, useState } from 'react';
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
import { Job } from '../../types/Job';
import { VideoData } from '../../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import { useConfig } from '../../hooks/useConfig';
import PageControls from '../shared/PageControls';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';

interface DownloadHistoryProps {
  jobs: Job[];
  currentTime: Date;
  expanded: Record<string, boolean>;
  handleExpandCell: (id: string) => void;
  isMobile: boolean;
  token?: string | null;
}

function cleanJobTypeLabel(jobType: string): string {
  if (jobType.includes('Channel Downloads')) return 'Channel Downloads';
  if (jobType.includes('Manually Added Urls')) {
    const apiKeyMatch = jobType.match(/\(via API: (.+)\)/);
    return apiKeyMatch ? `Manual Videos (API: ${apiKeyMatch[1]})` : 'Manual Videos';
  }
  return jobType;
}

function jobVideoToModalData(video: VideoData): VideoModalData {
  const isDownloaded = Boolean(video.filePath) && !video.removed;
  const status: VideoModalData['status'] = video.removed
    ? 'missing'
    : isDownloaded
    ? 'downloaded'
    : 'never_downloaded';
  return {
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
}) => {
  const [modalVideo, setModalVideo] = useState<VideoData | null>(null);
  const [showNoVideoJobs, setShowNoVideoJobs] = useState(false);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { config } = useConfig(token);
  const useInfiniteScroll = config.channelVideosHotLoad ?? false;

  const jobsToDisplay = jobs
    .filter((job) => !job.jobType?.includes('Import Subscriptions'))
    .filter((job) => {
      if (showNoVideoJobs) {
        return true;
      }

      if (!job.data?.videos) {
        return true;
      }

      return job.data.videos.length > 0;
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
  }, [showNoVideoJobs, itemsPerPage]);

  React.useEffect(() => {
    if (!useInfiniteScroll) {
      return;
    }
    if (!loadMoreRef.current || !hasMoreHotLoadItems) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + itemsPerPage, jobsToDisplay.length));
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 180px 0px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [useInfiniteScroll, hasMoreHotLoadItems, itemsPerPage, jobsToDisplay.length]);

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

                    const videos = job.data?.videos || [];
                    const isCompletedWithNoVideos = videos.length === 0 && job.status !== 'In Progress';

                    let durationString = '';
                    if (job.status !== 'In Progress') {
                      durationString = isCompletedWithNoVideos ? `${job.status} - no new videos` : job.status;
                    } else {
                      const jobStartTime = new Date(job.timeInitiated).getTime();
                      const duration = new Date(currentTime.getTime() - jobStartTime);
                      const mm = String(duration.getUTCMinutes()).padStart(2, '0');
                      const ss = String(duration.getUTCSeconds()).padStart(2, '0');
                      durationString = `${mm}m${ss}s`;
                    }

                    const timeCreated = new Date(job.timeCreated);
                    const month = String(timeCreated.getMonth() + 1).padStart(2, '0');
                    const day = String(timeCreated.getDate()).padStart(2, '0');
                    const minutes = String(timeCreated.getMinutes()).padStart(2, '0');
                    let hours = timeCreated.getHours();
                    const period = hours >= 12 ? 'PM' : 'AM';

                    let formattedJobType = '';
                    if (job.jobType.includes('Channel Downloads')) formattedJobType = 'Channels';
                    else if (job.jobType.includes('Manually Added Urls')) {
                      const apiKeyMatch = job.jobType.match(/\(via API: (.+)\)/);
                      formattedJobType = apiKeyMatch ? `API: ${apiKeyMatch[1]}` : 'Manual Videos';
                    }

                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    const formattedTimeCreated = `${month}-${day} ${hours}:${minutes} ${period}`;

                    const singleVideo = videos[0];
                    const hasMultiple = videos.length > 1;
                    const titleText = singleVideo?.youTubeVideoName || (hasMultiple ? `Multiple (${videos.length})` : cleanJobTypeLabel(job.jobType));
                    const channelText = singleVideo?.youTubeChannelName;
                    const thumbnailSrc = singleVideo?.youtubeId
                      ? `https://i.ytimg.com/vi/${singleVideo.youtubeId}/mqdefault.jpg`
                      : null;

                    return (
                      <Box
                        key={job.id}
                        style={{ border: 'var(--border-weight) solid var(--border)', borderRadius: 'var(--radius-ui)' }}
                        className="p-3"
                      >
                        <Box className="flex items-start justify-between gap-2">
                          <Typography variant="subtitle2" className="font-semibold">
                            {singleVideo ? (
                              <Link
                                component="button"
                                type="button"
                                onClick={() => setModalVideo(singleVideo)}
                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                              >
                                {singleVideo.youTubeVideoName}
                              </Link>
                            ) : (
                              titleText
                            )}
                          </Typography>
                          {hasMultiple && (
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
                          {thumbnailSrc && (
                            <Box
                              onClick={singleVideo ? () => setModalVideo(singleVideo) : undefined}
                              style={{
                                width: 96,
                                height: 72,
                                borderRadius: 'var(--radius-thumb)',
                                overflow: 'hidden',
                                backgroundColor: 'rgb(17 24 39)',
                                flexShrink: 0,
                                cursor: singleVideo ? 'pointer' : 'default',
                              }}
                            >
                              <img
                                src={thumbnailSrc}
                                alt={titleText}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                loading="lazy"
                              />
                            </Box>
                          )}

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
                        </Box>

                        {hasMultiple && (
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box className="mt-1.5 flex flex-col gap-1">
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
                                  <Typography variant="caption" color="secondary">
                                    {video.youTubeChannelName}
                                  </Typography>
                                </Box>
                              ))}
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

                    const videos = job.data?.videos || [];
                    const isCompletedWithNoVideos = videos.length === 0 && job.status !== 'In Progress';

                    let durationString = '';
                    if (job.status !== 'In Progress') {
                      durationString = isCompletedWithNoVideos ? `${job.status} - no new videos` : job.status;
                    } else {
                      const jobStartTime = new Date(job.timeInitiated).getTime();
                      const duration = new Date(currentTime.getTime() - jobStartTime);
                      const mm = String(duration.getUTCMinutes()).padStart(2, '0');
                      const ss = String(duration.getUTCSeconds()).padStart(2, '0');
                      durationString = `${mm}m${ss}s`;
                    }

                    const timeCreated = new Date(job.timeCreated);
                    const month = String(timeCreated.getMonth() + 1).padStart(2, '0');
                    const day = String(timeCreated.getDate()).padStart(2, '0');
                    const minutes = String(timeCreated.getMinutes()).padStart(2, '0');
                    let hours = timeCreated.getHours();
                    const period = hours >= 12 ? 'PM' : 'AM';

                    let formattedJobType = '';
                    if (job.jobType.includes('Channel Downloads')) formattedJobType = 'Channels';
                    else if (job.jobType.includes('Manually Added Urls')) {
                      const apiKeyMatch = job.jobType.match(/\(via API: (.+)\)/);
                      formattedJobType = apiKeyMatch ? `API: ${apiKeyMatch[1]}` : 'Manual Videos';
                    }

                    hours = hours % 12;
                    hours = hours ? hours : 12;
                    const formattedTimeCreated = `${month}-${day} ${hours}:${minutes} ${period}`;

                    if (videos.length > 1) {
                      return (
                        <React.Fragment key={job.id}>
                          <TableRow hover onClick={() => handleExpandCell(job.id)}>
                            <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedTimeCreated}</TableCell>
                            <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>Multiple ({videos.length})</TableCell>
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
                                  <Table size="small">
                                    <TableBody>
                                      {videos.map((video: VideoData) => (
                                        <TableRow key={video.youtubeId}>
                                          <TableCell style={{ width: 180 }}>{formattedTimeCreated}</TableCell>
                                          <TableCell>
                                            <Link
                                              component="button"
                                              type="button"
                                              onClick={(e: React.MouseEvent) => { e.stopPropagation(); setModalVideo(video); }}
                                              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                                            >
                                              {video.youTubeVideoName}
                                            </Link>
                                            <Typography variant="caption" color="secondary" className="block">{video.youTubeChannelName}</Typography>
                                          </TableCell>
                                          <TableCell>{formattedJobType}</TableCell>
                                          <TableCell>{job.status}</TableCell>
                                          <TableCell />
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
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
                            <>
                              <span aria-hidden="true" style={{ display: 'none' }}>1</span>
                              <Link
                                component="button"
                                type="button"
                                onClick={() => setModalVideo(singleVideo)}
                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
                              >
                                {singleVideo.youTubeVideoName}
                              </Link>
                              <Typography variant="caption" color="secondary" className="block">{singleVideo.youTubeChannelName}</Typography>
                            </>
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

