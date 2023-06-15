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
  IconButton,
  Button,
  TableSortLabel,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import FilterListIcon from '@mui/icons-material/FilterList';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration, formatYTDate } from '../utils';
import { VideoData } from '../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import FilterMenu from './VideosPage/FilterMenu';

interface VideosPageProps {
  token: string | null;
}

function VideosPage({ token }: VideosPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<'published' | 'added'>('added');

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

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (
    event: React.MouseEvent<HTMLElement>,
    value: string
  ) => {
    setFilter(value);
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const filteredVideos = videos.filter((video) =>
    video.youTubeChannelName.includes(filter)
  );

  const sortedVideos = React.useMemo(() => {
    const compare = (a: VideoData, b: VideoData) => {
      if (orderBy === 'published') {
        const dateA = a.originalDate || new Date(0); // default to Jan 1, 1970
        const dateB = b.originalDate || new Date(0); // default to Jan 1, 1970
        return dateA > dateB ? 1 : -1;
      }
      return a.timeCreated > b.timeCreated ? 1 : -1;
    };

    const sortedVideos = [...filteredVideos].sort(compare);
    return sortOrder === 'asc' ? sortedVideos : sortedVideos.reverse();
  }, [filteredVideos, sortOrder, orderBy]);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (page < Math.ceil(filteredVideos.length / videosPerPage)) {
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

  const uniqueChannels = Array.from(
    new Set(
      videos
        .map((video) => video.youTubeChannelName)
        .sort((a, b) => a.localeCompare(b))
    )
  );

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
          Downloaded Videos
        </Typography>
        {isMobile && (
          <Box display='flex' justifyContent='center' mb={2}>
            <Button
              variant='outlined'
              startIcon={<FilterListIcon />}
              onClick={handleFilterClick}
            >
              Filter by Channel
            </Button>
            <FilterMenu
              anchorEl={anchorEl}
              handleClose={handleClose}
              handleMenuItemClick={handleMenuItemClick}
              filter={filter}
              uniqueChannels={uniqueChannels}
            />
          </Box>
        )}

        <Grid
          container
          spacing={2}
          justifyContent='center'
          style={{ marginTop: '8px', marginBottom: '8px' }}
        >
          <Pagination
            count={Math.ceil(filteredVideos.length / videosPerPage)}
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
                      <IconButton onClick={handleFilterClick}>
                        <FilterListIcon />
                      </IconButton>
                      <FilterMenu
                        anchorEl={anchorEl}
                        handleClose={handleClose}
                        handleMenuItemClick={handleMenuItemClick}
                        filter={filter}
                        uniqueChannels={uniqueChannels}
                      />
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Video Information
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                      sortDirection={
                        orderBy === 'published' ? sortOrder : false
                      }
                    >
                      <TableSortLabel
                        active={orderBy === 'published'}
                        direction={orderBy === 'published' ? sortOrder : 'asc'}
                        onClick={() => {
                          const isAsc =
                            orderBy === 'published' && sortOrder === 'asc';
                          setSortOrder(isAsc ? 'desc' : 'asc');
                          setOrderBy('published');
                        }}
                      >
                        Published
                      </TableSortLabel>
                    </TableCell>

                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                      sortDirection={orderBy === 'added' ? sortOrder : false}
                    >
                      <TableSortLabel
                        active={orderBy === 'added'}
                        direction={orderBy === 'added' ? sortOrder : 'asc'}
                        onClick={() => {
                          const isAsc =
                            orderBy === 'added' && sortOrder === 'asc';
                          setSortOrder(isAsc ? 'desc' : 'asc');
                          setOrderBy('added');
                        }}
                      >
                        Added
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {sortedVideos
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
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    textAlign: 'center',
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Typography variant='caption'>
                                    No thumbnail available
                                  </Typography>
                                </Box>
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
                            <Typography variant='subtitle1' textAlign='center'>
                              {video.youTubeVideoName}
                              {video.duration && (
                                <Typography
                                  variant='caption'
                                  color='text.secondary'
                                >
                                  {' '}
                                  ({formatDuration(video.duration)})
                                </Typography>
                              )}
                            </Typography>
                            <Typography
                              variant='subtitle2'
                              color='text.secondary'
                            >
                              {video.youTubeChannelName}
                            </Typography>

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
                            <Typography
                              variant='caption'
                              color='text.secondary'
                            >
                              Published:
                              {formatYTDate(video.originalDate)}
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
                            {formatYTDate(video.originalDate)}
                          </TableCell>

                          <TableCell>
                            {new Date(video.timeCreated).toLocaleDateString()}
                            <br />
                            {new Date(video.timeCreated).toLocaleTimeString(
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
              </TableBody>
            </Table>
          </div>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default VideosPage;
