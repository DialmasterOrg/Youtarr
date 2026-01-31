import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, Grid, Typography, Box, Tooltip, Chip, Popover, Dialog, DialogTitle, DialogContent, Button } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import VideocamIcon from '@mui/icons-material/Videocam';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme } from '@mui/material/styles';
import { Channel } from '../types/Channel';
import RatingBadge from './shared/RatingBadge';
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const { channel_id } = useParams();

  const handleSettingsSaved = (updated: {
    sub_folder: string | null;
    video_quality: string | null;
    audio_format: string | null;
    min_duration: number | null;
    max_duration: number | null;
    title_filter_regex: string | null;
    default_rating: string | null;
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
        default_rating: updated.default_rating,
      };
    });
  };

  useEffect(() => {
    fetch(`/getchannelinfo/${channel_id}`, {
      headers: {
        'x-access-token': token || '',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Unexpected response format');
        }
        return response.json();
      })
      .then((data) => setChannel(data))
      .catch((error) => console.error(error));
  }, [token, channel_id]);

  useEffect(() => {
    setDescriptionExpanded(false);
  }, [channel?.description]);

  function textToHTML(text: string) {
    return text

      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
      .replace(/(?:\r\n|\r|\n)/g, '<br />'); // replace newlines with <br />
  }

  const chipHeight = isMobile ? 22 : 26;
  const chipFontSize = isMobile ? '0.65rem' : '0.75rem';
  const channelChipSx = {
    height: chipHeight,
    fontSize: chipFontSize,
    borderRadius: 'var(--radius-ui)',
    boxShadow: 'none',
    textTransform: 'none',
    px: 1.25,
  } as const;

  const getSubFolderLabel = (subFolder: string | null | undefined) => {
    if (isExplicitlyNoSubfolder(subFolder)) {
      return { label: 'root', isSpecial: true };
    }
    if (isUsingDefaultSubfolder(subFolder)) {
      return { label: 'global default', isSpecial: true };
    }
    return { label: `__${subFolder}/`, isSpecial: false };
  };

  const renderSubFolder = () => {
    if (!channel) {
      return null;
    }
    const { label, isSpecial } = getSubFolderLabel(channel.sub_folder);
    return (
      <Chip
        icon={<FolderIcon sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }} />}
        label={label}
        size="small"
        variant="outlined"
        sx={{
          ...channelChipSx,
          fontStyle: isSpecial ? 'italic' : 'normal',
        }}
      />
    );
  };

  const renderAutoDownloadChips = () => {
    if (!channel) return null;
    const enabledTabs = channel.auto_download_enabled_tabs
      ? channel.auto_download_enabled_tabs.split(',').map((tab) => tab.trim())
      : [];

    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Chip
          label="Videos"
          size="small"
          variant={enabledTabs.includes('video') ? 'filled' : 'outlined'}
          color={enabledTabs.includes('video') ? 'success' : 'default'}
          sx={{
            ...channelChipSx,
          }}
        />
        <Chip
          label="Shorts"
          size="small"
          variant={enabledTabs.includes('short') ? 'filled' : 'outlined'}
          color={enabledTabs.includes('short') ? 'success' : 'default'}
          sx={{
            ...channelChipSx,
          }}
        />
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

  const renderFilterIndicators = ({ includeRating = true } = {}) => {
    if (!channel) return null;

    const hasQualityOverride = channel.video_quality;
    const hasDurationFilter = channel.min_duration || channel.max_duration;
    const hasRegexFilter = channel.title_filter_regex;
    const hasDefaultRating = channel.default_rating;

    if (!hasQualityOverride && !hasDurationFilter && !hasRegexFilter && !hasDefaultRating) {
      return null;
    }

    return (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {hasQualityOverride && (
          <Tooltip title={`Auto-download quality override: ${channel.video_quality}p`}>
            <Chip
              icon={<VideocamIcon />}
              label={`${channel.video_quality}p`}
              size="small"
              variant="outlined"
              color="primary"
              sx={{
                ...channelChipSx,
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                }
              }}
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
              sx={{
                ...channelChipSx,
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                }
              }}
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
                ...channelChipSx,
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                }
              }}
            />
          </Tooltip>
        )}

        {includeRating && hasDefaultRating && (
          <RatingBadge
            rating={channel.default_rating}
            ratingSource="Channel Default"
            size="small"
            sx={{ ...channelChipSx }}
          />
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
                  fontFamily: 'var(--font-body)',
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
                  fontFamily: 'var(--font-body)',
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

  const descriptionLimit = isMobile ? 320 : 600;
  const descriptionCollapsedHeight = isMobile ? 150 : 200;
  const trimmedDescription = channel?.description?.trim();
  const descriptionText = channel
    ? trimmedDescription || '** No description available **'
    : 'Loading...';
  const descriptionIsLong = Boolean(trimmedDescription && trimmedDescription.length > descriptionLimit);
  const displayedDescription =
    descriptionExpanded || !descriptionIsLong
      ? descriptionText
      : `${descriptionText.slice(0, descriptionLimit)}...`;
  const shouldShowExpandButton = Boolean(channel && descriptionIsLong);

  return (
    <>
      <Card elevation={8} sx={{ mb: 2 }}>
        <CardContent sx={{ px: isMobile ? 2 : 3, py: isMobile ? 2 : 2.5 }}>
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} sm={4}>
              <Box
                component="img"
                src={channel ? `/images/channelthumb-${channel_id}.jpg` : ''}
                alt="Channel thumbnail"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 3,
                  backgroundColor: 'action.hover',
                  display: 'block',
                }}
              />
            </Grid>
            <Grid
              item
              xs={12}
              sm={8}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Typography
                  variant={isMobile ? 'h5' : 'h4'}
                  component="h2"
                  gutterBottom
                  sx={{ mb: 0 }}
                >
                  {channel ? channel.uploader : 'Loading...'}
                </Typography>
                {channel && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                    {renderFilterIndicators({ includeRating: false })}
                  </Box>
                )}
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: 1,
                  minHeight: 0,
                  gap: 0,
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0 }}>
                  Description
                </Typography>
                <Box
                  sx={{
                    backgroundColor: 'background.paper',
                    borderRadius: 2,
                    pl: 0,
                    pr: isMobile ? 2 : 3,
                    py: isMobile ? 1.5 : 2.25,
                    flexGrow: 1,
                    minHeight: 0,
                    maxHeight: descriptionExpanded ? 'none' : descriptionCollapsedHeight,
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    variant={isMobile ? 'body2' : 'body1'}
                    align="left"
                    color="text.secondary"
                    sx={{ lineHeight: 1.6, pl: 0 }}
                    dangerouslySetInnerHTML={{ __html: textToHTML(displayedDescription) }}
                  />
                </Box>
                {shouldShowExpandButton && (
                  <Button
                    size="small"
                    onClick={() => setDescriptionExpanded((prev) => !prev)}
                    sx={{ alignSelf: 'flex-start', mt: 0.5, textTransform: 'none' }}
                  >
                    {descriptionExpanded ? 'Show less' : 'Read more'}
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {channel && (
        <Card elevation={3} sx={{ mb: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <CardContent
            sx={{
              px: isMobile ? 2 : 3,
              py: isMobile ? 1.25 : 1.25,
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 1 : 1,
              justifyContent: 'center',
            }}
          >
            {isMobile ? (
              // Mobile: Compact layout with title and settings in a grid
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Title */}
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                  Channel Settings
                </Typography>

                {/* Compact grid layout */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, fontSize: '0.875rem' }}>
                  {/* Auto Download */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      Auto Download
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.3, flexWrap: 'wrap' }}>
                      {renderAutoDownloadChips()}
                    </Box>
                  </Box>

                  {/* Rating */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      Rating
                    </Typography>
                    <RatingBadge
                      rating={channel.default_rating}
                      ratingSource="Channel Default"
                      size="small"
                      sx={{ ...channelChipSx, height: 24 }}
                    />
                  </Box>

                  {/* Folder */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      Folder
                    </Typography>
                    {renderSubFolder()}
                  </Box>

                  {/* Edit Button */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', visibility: 'hidden', height: '0.7rem' }}>
                      Edit
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setSettingsOpen(true)}
                      aria-label="Edit settings"
                      sx={{
                        textTransform: 'none',
                        minWidth: 0,
                        px: 1.5,
                        py: 0.5,
                        fontSize: '0.8rem',
                        height: 28,
                        color: 'text.primary',
                        borderColor: 'divider',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderColor: 'text.primary',
                          color: 'text.primary',
                        }
                      }}
                    >
                      Edit
                    </Button>
                  </Box>
                </Box>
              </Box>
            ) : (
              // Desktop: Original layout
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  m: 0,
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
                    Channel Settings
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      component="span"
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 }}
                    >
                      Auto Download:
                    </Typography>
                    {renderAutoDownloadChips()}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      component="span"
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 }}
                    >
                      Rating:
                    </Typography>
                    <RatingBadge
                      rating={channel.default_rating}
                      ratingSource="Channel Default"
                      size="small"
                      sx={{ ...channelChipSx }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      component="span"
                      color="text.secondary"
                      sx={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 }}
                    >
                      Folder:
                    </Typography>
                    {renderSubFolder()}
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<SettingsIcon />}
                  onClick={() => setSettingsOpen(true)}
                  size="small"
                  aria-label="Edit settings"
                  sx={{
                    alignSelf: 'center',
                    textTransform: 'none',
                    minWidth: 0,
                    px: 2,
                    py: 0.75,
                    ml: 'auto',
                    color: 'text.primary',
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                      borderColor: 'text.primary',
                      color: 'text.primary',
                    }
                  }}
                >
                  Edit
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

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
