import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../utils';
import { VideoData } from '../types/VideoData';
import { useSwipeable } from 'react-swipeable';

interface VideosPageProps {
  token: string | null;
}

function VideosPage({ token }: VideosPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [page, setPage] = useState(1);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>(
    {}
  );

  const handleImageError = (youtubeId: string) => {
    setImageErrors((prevState) => ({ ...prevState, [youtubeId]: true }));
  };

  useEffect(() => {
    if (token) {
      axios
        .get('/getVideos', {
          headers: {
            'x-access-token': token,
          },
        })
        .then((response) => {
          setVideos(response.data);
        });
    }
  }, [token]);

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setPage(value);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (page < Math.ceil(videos.length / videosPerPage)) {
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

  const videosPerPage = isMobile ? 6 : 12;

  return (
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardContent>
        <Typography
          variant={isMobile ? 'h6' : 'h5'}
          component='h2'
          gutterBottom
          align='center'
        >
          Videos
        </Typography>
        <Grid
          container
          spacing={2}
          justifyContent='center'
          style={{ marginTop: '8px', marginBottom: '8px' }}
        >
          <Pagination
            count={Math.ceil(videos.length / videosPerPage)}
            page={page}
            onChange={handlePageChange}
          />
        </Grid>

        <TableContainer component={Paper}>
          <div {...handlers}>
            <Table>
              {isMobile ? (
                <></>
              ) : (
                <TableHead>
                  <TableRow>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Thumbnail
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Channel
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Video Information
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Added
                    </TableCell>
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {videos
                  .slice((page - 1) * videosPerPage, page * videosPerPage)
                  .map((video) => (
                    <TableRow key={video.id}>
                      {isMobile ? (
                        <TableCell>
                          <Box
                            display='flex'
                            flexDirection='column'
                            alignItems='center'
                            justifyContent='center'
                          >
                            <Box
                              width='100%'
                              height='0'
                              paddingTop='56.25%' // maintain 16:9 aspect ratio
                              border={1}
                              borderColor='grey.500'
                              overflow='hidden'
                              position='relative'
                            >
                              {imageErrors[video.youtubeId] ? (
                                <Typography variant='caption'>
                                  No video
                                </Typography>
                              ) : (
                                <img
                                  src={`/images/videothumb-${video.youtubeId}.jpg`}
                                  alt='thumbnail'
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                  }}
                                  onError={() =>
                                    handleImageError(video.youtubeId)
                                  }
                                />
                              )}
                            </Box>
                            <Typography variant='subtitle1'>
                              {video.youTubeVideoName}
                            </Typography>
                            <Typography
                              variant='subtitle2'
                              color='text.secondary'
                            >
                              {video.youTubeChannelName}
                            </Typography>
                            {video.duration && (
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                {formatDuration(video.duration)}
                              </Typography>
                            )}
                            <Typography
                              variant='caption'
                              color='text.secondary'
                            >
                              Added:
                              {new Date(
                                video.timeCreated
                              ).toLocaleDateString() +
                                ' ' +
                                new Date(video.timeCreated).toLocaleTimeString(
                                  [],
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                            </Typography>
                          </Box>
                        </TableCell>
                      ) : (
                        <>
                          <TableCell>
                            <Box
                              width={256}
                              height={144}
                              border={1}
                              borderColor='grey.500'
                              display='flex'
                              alignItems='center'
                              justifyContent='center'
                            >
                              {imageErrors[video.youtubeId] ? (
                                <Typography variant='caption'>
                                  No thumbnail
                                </Typography>
                              ) : (
                                <img
                                  src={`/images/videothumb-${video.youtubeId}.jpg`}
                                  alt='thumbnail'
                                  width='256'
                                  height='144'
                                  onError={() =>
                                    handleImageError(video.youtubeId)
                                  }
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell style={{ fontSize: 'medium' }}>
                            {video.youTubeChannelName}
                          </TableCell>
                          <TableCell style={{ fontSize: 'medium' }}>
                            <Typography variant='subtitle1'>
                              {video.youTubeVideoName}
                            </Typography>
                            {video.duration && (
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                Duration: {formatDuration(video.duration)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(video.timeCreated).toLocaleDateString() +
                              ' ' +
                              new Date(video.timeCreated).toLocaleTimeString(
                                [],
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
              </TableBody>{' '}
            </Table>
          </div>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default VideosPage;
