import React, { useRef, useState } from 'react';
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
  Pagination,
  Collapse,
  Link,
  Card,
  CardHeader,
  CardContent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Job } from '../../types/Job';
import { useSwipeable } from 'react-swipeable';

  interface DownloadHistoryProps {
    jobs: Job[];
    currentTime: Date;
    expanded: Record<string, boolean>;
    handleExpandCell: (id: string) => void;
    setAnchorEl?: React.Dispatch<React.SetStateAction<Record<string, null | HTMLButtonElement>>>;
    isMobile: boolean;
  }

  const DownloadHistory: React.FC<DownloadHistoryProps> = ({
    jobs,
    currentTime,
    expanded,
    handleExpandCell,
    setAnchorEl,
    isMobile,
  }) => {
    const [showNoVideoJobs, setShowNoVideoJobs] = useState(false);
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);

    let jobsToDisplay = jobs.filter((job) => {
      if (showNoVideoJobs) return true;
      if (!job.data?.videos) return true;
      return job.data.videos && job.data.videos.length > 0;
    });

    const totalPages = Math.max(1, Math.ceil(jobsToDisplay.length / itemsPerPage));
    const indexOfLastJob = currentPage * itemsPerPage;
    const indexOfFirstJob = indexOfLastJob - itemsPerPage;
    const currentJobs = jobsToDisplay.slice(indexOfFirstJob, indexOfLastJob);

    const handlers = useSwipeable({
      onSwipedLeft: () => {
        if (currentPage < totalPages) setCurrentPage((p) => p + 1);
      },
      onSwipedRight: () => {
        if (currentPage > 1) setCurrentPage((p) => p - 1);
      },
      trackMouse: true,
    });

    return (
      <Grid item xs={12}>
        <Card>
          <CardHeader title="Download History" />
          <CardContent>
            <Toolbar disableGutters sx={{ justifyContent: 'space-between', mb: 1 }}>
              <FormControlLabel
                control={<Checkbox checked={showNoVideoJobs} onChange={(e) => { setShowNoVideoJobs(e.target.checked); setCurrentPage(1); }} />}
                label="Show jobs without videos"
              />
              <Pagination count={totalPages} page={currentPage} onChange={(_, p) => setCurrentPage(p)} />
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
                        <TableCell colSpan={5}>No jobs currently</TableCell>
                      </TableRow>
                    )}

                    {currentJobs.map((job) => {
                      const isExpanded = !!expanded[job.id];

                      let durationString = '';
                      if (job.status !== 'In Progress') {
                        durationString = job.status;
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

                      const videos = job.data?.videos || [];

                      if (videos.length > 1) {
                        return (
                          <React.Fragment key={job.id}>
                            <TableRow hover onClick={() => handleExpandCell(job.id)}>
                              <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedTimeCreated}</TableCell>
                              <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>Multiple ({videos.length})</TableCell>
                              <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedJobType}</TableCell>
                              <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{job.status}</TableCell>
                              <TableCell align="right">
                                <IconButton size="small" onClick={() => handleExpandCell(job.id)}>
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell colSpan={5} sx={{ p: 0, border: 'none' }}>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 1 }}>
                                    <Table size="small">
                                      <TableBody>
                                        {videos.map((video: any) => (
                                          <TableRow key={video.youtubeId} hover>
                                            <TableCell sx={{ width: 180 }}>{formattedTimeCreated}</TableCell>
                                            <TableCell>
                                              <Link href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noopener noreferrer">{video.youTubeVideoName}</Link>
                                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{video.youTubeChannelName}</Typography>
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
                                <Link href={`https://www.youtube.com/watch?v=${singleVideo.youtubeId}`} target="_blank" rel="noopener noreferrer">{singleVideo.youTubeVideoName}</Link>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{singleVideo.youTubeChannelName}</Typography>
                              </>
                            ) : (
                              <span>{job.jobType}</span>
                            )}
                          </TableCell>
                          <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{formattedJobType}</TableCell>
                          <TableCell style={{ fontSize: isMobile ? 'small' : 'medium' }}>{job.status}</TableCell>
                          <TableCell align="right" />
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TableContainer>

            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination count={totalPages} page={currentPage} onChange={(_, p) => setCurrentPage(p)} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  export default DownloadHistory;

