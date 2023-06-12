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
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { useNavigate } from 'react-router-dom';
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
  const { channel_id } = useParams();

  const navigate = useNavigate();

  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>(
    {}
  );
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
        setVideos(data.videos);
        setVideoFailed(data.videoFail);
      })
      .catch((error) => console.error(error));
  }, [token]);

  const handleImageError = (youtubeId: string) => {
    setImageErrors((prevState) => ({ ...prevState, [youtubeId]: true }));
  };

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setPage(value);
  };

  const videosPerPage = isMobile ? 8 : 16;

  return (
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardHeader title='Videos' align='center' />
      {!videoFailed && (
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
                  <TableCell style={{ fontWeight: 'bold', fontSize: 'medium' }}>
                    Added?
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell style={{ fontWeight: 'bold', fontSize: 'medium' }}>
                    Thumbnail
                  </TableCell>
                  <TableCell style={{ fontWeight: 'bold', fontSize: 'medium' }}>
                    Title
                  </TableCell>
                  <TableCell style={{ fontWeight: 'bold', fontSize: 'medium' }}>
                    Date Published
                  </TableCell>
                  <TableCell style={{ fontWeight: 'bold', fontSize: 'medium' }}>
                    Duration
                  </TableCell>
                  <TableCell style={{ fontWeight: 'bold', fontSize: 'medium' }}>
                    Added?
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
              {videoFailed && (
                <TableRow>
                  <TableCell colSpan={5} align='center'>
                    Youtube Data Request Failed
                  </TableCell>
                </TableRow>
              )}
              {videos
                .slice((page - 1) * videosPerPage, page * videosPerPage)
                .map((video) =>
                  isMobile ? (
                    <TableRow key={video.id}>
                      <TableCell>
                        <img
                          style={{ maxWidth: '200px' }}
                          src={video.thumbnail}
                          onError={() => handleImageError(video.id)}
                          alt={`Thumbnail for video ${video.title}`}
                        />
                        <div>{decodeHtml(video.title)}</div>
                        {formatDuration(video.duration)}
                        <div>
                          {new Date(video.publishedAt).toLocaleDateString()}
                        </div>
                      </TableCell>

                      <TableCell>
                        {video.added ? (
                          <CheckCircleIcon
                            color='success'
                            style={{ marginLeft: '8px' }}
                          />
                        ) : (
                          <Checkbox
                            checked={checkedBoxes.includes(video.id)}
                            onChange={(e) =>
                              handleCheckChange(video.id, e.target.checked)
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={video.id}>
                      <TableCell>
                        <img
                          style={{ maxWidth: '200px' }}
                          src={video.thumbnail}
                          onError={() => handleImageError(video.id)}
                          alt={`Thumbnail for video ${video.title}`}
                        />
                      </TableCell>
                      <TableCell>{decodeHtml(video.title)}</TableCell>
                      <TableCell>
                        {new Date(video.publishedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{formatDuration(video.duration)}</TableCell>
                      <TableCell>
                        {video.added ? (
                          <CheckCircleIcon
                            color='success'
                            style={{ marginLeft: '8px' }}
                          />
                        ) : (
                          <Checkbox
                            checked={checkedBoxes.includes(video.id)}
                            onChange={(e) =>
                              handleCheckChange(video.id, e.target.checked)
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                )}{' '}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default ChannelVideos;
