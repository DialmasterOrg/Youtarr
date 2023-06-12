import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, Grid, Typography } from '@mui/material';
import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Channel } from '../types/Channel';
import ChannelVideos from './ChannelPage/ChannelVideos';

interface ChannelPageProps {
  token: string | null;
}

function ChannelPage({ token }: ChannelPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [channel, setChannel] = useState<Channel | null>(null);
  const { channel_id } = useParams();

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
  }, [token]);

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

      <ChannelVideos token={token} />
    </>
  );
}

export default ChannelPage;
