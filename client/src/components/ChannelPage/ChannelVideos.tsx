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
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';

interface ChannelVideosProps {
  token: string | null;
}

function ChannelVideos({ token }: ChannelVideosProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [page, setPage] = useState(1);
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const { channel_id } = useParams();

  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>(
    {}
  );

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
        setVideos(data);
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

      <CardContent>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
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
            </TableHead>
            <TableBody>
              {videos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align='center'>
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {videos
                .slice((page - 1) * videosPerPage, page * videosPerPage)
                .map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      <img
                        style={{ maxWidth: '140px' }}
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
                      <Checkbox checked={video.added} />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

export default ChannelVideos;
