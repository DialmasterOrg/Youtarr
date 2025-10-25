import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, Grid, Typography, Box, IconButton, Tooltip } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Channel } from '../types/Channel';
import ChannelVideos from './ChannelPage/ChannelVideos';
import ChannelSettingsDialog from './ChannelPage/ChannelSettingsDialog';

interface ChannelPageProps {
  token: string | null;
}

function ChannelPage({ token }: ChannelPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { channel_id } = useParams();

  const handleSettingsSaved = (updated: { sub_folder: string | null; video_quality: string | null }) => {
    setChannel((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        sub_folder: updated.sub_folder,
        video_quality: updated.video_quality,
      };
    });
  };

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

  const renderSubFolder = (subFolder: string | null | undefined) => {
    const displayText = subFolder ? `__${subFolder}/` : 'default';
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FolderIcon sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary' }} />
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: subFolder ? '#555' : '#888', fontStyle: subFolder ? 'normal' : 'italic' }}>
          {displayText}
        </Typography>
      </Box>
    );
  };

  return (
    <>
      <Card elevation={8} style={{ marginBottom: '16px' }}>
        <CardContent>
          <Grid container spacing={3} justifyContent='center'>
            <Grid item xs={12} sm={4}
              display="flex" alignItems="center"
              marginLeft={isMobile ? 'auto' : '-32px'}>
              <Box
                paddingX={isMobile ? '0px' : 3}
                maxWidth={isMobile ? '75%' : 'auto'}
                marginX={isMobile ? 'auto' : 3}>
                <img
                  src={channel ? `/images/channelthumb-${channel_id}.jpg` : ''}
                  alt='Channel thumbnail'
                  width={isMobile ? '100%' : 'auto'}
                  height={isMobile ? 'auto' : '285px'}
                  style={{ border: '1px solid grey' }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={8} marginTop={isMobile ? '-16px' : '0px'}>
              <Box display="flex" justifyContent="center" alignItems="center" gap={1}>
                <Typography
                  variant={isMobile ? 'h5' : 'h4'}
                  component='h2'
                  gutterBottom
                  align='center'
                  sx={{ mb: 0 }}
                >
                  {channel ? channel.uploader : 'Loading...'}
                </Typography>
                {channel && (
                  <>
                    <Tooltip title="Channel Settings">
                      <IconButton
                        onClick={() => setSettingsOpen(true)}
                        size={isMobile ? 'small' : 'medium'}
                        sx={{ mb: 1 }}
                      >
                        <SettingsIcon />
                      </IconButton>
                    </Tooltip>
                    {renderSubFolder(channel.sub_folder)}
                  </>
                )}
              </Box>
              <Box
                sx={{
                  maxHeight: isMobile ? '96px' : '184px',
                  minHeight: isMobile ? '16px' : '184px',
                  overflowY: 'scroll',
                  border: '1px solid grey',
                  padding: isMobile ? '12px' : '24px',
                  borderRadius: '4px'
                }}
              >
                <Typography variant={isMobile ? 'body2' : 'body1'} align='center' color='text.secondary'>
                  {channel ? (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: textToHTML(channel.description || '** No description available **'),
                      }}
                    />
                  ) : (
                    'Loading...'
                  )}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <ChannelVideos
        token={token}
        channelAutoDownloadTabs={channel?.auto_download_enabled_tabs}
        channelId={channel_id || undefined}
        channelVideoQuality={channel?.video_quality || null}
      />

      {channel && channel_id && (
        <ChannelSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          channelId={channel_id}
          channelName={channel.uploader}
          token={token}
          onSettingsSaved={handleSettingsSaved}
        />
      )}
    </>
  );
}

export default ChannelPage;
