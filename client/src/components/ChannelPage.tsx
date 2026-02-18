import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, Grid, Typography, Box, IconButton, Tooltip, Chip, Popover, Dialog, DialogTitle, DialogContent } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import VideocamIcon from '@mui/icons-material/Videocam';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RatingBadge from './shared/RatingBadge';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Channel } from '../types/Channel';
import ChannelVideos from './ChannelPage/ChannelVideos';
import ChannelSettingsDialog from './ChannelPage/ChannelSettingsDialog';
import { isUsingDefaultSubfolder, isExplicitlyNoSubfolder } from '../utils/channelHelpers';

interface ChannelPageProps {
  token: string | null;
}

function ChannelPage({ token }: ChannelPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [regexAnchorEl, setRegexAnchorEl] = useState<HTMLElement | null>(null);
  const [regexDialogOpen, setRegexDialogOpen] = useState(false);
  const { channel_id } = useParams();

  const handleSettingsSaved = (updated: {
    sub_folder: string | null;
    video_quality: string | null;
    audio_format: string | null;
    min_duration: number | null;
    max_duration: number | null;
    title_filter_regex: string | null;
  }) => {
    setChannel((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        sub_folder: updated.sub_folder,
        video_quality: updated.video_quality,
        audio_format: updated.audio_format,
        min_duration: updated.min_duration,
        max_duration: updated.max_duration,
        title_filter_regex: updated.title_filter_regex,
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
    let displayText: string;
    let isSpecial = false;

    if (isExplicitlyNoSubfolder(subFolder)) {
      // null/empty = root (backwards compatible)
      displayText = 'root';
      isSpecial = true;
    } else if (isUsingDefaultSubfolder(subFolder)) {
      // ##USE_GLOBAL_DEFAULT## = use global default
      displayText = 'global default';
      isSpecial = true;
    } else {
      // Specific subfolder
      displayText = `__${subFolder}/`;
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FolderIcon sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'text.secondary' }} />
        <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', fontStyle: isSpecial ? 'italic' : 'normal' }}>
          {displayText}
        </Typography>
      </Box>
    );
  };

  const handleRegexClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isMobile) {
      setRegexDialogOpen(true);
    } else {
      setRegexAnchorEl(event.currentTarget);
    }
  };

  const handleRegexClose = () => {
    setRegexAnchorEl(null);
    setRegexDialogOpen(false);
  };

  const formatDuration = (minSeconds: number | null | undefined, maxSeconds: number | null | undefined) => {
    const minMinutes = minSeconds ? Math.floor(minSeconds / 60) : null;
    const maxMinutes = maxSeconds ? Math.floor(maxSeconds / 60) : null;

    if (minMinutes && maxMinutes) {
      return `${minMinutes}-${maxMinutes} min`;
    } else if (minMinutes) {
      return `≥${minMinutes} min`;
    } else if (maxMinutes) {
      return `≤${maxMinutes} min`;
    }
    return '';
  };

  const renderFilterIndicators = () => {
    if (!channel) return null;

    const hasQualityOverride = channel.video_quality;
    const hasDurationFilter = channel.min_duration || channel.max_duration;
    const hasRegexFilter = channel.title_filter_regex;
    const hasDefaultRating = channel.default_rating && channel.default_rating !== 'NR';

    if (!hasQualityOverride && !hasDurationFilter && !hasRegexFilter && !hasDefaultRating) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', marginBottom: 0.5, alignItems: 'center' }}>
        {hasDefaultRating && (
          <RatingBadge
            rating={channel.default_rating}
            ratingSource="Channel Setting"
            size="small"
            sx={{
              fontWeight: 'bold',
              fontSize: isMobile ? '0.65rem' : '0.75rem',
              height: isMobile ? '20px' : '24px'
            }}
          />
        )}

        {hasQualityOverride && (
          <Tooltip title={`Auto-download quality override: ${channel.video_quality}p`}>
            <Chip
              icon={<VideocamIcon />}
              label={`${channel.video_quality}p`}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', height: isMobile ? '20px' : '24px' }}
            />
          </Tooltip>
        )}

        {hasDurationFilter && (
          <Tooltip title={`Duration filter: ${formatDuration(channel.min_duration, channel.max_duration)}`}>
            <Chip
              icon={<AccessTimeIcon />}
              label={formatDuration(channel.min_duration, channel.max_duration)}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', height: isMobile ? '20px' : '24px' }}
            />
          </Tooltip>
        )}

        {hasRegexFilter && (
          <Tooltip title="Title regex filter (click to view pattern)">
            <Chip
              icon={<FilterAltIcon />}
              label="Title Filter"
              size="small"
              variant="outlined"
              color="primary"
              onClick={handleRegexClick}
              sx={{
                fontSize: isMobile ? '0.65rem' : '0.75rem',
                height: isMobile ? '20px' : '24px',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                }
              }}
            />
          </Tooltip>
        )}

        {/* Popover for desktop */}
        {!isMobile && (
          <Popover
            open={Boolean(regexAnchorEl)}
            anchorEl={regexAnchorEl}
            onClose={handleRegexClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <Box sx={{ p: 2, maxWidth: 400 }}>
              <Typography variant="subtitle2" gutterBottom>
                Title Filter Regex Pattern:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  bgcolor: 'action.hover',
                  p: 1,
                  borderRadius: 1,
                  wordBreak: 'break-all',
                }}
              >
                {channel.title_filter_regex}
              </Typography>
            </Box>
          </Popover>
        )}

        {/* Dialog for mobile */}
        {isMobile && (
          <Dialog open={regexDialogOpen} onClose={handleRegexClose} fullWidth maxWidth="sm">
            <DialogTitle>Title Filter Regex Pattern</DialogTitle>
            <DialogContent>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  bgcolor: 'action.hover',
                  p: 1,
                  borderRadius: 1,
                  wordBreak: 'break-all',
                  mt: 1,
                }}
              >
                {channel.title_filter_regex}
              </Typography>
            </DialogContent>
          </Dialog>
        )}
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
                <Box
                  component="img"
                  src={channel ? `/images/channelthumb-${channel_id}.jpg` : ''}
                  alt='Channel thumbnail'
                  width={isMobile ? '100%' : 'auto'}
                  height={isMobile ? 'auto' : '285px'}
                  sx={{ border: 1, borderColor: 'divider' }}
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
                  <Tooltip title="Channel Settings">
                    <IconButton
                      onClick={() => setSettingsOpen(true)}
                      size={isMobile ? 'small' : 'medium'}
                      sx={{ mb: 1 }}
                    >
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {channel && (
                <Box display="flex" justifyContent="center" flexDirection="column" alignItems="center">
                  <Box display="flex" gap={0.5} flexWrap="wrap" justifyContent="center" alignItems="center">
                    {renderSubFolder(channel.sub_folder)}
                    {renderFilterIndicators()}
                  </Box>
                </Box>
              )}
              <Box
                sx={{
                  maxHeight: isMobile ? '84px' : '172px',
                  minHeight: isMobile ? '16px' : '172px',
                  overflowY: 'scroll',
                  border: 1,
                  borderColor: 'divider',
                  padding: isMobile ? '12px' : '24px',
                  borderRadius: 1
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
        channelAudioFormat={channel?.audio_format || null}
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
