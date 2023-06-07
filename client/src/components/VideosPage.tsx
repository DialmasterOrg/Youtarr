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

interface VideosPageProps {
  token: string | null;
}

interface Video {
  id: number;
  youtubeId: string;
  youTubeChannelName: string;
  youTubeVideoName: string;
  timeCreated: string;
}

function VideosPage({ token }: VideosPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [videos, setVideos] = useState<Video[]>([]);
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

  const videosPerPage = isMobile ? 5 : 15;

  return (
    <Card elevation={8}>
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
          style={{ marginTop: '8px' }}
        >
          <Pagination
            count={Math.ceil(videos.length / videosPerPage)}
            page={page}
            onChange={handlePageChange}
          />
        </Grid>

        <TableContainer component={Paper}>
          <Table>
            {isMobile ? (
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
            ) : (
              <TableHead>
                <TableRow>
                  <TableCell>Thumbnail</TableCell>
                  <TableCell>Channel Name</TableCell>
                  <TableCell>Video Title</TableCell>
                  <TableCell>Added</TableCell>
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
                          <Typography variant='caption' color='text.secondary'>
                            {new Date(video.timeCreated).toLocaleString()}
                          </Typography>
                        </Box>
                      </TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <Box
                            width={160}
                            height={90}
                            border={1}
                            borderColor='grey.500'
                            display='flex'
                            alignItems='center'
                            justifyContent='center'
                          >
                            {imageErrors[video.youtubeId] ? (
                              <Typography variant='caption'>
                                No video
                              </Typography>
                            ) : (
                              <img
                                src={`/images/videothumb-${video.youtubeId}.jpg`}
                                alt='thumbnail'
                                width='160'
                                height='90'
                                onError={() =>
                                  handleImageError(video.youtubeId)
                                }
                              />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{video.youTubeChannelName}</TableCell>
                        <TableCell>{video.youTubeVideoName}</TableCell>
                        <TableCell>
                          {new Date(video.timeCreated).toLocaleString()}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
            </TableBody>{' '}
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default VideosPage;
