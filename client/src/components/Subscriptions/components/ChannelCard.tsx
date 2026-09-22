import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Avatar, Card, CardActionArea, CardContent, Chip, Tooltip, Typography } from '../../ui';
import { Delete as DeleteIcon, Image as ImageIcon, Folder as FolderIcon } from '../../../lib/icons';
import { Channel } from '../../../types/Channel';
import { QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip, DownloadFormatConfigIndicator, TerminatedChip, ProtectedChip } from './chips';

const THUMBNAIL_ASPECT_PADDING = '56.25%';

interface ChannelCardProps {
    channel: Channel;
    isMobile: boolean;
    globalPreferredResolution: string;
    onDelete: () => void;
    onRegexClick: (event: React.MouseEvent<HTMLElement>, regex: string) => void;
    isPendingAddition?: boolean;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
    channel,
    isMobile,
    globalPreferredResolution,
    onDelete,
    onRegexClick,
    isPendingAddition,
}) => {
    const canNavigate = Boolean(channel.channel_id) && !isPendingAddition;
    const channelPath = `/channel/${channel.channel_id}`;

    const thumbnailSrc = channel.channel_id
        ? `/images/channelthumb-${channel.channel_id}.jpg`
        : '/images/channelthumb-default.jpg';

    return (
        <Card
            style={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderColor: isPendingAddition ? 'var(--warning)' : 'transparent',
                borderWidth: isPendingAddition ? 2 : 0,
                borderStyle: isPendingAddition ? 'dashed' : 'solid',
                borderRadius: 24,
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
                overflow: 'hidden',
            }}
            elevation={0}
        >
            <CardActionArea
                component={canNavigate ? RouterLink : 'div'}
                to={canNavigate ? channelPath : undefined}
                role={undefined}
                tabIndex={undefined}
                aria-label={canNavigate ? channel.uploader || 'Unknown Channel' : undefined}
                data-testid={`channel-card-${channel.channel_id || channel.url}`}
                disabled={isPendingAddition}
                style={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    cursor: canNavigate ? 'pointer' : 'default',
                    color: 'inherit',
                    textDecoration: 'none',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: THUMBNAIL_ASPECT_PADDING,
                        overflow: 'hidden',
                        backgroundColor: 'rgba(64,64,64,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Avatar
                            src={thumbnailSrc}
                            alt={`${channel.uploader || 'Channel'} thumbnail`}
                            style={{ width: 190, height: 190, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)' }}
                        >
                            <ImageIcon size={48} data-testid="ImageIcon" />
                        </Avatar>
                    </div>

                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        <QualityChip videoQuality={channel.video_quality} globalPreferredResolution={globalPreferredResolution} />
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            bottom: channel.title_filter_regex
                                ? 'calc(8px + var(--ui-chip-small-height, 24px) + 6px)'
                                : 8,
                            left: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                        }}
                    >
                        <DurationFilterChip
                            minDuration={channel.min_duration}
                            maxDuration={channel.max_duration}
                            isMobile={isMobile}
                        />
                    </div>
                </div>

                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', minWidth: 0 }}>
                            <div style={{ minWidth: 0, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                    {channel.uploader || 'Unknown Channel'}
                                </Typography>
                                {channel.terminated_at && (
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        <TerminatedChip terminatedAt={channel.terminated_at} />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                <FolderIcon size={16} style={{ color: 'var(--muted-foreground)' }} data-testid="FolderIcon" />
                                <Typography variant="body2" color="text.secondary" noWrap>
                                    {channel.sub_folder ? `/${channel.sub_folder}` : 'Default Folder'}
                                </Typography>
                            </div>
                        </div>
                        {isPendingAddition && <Chip label="Pending" size="small" color="warning" />}
                    </div>
                </CardContent>
            </CardActionArea>
            {/* AutoDownloadChips can include a defaults-info button and popover. */}
            <CardContent style={{ paddingTop: 0, opacity: isPendingAddition ? 0.5 : undefined }}>
                <CardDetails channel={channel} isMobile={isMobile} />
            </CardContent>
            {/* Match the thumbnail area; controls are siblings of the navigation link. */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                paddingTop: THUMBNAIL_ASPECT_PADDING,
                pointerEvents: 'none',
            }}>
                <div style={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'auto' }}>
                    <Tooltip title="Remove channel">
                        <button
                            type="button"
                            aria-label="Remove channel"
                            style={{
                                background: 'rgba(0,0,0,0.4)',
                                border: 'none',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 36,
                                height: 36,
                                color: 'var(--destructive)',
                            }}
                            onClick={onDelete}
                        >
                            <DeleteIcon size={16} data-testid="DeleteIcon" />
                        </button>
                    </Tooltip>
                </div>
                <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', pointerEvents: isPendingAddition ? 'none' : 'auto' }}>
                    <TitleFilterChip
                        disabled={isPendingAddition}
                        titleFilterRegex={channel.title_filter_regex}
                        onRegexClick={onRegexClick}
                        isMobile={isMobile}
                    />
                </div>
            </div>
        </Card>
    );
};

interface CardDetailsProps {
    channel: Channel;
    isMobile: boolean;
}

const CardDetails: React.FC<CardDetailsProps> = ({ channel, isMobile }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <DownloadFormatConfigIndicator audioFormat={channel.audio_format} />
                <AutoDownloadChips
                    availableTabs={channel.available_tabs}
                    autoDownloadTabs={channel.auto_download_enabled_tabs}
                    isMobile={isMobile}
                />
                <ProtectedChip
                    autoRemovalProtected={channel.auto_removal_protected}
                    keepRecentCount={channel.auto_removal_keep_recent_count}
                />
            </div>
        </div>
    );
};

export default ChannelCard;
