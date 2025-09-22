import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, Grid, Typography, Button, Tabs, Tab, Box } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Channel } from '../types/Channel';
import ChannelVideos from './ChannelPage/ChannelVideos';
import ChannelProfileManager from './ChannelProfiles/ChannelProfileManager';
import KeyboardDoubleArrowLeft from '@mui/icons-material/KeyboardDoubleArrowLeft';
import { VideoLibrary, Settings } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ChannelPageProps {
  token: string | null;
}

// * If you do not have a youtube API key set, just don't show the ChannelVideos section at all
function ChannelPage({ token }: ChannelPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const { channel_id } = useParams();
  const navigate = useNavigate();

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
  }, [token, channel_id]);

  function textToHTML(text: string) {
    return text

      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
      .replace(/(?:\r\n|\r|\n)/g, '<br />'); // replace newlines with <br />
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <>
      <Grid
        container
        justifyContent='center'
        style={{ marginBottom: '16px', marginTop: '-8px' }}
      >
        <Button onClick={() => navigate(-1)}>
          <KeyboardDoubleArrowLeft />
          Back To Channels Page
        </Button>
      </Grid>
      <Card elevation={8} style={{ marginBottom: '16px' }}>
        <CardContent>
          <Grid container spacing={3} justifyContent='center'>
            <Grid item xs={12} sm={4}>
              <img
                src={channel ? `/images/channelthumb-${channel_id}.jpg` : ''}
                alt='Channel thumbnail'
                width='100%'
                style={{ border: '1px solid black' }}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
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
                  <span
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

      {/* Tabs for channel content */}
      <Card elevation={8}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth">
          <Tab icon={<VideoLibrary />} label="Videos" />
          <Tab icon={<Settings />} label="Series Configuration" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tabValue === 0 && (
            <ChannelVideos token={token} />
          )}
          {tabValue === 1 && channel?.db_id && (
            <ChannelProfileManager
              channelId={channel.db_id}
              token={token || ''}
            />
          )}
          {tabValue === 1 && !channel?.db_id && (
            <Typography color="textSecondary" align="center">
              Channel information is loading...
            </Typography>
          )}
        </Box>
      </Card>
    </>
  );
}

export default ChannelPage;
