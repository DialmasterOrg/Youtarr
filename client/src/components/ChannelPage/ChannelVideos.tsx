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
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';

interface ChannelVideosProps {
  token: string | null;
}

function ChannelVideos({ token }: ChannelVideosProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = useState(1);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [videoFailed, setVideoFailed] = useState<Boolean>(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]); // new state variable
  const [hideDownloaded, setHideDownloaded] = useState(false);
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

  const downloadChecked = async () => {
    // Start downloading the checked videos
    await fetch('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
      },
      body: JSON.stringify({ urls: checkedBoxes }),
    });
    // Navigate to the Manage Downloads page
    navigate('/downloads');
  };

  const resetChecked = () => {
    setCheckedBoxes([]);
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
        setLastFetched(data.lastFetched ? new Date(data.lastFetched) : null);
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
    // Filter out shorts (videos 70 seconds or less)
    if (video.duration <= 70) {
      return false;
    }
    // Filter out downloaded videos if hideDownloaded is enabled
    return hideDownloaded ? !video.added : true;
  });

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

  // Calculate data freshness
  const getDataFreshnessInfo = () => {
    if (!lastFetched) return null;
    
    const hoursAgo = Math.floor((Date.now() - lastFetched.getTime()) / (1000 * 60 * 60));
    let color: 'success' | 'warning' | 'error' = 'success';
    let text = '';
    
    if (hoursAgo < 1) {
      text = 'Updated just now';
    } else if (hoursAgo < 6) {
      text = `Updated ${hoursAgo} hour${hoursAgo > 1 ? 's' : ''} ago`;
      color = 'success';
    } else if (hoursAgo < 24) {
      text = `Updated ${hoursAgo} hours ago`;
      color = 'warning';
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      text = `Updated ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
      color = 'error';
    }
    
    return { text, color };
  };

  const freshnessInfo = getDataFreshnessInfo();

  return (
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardHeader 
        title='Recent Channel Videos' 
        align='center'
        action={
          freshnessInfo && videos.length > 0 && (
            <Chip 
              label={freshnessInfo.text}
              color={freshnessInfo.color}
              size="small"
              style={{ marginRight: '8px' }}
            />
          )
        }
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
          <Button
            onClick={downloadChecked}
            variant='contained'
            disabled={checkedBoxes.length === 0}
            style={{ marginTop: '8px', marginLeft: '8px', marginRight: '8px' }}
          >
            Download New Videos{' '}
            {checkedBoxes.length ? `(${checkedBoxes.length})` : ''}
          </Button>
          <Button
            variant='contained'
            disabled={checkedBoxes.length === 0}
            onClick={resetChecked}
            style={{ marginTop: '8px', marginLeft: '8px', marginRight: '8px' }}
          >
            Undo
          </Button>
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
                  <TableRow>
                    <TableCell colSpan={5} align='center'>
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {videosToDisplay
                  .slice((page - 1) * videosPerPage, page * videosPerPage)
                  .map((video) =>
                    isMobile ? (
                      <TableRow key={video.youtube_id}>
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
                          {video.added ? (
                            <CheckCircleIcon
                              color='success'
                              style={{ marginLeft: '8px' }}
                            />
                          ) : (
                            <Checkbox
                              checked={checkedBoxes.includes(video.youtube_id)}
                              onChange={(e) =>
                                handleCheckChange(
                                  video.youtube_id,
                                  e.target.checked
                                )
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={video.youtube_id}>
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
                          {video.added ? (
                            <CheckCircleIcon
                              color='success'
                              style={{ marginLeft: '8px' }}
                            />
                          ) : (
                            <Checkbox
                              checked={checkedBoxes.includes(video.youtube_id)}
                              onChange={(e) =>
                                handleCheckChange(
                                  video.youtube_id,
                                  e.target.checked
                                )
                              }
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </div>
    </Card>
  );
}

export default ChannelVideos;
