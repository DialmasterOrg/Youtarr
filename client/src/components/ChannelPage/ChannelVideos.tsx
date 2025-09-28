import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  CardHeader,
  Button,
  Toolbar,
  Box,
  FormControlLabel,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  Snackbar,
  Skeleton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import CloudOffIcon from '@mui/icons-material/CloudOff';

import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';

interface ChannelVideosProps {
  token: string | null;
}

function ChannelVideos({ token }: ChannelVideosProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = useState(1);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [videoFailed, setVideoFailed] = useState<Boolean>(false);
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]); // new state variable
  const [hideDownloaded, setHideDownloaded] = useState(false);
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const { channel_id } = useParams();

  const navigate = useNavigate();

  const handleCheckChange = (videoId: string, isChecked: boolean) => {
    setCheckedBoxes((prevState) => {
      if (isChecked) {
        return [...prevState, videoId];
      } else {
        return prevState.filter((id) => id !== videoId);
      }
    });
  };

  const downloadChecked = () => {
    // Show the download settings dialog instead of immediately downloading
    setDownloadDialogOpen(true);
  };

  const handleDownloadConfirm = async (settings: DownloadSettings | null) => {
    setDownloadDialogOpen(false);

    // Build request body with URLs and settings
    const requestBody: any = {
      urls: checkedBoxes.map(id => `https://www.youtube.com/watch?v=${id}`)
    };

    if (settings) {
      requestBody.overrideSettings = {
        resolution: settings.resolution,
        allowRedownload: settings.allowRedownload
      };
    }

    // Start downloading the checked videos
    await fetch('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
      },
      body: JSON.stringify(requestBody),
    });

    // Clear selection and navigate to downloads page
    setCheckedBoxes([]);
    navigate('/downloads');
  };

  const handleDownloadCancel = () => {
    setDownloadDialogOpen(false);
  };

  // Calculate how many of the selected videos are missing (previously downloaded but removed)
  const getMissingVideoCount = () => {
    return checkedBoxes.reduce((count, videoId) => {
      const video = videos.find(v => v.youtube_id === videoId);
      if (video && video.added && video.removed) {
        return count + 1;
      }
      return count;
    }, 0);
  };

  const resetChecked = () => {
    setCheckedBoxes([]);
  };

  const selectAllUndownloaded = () => {
    // Get videos on current page that are not downloaded OR are missing, and not members-only
    const currentPageVideos = videosToDisplay.slice(
      (page - 1) * videosPerPage,
      page * videosPerPage
    );

    const selectableVideos = currentPageVideos.filter(
      (video) => {
        const isMembersOnly = video.availability === 'subscriber_only';
        const isSelectable = (!video.added || video.removed) && !isMembersOnly;
        return isSelectable;
      }
    );

    const videoIds = selectableVideos.map((video) => video.youtube_id);

    // Add these IDs to checked boxes (avoiding duplicates)
    setCheckedBoxes((prevState) => {
      const newIds = videoIds.filter((id) => !prevState.includes(id));
      return [...prevState, ...newIds];
    });
  };

  // Calculate how many videos on current page can be selected
  const getSelectableCount = () => {
    const currentPageVideos = videosToDisplay.slice(
      (page - 1) * videosPerPage,
      page * videosPerPage
    );

    return currentPageVideos.filter(
      (video) => {
        const isMembersOnly = video.availability === 'subscriber_only';
        const isSelectable = (!video.added || video.removed) && !isMembersOnly;
        return isSelectable;
      }
    ).length;
  };

  // Determine the download status of a video
  const getVideoStatus = (video: ChannelVideo): 'never_downloaded' | 'downloaded' | 'missing' | 'members_only' => {
    if (video.availability === 'subscriber_only') {
      return 'members_only';
    }
    if (!video.added) {
      return 'never_downloaded';
    }
    if (video.removed) {
      return 'missing';
    }
    return 'downloaded';
  };

  function decodeHtml(html: string) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  useEffect(() => {
    // Get data about the videos in the channel
    fetch(`/getchannelvideos/${channel_id}`, {
      headers: {
        'x-access-token': token || '',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        // Handle both old and new response formats
        if (data.videos !== undefined) {
          setVideos(data.videos || []);
        }
        setVideoFailed(data.videoFail || false);
      })
      .catch((error) => console.error(error));
  }, [token, channel_id]);

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setPage(value);
  };

  const videosPerPage = isMobile ? 8 : 16;
  let videosToDisplay = videos.filter((video) => {
    // Filter out downloaded videos if hideDownloaded is enabled
    return hideDownloaded ? !video.added : true;
  });

  const getInfoIcon = (tooltipText: string) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMobile) {
        setMobileTooltip(mobileTooltip === tooltipText ? null : tooltipText);
      }
    };

    if (isMobile) {
      return (
        <IconButton
          size="small"
          sx={{ ml: 0.5, p: 0.5 }}
          onClick={handleClick}
        >
          <InfoIcon fontSize="small" />
        </IconButton>
      );
    }

    return (
      <Tooltip title={tooltipText} arrow placement="top">
        <IconButton size="small" sx={{ ml: 0.5, p: 0.5 }}>
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (page < Math.ceil(videosToDisplay.length / videosPerPage)) {
        setPage(page + 1);
      }
    },
    onSwipedRight: () => {
      if (page > 1) {
        setPage(page - 1);
      }
    },
    trackMouse: true,
  });

  return (
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardHeader
        title='Recent Channel Videos'
        align='center'
        paddingTop={isMobile ? '12px' : '0px'}
        style={{ position: 'relative' }}
      />
      <div {...handlers}>
        {/* Show error message if video fetch failed */}
        {videoFailed && videos.length === 0 && (
          <Box p={3}>
            <Alert severity="error">
              Failed to fetch channel videos. Please try again later.
            </Alert>
          </Box>
        )}

        {!videoFailed && videos.length > 0 && (
          <>
            <Grid
              container
              spacing={2}
              justifyContent='center'
              style={{ marginTop: '8px', marginBottom: '8px' }}
            >
              <Pagination
                count={Math.ceil(videosToDisplay.length / videosPerPage)}
                page={page}
                onChange={handlePageChange}
              />
            </Grid>
            <Toolbar style={{ minHeight: '42px' }}>
              <Box display='flex' justifyContent='center' width='100%'>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hideDownloaded}
                      onChange={(event) => {
                        setHideDownloaded(event.target.checked);
                        setPage(1); // Reset the page number to 1
                      }}
                      inputProps={{ 'aria-label': 'Show jobs with no videos' }}
                    />
                  }
                  label='Hide Downloaded Videos'
                />
              </Box>
            </Toolbar>
          </>
        )}
        <Grid container justifyContent='center'>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              px: 2,
              py: 1,
              width: isMobile ? '100%' : 'auto',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 1,
                width: '100%',
                justifyContent: 'center',
              }}
            >
              <Button
                onClick={selectAllUndownloaded}
                variant='outlined'
                disabled={getSelectableCount() === 0}
                sx={{
                  width: isMobile ? '45%' : '186px',
                  fontSize: isMobile ? '12px' : '14px',
                }}
                title="Select all videos that need downloading (new and missing videos)"
              >
                Select All
              </Button>
              <Button
                variant='outlined'
                disabled={checkedBoxes.length === 0}
                onClick={resetChecked}
                sx={{
                  width: isMobile ? '45%' : '186px',
                  fontSize: isMobile ? '12px' : '14px',
                }}
              >
                Clear Selection
              </Button>
            </Box>
            <Button
              onClick={downloadChecked}
              variant='contained'
              disabled={checkedBoxes.length === 0}
              sx={{
                width: isMobile ? '91%' : '380px',
              }}
            >
              Download Selected{' '}
              {checkedBoxes.length ? `(${checkedBoxes.length})` : ''}
            </Button>
          </Box>
        </Grid>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                {isMobile ? (
                  <TableRow>
                    <TableCell
                      style={{
                        fontWeight: 'bold',
                        fontSize: 'medium',
                        minWidth: '200px',
                      }}
                    >
                      Video
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Added?
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Thumbnail
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Title
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Published
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Downloaded?
                    </TableCell>
                  </TableRow>
                )}
              </TableHead>
              <TableBody>
                {videos.length === 0 && !videoFailed && (
                  <>
                    <TableRow>
                      <TableCell colSpan={isMobile ? 2 : 4} align="center" sx={{ py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Refreshing channel videos — please wait
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {[...Array(videosPerPage)].map((_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        {isMobile ? (
                          <>
                            <TableCell>
                              <Skeleton variant="rectangular" width={200} height={112} sx={{ mb: 1 }} />
                              <Skeleton variant="text" width="90%" />
                              <Skeleton variant="text" width="40%" />
                            </TableCell>
                            <TableCell>
                              <Skeleton variant="circular" width={24} height={24} />
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              <Skeleton variant="rectangular" width={200} height={112} />
                            </TableCell>
                            <TableCell>
                              <Skeleton variant="text" width="100%" />
                              <Skeleton variant="text" width="30%" />
                            </TableCell>
                            <TableCell>
                              <Skeleton variant="text" width={100} />
                            </TableCell>
                            <TableCell>
                              <Skeleton variant="circular" width={24} height={24} />
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </>
                )}
                {videosToDisplay
                  .slice((page - 1) * videosPerPage, page * videosPerPage)
                  .map((video) => {
                    const isMembersOnly = video.availability === 'subscriber_only';
                    const status = getVideoStatus(video);
                    const rowSx = {
                      opacity: isMembersOnly ? 0.6 : 1,
                      backgroundColor: status === 'missing' ? 'rgba(255, 152, 0, 0.05)' : 'inherit'
                    };
                    return (
                    isMobile ? (
                      <TableRow
                        key={video.youtube_id}
                        sx={rowSx}
                      >
                        <TableCell>
                          <img
                            style={{ maxWidth: '200px' }}
                            src={video.thumbnail}
                            alt={`Thumbnail for video ${video.title}`}
                          />
                          <Typography variant='subtitle1'>
                            {decodeHtml(video.title)}
                            <Typography
                              variant='caption'
                              color='text.secondary'
                            >
                              ({formatDuration(video.duration)})
                            </Typography>
                          </Typography>
                          <span>
                            {new Date(video.publishedAt).toLocaleDateString()}
                          </span>
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const status = getVideoStatus(video);

                            switch (status) {
                              case 'members_only':
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                      Members Only
                                    </Typography>
                                    {getInfoIcon('Unable to download Members Only/Subscribers Only videos')}
                                  </Box>
                                );

                              case 'downloaded':
                                return (
                                  <Tooltip title="Video downloaded and available" enterTouchDelay={0}>
                                    <CheckCircleIcon
                                      color='success'
                                      style={{ marginLeft: '8px' }}
                                    />
                                  </Tooltip>
                                );

                              case 'missing':
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 0.5 }}>
                                    <Tooltip title="Video was downloaded but is now missing (deleted, moved, or renamed)" enterTouchDelay={0}>
                                      <CloudOffIcon
                                        color='warning'
                                        fontSize="small"
                                      />
                                    </Tooltip>
                                    <Checkbox
                                      size="small"
                                      checked={checkedBoxes.includes(video.youtube_id)}
                                      onChange={(e) =>
                                        handleCheckChange(
                                          video.youtube_id,
                                          e.target.checked
                                        )
                                      }
                                    />
                                  </Box>
                                );

                              case 'never_downloaded':
                              default:
                                return (
                                  <Checkbox
                                    checked={checkedBoxes.includes(video.youtube_id)}
                                    onChange={(e) =>
                                      handleCheckChange(
                                        video.youtube_id,
                                        e.target.checked
                                      )
                                    }
                                  />
                                );
                            }
                          })()}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow
                        key={video.youtube_id}
                        sx={rowSx}
                      >
                        <TableCell>
                          <img
                            style={{ maxWidth: '200px' }}
                            src={video.thumbnail}
                            alt={`Thumbnail for video ${video.title}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='subtitle1'>
                            {decodeHtml(video.title)}{' '}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            ({formatDuration(video.duration)})
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {new Date(video.publishedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const status = getVideoStatus(video);

                            switch (status) {
                              case 'members_only':
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                      Members Only
                                    </Typography>
                                    {getInfoIcon('Unable to download Members Only/Subscribers Only videos')}
                                  </Box>
                                );

                              case 'downloaded':
                                return (
                                  <Tooltip title="Video downloaded and available" enterTouchDelay={0}>
                                    <CheckCircleIcon
                                      color='success'
                                      style={{ marginLeft: '8px' }}
                                    />
                                  </Tooltip>
                                );

                              case 'missing':
                                return (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Tooltip title="Video was downloaded but is now missing (deleted, moved, or renamed)" enterTouchDelay={0}>
                                      <CloudOffIcon
                                        color='warning'
                                      />
                                    </Tooltip>
                                    <Checkbox
                                      checked={checkedBoxes.includes(video.youtube_id)}
                                      onChange={(e) =>
                                        handleCheckChange(
                                          video.youtube_id,
                                          e.target.checked
                                        )
                                      }
                                    />
                                  </Box>
                                );

                              case 'never_downloaded':
                              default:
                                return (
                                  <Checkbox
                                    checked={checkedBoxes.includes(video.youtube_id)}
                                    onChange={(e) =>
                                      handleCheckChange(
                                        video.youtube_id,
                                        e.target.checked
                                      )
                                    }
                                  />
                                );
                            }
                          })()}
                        </TableCell>
                      </TableRow>
                    )
                  );})}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </div>

      <Snackbar
        open={mobileTooltip !== null}
        autoHideDuration={8000}
        onClose={() => setMobileTooltip(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setMobileTooltip(null)}
          severity="info"
          icon={<InfoIcon />}
        >
          {mobileTooltip}
        </Alert>
      </Snackbar>

      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={handleDownloadCancel}
        onConfirm={handleDownloadConfirm}
        videoCount={checkedBoxes.length}
        missingVideoCount={getMissingVideoCount()}
        mode="manual"
      />
    </Card>
  );
}

export default ChannelVideos;
