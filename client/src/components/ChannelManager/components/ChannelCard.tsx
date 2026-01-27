import React, { useState } from 'react';
import { Avatar, Box, Card, CardActionArea, CardContent, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import { Channel } from '../../../types/Channel';
import { QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip } from './chips';
import FolderIcon from '@mui/icons-material/Folder';
import { isExplicitlyNoSubfolder, isUsingDefaultSubfolder } from '../../../utils/channelHelpers';

interface ChannelCardProps {
    channel: Channel;
    isMobile: boolean;
    globalPreferredResolution: string;
    onNavigate: () => void;
    onDelete: () => void;
    onRegexClick: (event: React.MouseEvent<HTMLElement>, regex: string) => void;
    isPendingAddition?: boolean;
    isInteractive?: boolean;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
    channel,
    isMobile,
    globalPreferredResolution,
    onNavigate,
    onDelete,
    onRegexClick,
    isPendingAddition,
    isInteractive = false,
}) => {
    const [thumbnailVisible, setThumbnailVisible] = useState(true);
    const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

    const thumbnailSrc = channel.channel_id
        ? `/images/channelthumb-${channel.channel_id}.jpg`
        : '/images/channelthumb-default.jpg';

    const hasCustomFolder = Boolean(
        channel.sub_folder &&
        !isExplicitlyNoSubfolder(channel.sub_folder) &&
        !isUsingDefaultSubfolder(channel.sub_folder)
    );

    return (
        <Card
            /* toggle 'hover:animate-wiggle' here */
            className={isInteractive ? 'wiggle-card' : undefined}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderColor: isPendingAddition ? 'warning.light' : 'var(--foreground)',
                borderWidth: 'var(--border-weight)',
                borderStyle: isPendingAddition ? 'dashed' : 'solid',
                borderRadius: 'var(--radius-ui)',
                boxShadow: 'var(--shadow-soft)',
                transform: isInteractive ? 'var(--sticker-rest-transform)' : 'translate(0, 0)',
                transition: 'transform 300ms var(--transition-bouncy), box-shadow 300ms var(--transition-bouncy)',
                '&:hover': {
                    transform: isInteractive ? 'var(--sticker-hover-transform)' : 'var(--card-hover-transform)',
                    boxShadow: 'var(--card-hover-shadow)',
                },
                overflow: 'hidden',
            }}
            elevation={0}
        >
            <CardActionArea
                onClick={isPendingAddition ? undefined : onNavigate}
                data-testid={`channel-card-${channel.channel_id || channel.url}`}
                disabled={isPendingAddition}
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    cursor: isPendingAddition ? 'not-allowed' : 'pointer',
                    '&:hover .hoverOverlay': {
                        bgcolor: isPendingAddition ? 'transparent' : 'rgba(15, 23, 42, 0.4)',
                    },
                    '&:hover .hoverOverlayIcon': {
                        opacity: isPendingAddition ? 0 : 1,
                        transform: isPendingAddition ? 'translateY(10px)' : 'translateY(0)',
                    },
                    '&:hover .avatarImage': {
                        transform: isPendingAddition ? 'scale(1)' : 'scale(1.05)',
                    },
                }}
            >
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        pt: '56.25%',
                        overflow: 'hidden',
                        borderRadius: 'var(--radius-thumb)',
                        bgcolor: 'common.white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {thumbnailVisible ? (
                            <Avatar
                                variant="rounded"
                                src={thumbnailSrc}
                                alt={`${channel.uploader || 'Channel'} thumbnail`}
                                className="avatarImage"
                                sx={{
                                    width: 190,
                                    height: 190,
                                    borderRadius: 'var(--radius-thumb)',
                                    transition: 'transform 0.35s ease',
                                    filter: thumbnailLoaded ? 'none' : 'grayscale(0.2)',
                                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                                }}
                                onLoad={() => setThumbnailLoaded(true)}
                                onError={() => setThumbnailVisible(false)}
                            />
                        ) : (
                            <Avatar
                                sx={{
                                    width: 120,
                                    height: 120,
                                    bgcolor: 'grey.200',
                                    color: 'text.secondary',
                                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
                                }}
                            >
                                <ImageIcon sx={{ fontSize: 48 }} />
                            </Avatar>
                        )}
                    </Box>

                    <Box
                        className="hoverOverlay"
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'rgba(15, 23, 42, 0)',
                            transition: 'background-color 0.3s ease',
                        }}
                    >
                    </Box>

                    <Box sx={{ position: 'absolute', bottom: 8, left: 8, zIndex: 1 }}>
                        <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
                    </Box>
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.75,
                            alignItems: 'flex-end',
                        }}
                    >
                        <DurationFilterChip
                            minDuration={channel.min_duration}
                            maxDuration={channel.max_duration}
                            isMobile={isMobile}
                        />
                        <TitleFilterChip
                            titleFilterRegex={channel.title_filter_regex}
                            onRegexClick={onRegexClick}
                            isMobile={isMobile}
                        />
                    </Box>


                    <Tooltip title="Remove channel">
                        <IconButton
                            color="error"
                            size="large"
                            aria-label="Remove channel"
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                            }}
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete();
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>

                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', minWidth: 0 }}>
                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                    {channel.uploader || 'Unknown Channel'}
                                </Typography>
                            </Box>
                            {hasCustomFolder && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                                    <FolderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        {`/${channel.sub_folder}`}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                        {isPendingAddition && <Chip label="Pending" size="small" color="warning" />}
                    </Box>

                    <CardDetails
                        channel={channel}
                        isMobile={isMobile}
                        onRegexClick={onRegexClick}
                    />
                </CardContent>
            </CardActionArea>
        </Card>
    );
};

interface CardDetailsProps {
    channel: Channel;
    isMobile: boolean;
    onRegexClick: (event: React.MouseEvent<HTMLElement>, regex: string) => void;
}

const CardDetails: React.FC<CardDetailsProps> = ({ channel, isMobile, onRegexClick }) => {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <AutoDownloadChips
                    availableTabs={channel.available_tabs}
                    autoDownloadTabs={channel.auto_download_enabled_tabs}
                    isMobile={isMobile}
                />
            </Box>
        </Box>
    );
};

export default ChannelCard;
