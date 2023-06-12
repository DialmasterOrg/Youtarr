import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  Tab,
  Checkbox,
  CardHeader,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../utils';
import { Channel } from '../types/Channel';
import { ChannelVideo } from '../types/ChannelVideo';

interface ChannelPageProps {
  token: string | null;
}

function ChannelPage({ token }: ChannelPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [channel, setChannel] = useState<Channel | null>(null);
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
    fetch(`/getChannelInfo/${channel_id}`, {
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
      .then((data) => setChannel(data))
      .catch((error) => console.error(error));

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

  const videosPerPage = isMobile ? 6 : 12;

  function textToHTML(text: string) {
    return text

      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
      .replace(/(?:\r\n|\r|\n)/g, '<br />'); // replace newlines with <br />
  }

  return (
    <>
      <Card elevation={8} style={{ marginBottom: '16px' }}>
        <CardContent>
          <Grid container spacing={3} justifyContent='center'>
            <Grid item xs={4}>
              <img
                src={channel ? `/images/channelthumb-${channel_id}.jpg` : ''}
                alt='Channel thumbnail'
                width='100%'
              />
            </Grid>
            <Grid item xs={8}>
              <Typography
                variant={isMobile ? 'h6' : 'h4'}
                component='h2'
                gutterBottom
                align='center'
              >
                {channel ? channel.uploader : 'Loading...'}
              </Typography>
              <Typography variant='body1' gutterBottom align='center'>
                {channel ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: textToHTML(channel.description || ''),
                    }}
                  />
                ) : (
                  'Loading...'
                )}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card elevation={8} style={{ marginBottom: '16px' }}>
        <CardHeader title='Videos' align='center' />
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
                {videos.map((video, index) => (
                  <TableRow key={index}>
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
    </>
  );
}

export default ChannelPage;
