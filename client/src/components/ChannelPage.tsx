import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, Grid, Typography, Box, Tooltip, Chip, Popover, Dialog, DialogTitle, DialogContent, Button } from './ui';
import { Settings as SettingsIcon, Clock as AccessTimeIcon, Filter as FilterAltIcon } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { Channel } from '../types/Channel';
import RatingBadge from './shared/RatingBadge';
import ChannelVideos from './ChannelPage/ChannelVideos';
import ChannelSettingsDialog from './ChannelPage/ChannelSettingsDialog';
import TerminatedNotice from './ChannelPage/components/TerminatedNotice';
import { useConfig } from '../hooks/useConfig';
import SubFolderChip from './Subscriptions/components/chips/SubFolderChip';
import QualityChip from './Subscriptions/components/chips/QualityChip';
import AutoDownloadChips from './Subscriptions/components/chips/AutoDownloadChips';
import { SHARED_CHANNEL_META_CHIP_STYLE, SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE } from './shared/chipStyles';

interface ChannelPageProps {
  token: string | null;
}

function ChannelPage({ token }: ChannelPageProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [regexAnchorEl, setRegexAnchorEl] = useState<HTMLElement | null>(null);
  const [regexDialogOpen, setRegexDialogOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const { channel_id } = useParams();
  const { config } = useConfig(token);
  const globalPreferredResolution = config.preferredResolution || '1080';

  const handleSettingsSaved = (updated: {
    sub_folder: string | null;
    video_quality: string | null;
    audio_format: string | null;
    min_duration: number | null;
    max_duration: number | null;
    title_filter_regex: string | null;
    default_rating: string | null;
    auto_download_enabled_tabs: string | null;
    hidden_tabs?: string[];
    availableTabs?: string[];
  }) => {
    setChannel((prev) => {
      if (!prev) {
        return prev;
      }
      const next: Channel = {
        ...prev,
        sub_folder: updated.sub_folder,
        video_quality: updated.video_quality,
        audio_format: updated.audio_format,
        min_duration: updated.min_duration,
        max_duration: updated.max_duration,
        title_filter_regex: updated.title_filter_regex,
        default_rating: updated.default_rating,
        auto_download_enabled_tabs: updated.auto_download_enabled_tabs || undefined,
      };
      if (updated.availableTabs !== undefined) {
        next.available_tabs = updated.availableTabs.length > 0
          ? updated.availableTabs.join(',')
          : null;
      }
      if (updated.hidden_tabs !== undefined) {
        next.hidden_tabs = updated.hidden_tabs.length > 0
          ? updated.hidden_tabs.join(',')
          : null;
      }
      return next;
    });
  };

  // Monotonic request id keeps a slow in-flight /getChannelInfo from
  // clobbering a fresher response that already committed. Without this,
  // the initial fetch (with stale terminated_at) can resolve after the
  // post-videos-loaded refetch and overwrite the reinstated state.
  const latestRequestIdRef = useRef(0);
  const appliedRequestIdRef = useRef(0);

  const fetchAndCommitChannelInfo = useCallback(() => {
    const requestId = ++latestRequestIdRef.current;
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
      .then((data) => {
        if (requestId > appliedRequestIdRef.current) {
          appliedRequestIdRef.current = requestId;
          setChannel(data);
        }
      })
      .catch((error) => console.error(error));
  }, [token, channel_id]);

  useEffect(() => {
    fetchAndCommitChannelInfo();
  }, [fetchAndCommitChannelInfo]);

  // Stale-closure shield: handleVideosLoaded fires from a child hook ref,
  // so we read the latest channel via a ref rather than closing over state.
  const channelRef = useRef(channel);
  channelRef.current = channel;

  // The backend clears terminated_at inside the videos fetch when yt-dlp
  // succeeds, so a successful first videos load is our signal to refetch
  // /getChannelInfo. Refetch when the channel is currently terminated OR
  // when the initial info hasn't landed yet - the request-id gate above
  // protects us from a late stale initial response overwriting this one.
  const handleVideosLoaded = useCallback(() => {
    if (channelRef.current && !channelRef.current.terminated_at) return;
    fetchAndCommitChannelInfo();
  }, [fetchAndCommitChannelInfo]);

  useEffect(() => {
    setDescriptionExpanded(false);
  }, [channel?.description]);

  function renderDescriptionText(text: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const tokenPattern = /(https?:\/\/[^\s]+)|(\r\n|\r|\n)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const splitUrlTrailingPunctuation = (rawUrl: string): [string, string] => {
      let url = rawUrl;
      let suffix = '';

      const stripFromUrl = (count: number) => {
        suffix = url.slice(-count) + suffix;
        url = url.slice(0, -count);
      };

      const stripTrailingSentencePunctuation = () => {
        const punctuationMatch = url.match(/[.,!?;:]+$/);
        if (punctuationMatch) {
          stripFromUrl(punctuationMatch[0].length);
        }
      };

      stripTrailingSentencePunctuation();

      const bracketPairs = [
        ['(', ')'],
        ['[', ']'],
        ['{', '}'],
      ];

      let strippedBracket = true;
      while (strippedBracket) {
        strippedBracket = false;

        for (const [open, close] of bracketPairs) {
          if (!url.endsWith(close)) continue;

          const openCount = url.split(open).length - 1;
          const closeCount = url.split(close).length - 1;
          if (closeCount > openCount) {
            stripFromUrl(1);
            stripTrailingSentencePunctuation();
            strippedBracket = true;
          }
        }
      }

      return [url, suffix];
    };

    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(text.slice(lastIndex, match.index));
      }

      if (match[1]) {
        const [url, suffix] = splitUrlTrailingPunctuation(match[1]);
        nodes.push(
          <a key={`link-${match.index}`} href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        );
        if (suffix) {
          nodes.push(suffix);
        }
      } else {
        nodes.push(<br key={`br-${match.index}`} />);
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }

    return nodes;
  }

  const chipHeight = isMobile ? 22 : 26;
  const chipFontSize = isMobile ? '0.65rem' : '0.75rem';
  const channelChipSx: React.CSSProperties = {
    ...SHARED_CHANNEL_META_CHIP_STYLE,
    ...SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE,
    height: chipHeight,
    fontSize: chipFontSize,
    textTransform: 'none',
    paddingLeft: '10px',
    paddingRight: '10px',
  };

  const renderSubFolder = () => {
    if (!channel) {
      return null;
    }
    return <SubFolderChip subFolder={channel.sub_folder} />;
  };

  const renderAutoDownloadChips = () => {
    if (!channel) return null;
    return (
      <AutoDownloadChips
        availableTabs={channel.available_tabs || 'videos,shorts,streams'}
        autoDownloadTabs={channel.auto_download_enabled_tabs || undefined}
        isMobile={isMobile}
      />
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
      <Box className="flex gap-1 flex-wrap items-center">
        {hasQualityOverride && (
          <Tooltip title={`Auto-download quality override: ${channel.video_quality}p`}>
            <div>
              <QualityChip
                videoQuality={channel.video_quality}
                globalPreferredResolution={globalPreferredResolution}
              />
            </div>
          </Tooltip>
        )}

        {hasDurationFilter && (
          <Tooltip title={`Duration filter: ${formatDuration(channel.min_duration, channel.max_duration)}`}>
            <Chip
              icon={<AccessTimeIcon size={14} />}
              label={formatDuration(channel.min_duration, channel.max_duration)}
              size="small"
              variant="outlined"
              color="primary"
              style={{ ...channelChipSx }}
            />
          </Tooltip>
        )}

        {hasRegexFilter && (
          <Tooltip title="Title regex filter (click to view pattern)">
            <Chip
              icon={<FilterAltIcon size={14} />}
              label="Title Filter"
              size="small"
              variant="outlined"
              color="primary"
              onClick={handleRegexClick}
              style={{ ...channelChipSx, cursor: 'pointer' }}
            />
          </Tooltip>
        )}

        {includeRating && hasDefaultRating && (
          <RatingBadge
            rating={channel.default_rating}
            ratingSource="Channel Default"
            size="small"
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
            <Box className="p-4" style={{ maxWidth: 400 }}>
              <Typography variant="subtitle2" gutterBottom>
                Title Filter Regex Pattern:
              </Typography>
              <Typography
                variant="body2"
                className="bg-muted/50 p-2 rounded-[var(--radius-ui)] break-all"
                style={{ fontFamily: 'var(--font-body)' }}
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
                className="bg-muted/50 p-2 rounded-[var(--radius-ui)] break-all mt-2"
                style={{ fontFamily: 'var(--font-body)' }}
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
  const allowDescriptionCollapse = true;
  const displayedDescription =
    !allowDescriptionCollapse || descriptionExpanded || !descriptionIsLong
      ? descriptionText
      : `${descriptionText.slice(0, descriptionLimit)}...`;
  const shouldShowExpandButton = Boolean(channel && descriptionIsLong && allowDescriptionCollapse);

  return (
    <>
      <Card elevation={8} className="mb-4" style={{ borderRadius: 'var(--radius-ui)', overflow: 'hidden' }}>
        <CardContent style={{ paddingLeft: isMobile ? 10 : 16, paddingRight: isMobile ? 10 : 16, paddingTop: isMobile ? 12 : 16, paddingBottom: isMobile ? 12 : 16 }}>
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} sm={4}>
              <Box
                component="img"
                src={channel ? `/images/channelthumb-${channel_id}.jpg` : ''}
                alt="Channel thumbnail"
                className="w-full h-full object-cover rounded-xl bg-muted block"
                style={{ border: '1px solid' }}
              />
            </Grid>
            <Grid
              item
              xs={12}
              sm={8}
              className="flex flex-col gap-5"
            >
              <Box className="flex flex-col gap-3">
                <Typography
                  variant={isMobile ? 'h5' : 'h4'}
                  component="h2"
                  gutterBottom
                  className="mb-0"
                >
                  {channel ? channel.uploader : 'Loading...'}
                </Typography>
                {channel?.terminated_at && (
                  <TerminatedNotice terminatedAt={channel.terminated_at} isMobile={isMobile} />
                )}
                {channel && (
                  <Box className="flex flex-wrap gap-1 items-center">
                    {renderFilterIndicators({ includeRating: false })}
                  </Box>
                )}
              </Box>
              <Box className="flex flex-col flex-grow min-h-0 gap-0">
                <Typography variant="subtitle1" className="font-bold mb-0">
                  Description
                </Typography>
                <Box
                  className="rounded-[var(--radius-ui)] bg-card overflow-hidden"
                  style={{
                    paddingLeft: 0,
                    paddingRight: isMobile ? 16 : 24,
                    paddingTop: isMobile ? 12 : 18,
                    paddingBottom: isMobile ? 12 : 18,
                    flexGrow: 1,
                    minHeight: 0,
                    maxHeight: allowDescriptionCollapse && !descriptionExpanded ? descriptionCollapsedHeight : 'none',
                  }}
                >
                  <Typography
                    variant={isMobile ? 'body2' : 'body1'}
                    component="span"
                    align="left"
                    color="text.secondary"
                    style={{ lineHeight: 1.6 }}
                  >
                    {renderDescriptionText(displayedDescription)}
                  </Typography>
                </Box>
                {shouldShowExpandButton && (
                  <Button
                    size="small"
                    onClick={() => setDescriptionExpanded((prev) => !prev)}
                    className="self-start mt-1"
                  >
                    {descriptionExpanded ? 'Show less' : 'Read more'}
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card elevation={3} className="mb-4 flex flex-col justify-center">
        <CardContent
          style={{
            paddingLeft: isMobile ? 10 : 16,
            paddingRight: isMobile ? 10 : 16,
            paddingTop: isMobile ? 10 : 10,
            paddingBottom: '10px',
            opacity: channel ? 1 : 0.5,
            transition: 'opacity 200ms ease-in-out'
          }}
          className="flex flex-col gap-4 justify-center"
        >
          {isMobile ? (
            // Mobile: Compact layout with title and settings in a grid
            <Box className="flex flex-col gap-4">
              {/* Title */}
              <Typography variant="h6" className="font-bold text-base">
                Channel Settings
              </Typography>

              {/* Compact grid layout */}
              <Box className="grid grid-cols-2 gap-3 text-sm">
                {/* Auto Download */}
                <Box className="flex flex-col gap-1">
                  <Typography variant="caption" color="text.secondary" className="font-semibold uppercase" style={{ fontSize: '0.65rem' }}>
                    Auto Download
                  </Typography>
                  <Box className="flex gap-1 flex-wrap">
                    {channel ? renderAutoDownloadChips() : <span className="text-xs text-muted">Loading...</span>}
                  </Box>
                </Box>

                {/* Content Rating */}
                <Box className="flex flex-col gap-1">
                  <Typography variant="caption" color="text.secondary" className="font-semibold uppercase" style={{ fontSize: '0.65rem' }}>
                    Content Rating
                  </Typography>
                  {channel ? (
                    channel.default_rating ? (
                      <RatingBadge
                        rating={channel.default_rating}
                        ratingSource="Channel Default"
                        size="small"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary" className="italic" style={{ fontSize: '0.7rem' }}>
                        No rating override
                      </Typography>
                    )
                  ) : (
                    <span className="text-xs text-muted">Loading...</span>
                  )}
                </Box>

                {/* Folder */}
                <Box className="flex flex-col gap-1">
                  <Typography variant="caption" color="text.secondary" className="font-semibold uppercase" style={{ fontSize: '0.65rem' }}>
                    Folder
                  </Typography>
                  {channel ? renderSubFolder() : <span className="text-xs text-muted">Loading...</span>}
                </Box>

                {/* Edit Button */}
                <Box className="flex flex-col gap-1">
                  <Typography variant="caption" color="text.secondary" className="font-semibold uppercase" style={{ fontSize: '0.65rem', visibility: 'hidden', height: '0.7rem' }}>
                    Edit
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Edit settings"
                    disabled={!channel}
                    className="text-foreground border-border hover:bg-muted hover:border-foreground hover:text-foreground disabled:opacity-50"
                    style={{ textTransform: 'none', minWidth: 0, paddingLeft: 12, paddingRight: 12, fontSize: '0.8rem', height: 28 }}
                  >
                    Edit
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : (
            // Desktop: Original layout
            <Box className="flex flex-row items-center justify-between gap-8 m-0">
              <Box className="min-w-0 flex flex-row items-center gap-6 flex-wrap">
                <Typography variant="h6" className="font-bold mr-2">
                  Channel Settings
                </Typography>
                <Box className="flex items-center gap-2 flex-wrap">
                  <Typography
                    variant="body2"
                    component="span"
                    color="text.secondary"
                    className="whitespace-nowrap inline-flex items-center"
                    style={{ lineHeight: 1.2 }}
                  >
                    Auto Download:
                  </Typography>
                  {channel ? renderAutoDownloadChips() : <span className="text-xs text-muted">Loading...</span>}
                </Box>
                <Box className="flex items-center gap-2 flex-wrap">
                  <Typography
                    variant="body2"
                    component="span"
                    color="text.secondary"
                    className="whitespace-nowrap inline-flex items-center"
                    style={{ lineHeight: 1.2 }}
                  >
                    Content Rating:
                  </Typography>
                  {channel ? (
                    channel.default_rating ? (
                      <RatingBadge
                        rating={channel.default_rating}
                        ratingSource="Channel Default"
                        size="small"
                      />
                    ) : (
                      <Typography
                        variant="body2"
                        component="span"
                        color="text.secondary"
                        className="italic"
                        style={{ lineHeight: 1.2 }}
                      >
                        No rating override
                      </Typography>
                    )
                  ) : (
                    <span className="text-xs text-muted">Loading...</span>
                  )}
                </Box>
                <Box className="flex items-center gap-2 flex-wrap">
                  <Typography
                    variant="body2"
                    component="span"
                    color="text.secondary"
                    className="whitespace-nowrap inline-flex items-center"
                    style={{ lineHeight: 1.2 }}
                  >
                    Folder:
                  </Typography>
                  {channel ? renderSubFolder() : <span className="text-xs text-muted">Loading...</span>}
                </Box>
              </Box>
              <Button
                variant="outlined"
                startIcon={<SettingsIcon size={16} />}
                onClick={() => setSettingsOpen(true)}
                size="small"
                aria-label="Edit settings"
                disabled={!channel}
                className="text-foreground border-border hover:bg-muted hover:border-foreground hover:text-foreground ml-auto disabled:opacity-50"
                style={{ textTransform: 'none', minWidth: 0, padding: '6px 16px' }}
              >
                Edit
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <ChannelVideos
        token={token}
        channelAutoDownloadTabs={channel?.auto_download_enabled_tabs}
        channelId={channel_id || undefined}
        channelName={channel?.uploader || ''}
        channelVideoQuality={channel?.video_quality || null}
        channelAudioFormat={channel?.audio_format || null}
        channelAvailableTabs={channel?.available_tabs ?? null}
        onVideosLoaded={handleVideosLoaded}
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
