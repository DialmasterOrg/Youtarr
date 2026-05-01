import React from 'react';
import { Avatar, Card, CardActionArea, CardContent, Chip, Tooltip, Typography } from '../../ui';
import { Delete as DeleteIcon, Image as ImageIcon, Folder as FolderIcon } from '../../../lib/icons';
import { Channel } from '../../../types/Channel';
import { QualityChip, AutoDownloadChips, DurationFilterChip, TitleFilterChip, DownloadFormatConfigIndicator } from './chips';

interface ChannelCardProps {
    channel: Channel;
    isMobile: boolean;
    globalPreferredResolution: string;
    onNavigate: () => void;
    onDelete: () => void;
    onRegexClick: (event: React.MouseEvent<HTMLElement>, regex: string) => void;
    isPendingAddition?: boolean;
}

const ChannelCard: React.FC<ChannelCardProps> = ({
    channel,
    isMobile,
    globalPreferredResolution,
    onNavigate,
    onDelete,
    onRegexClick,
    isPendingAddition,
}) => {
    const thumbnailSrc = channel.channel_id
        ? `/images/channelthumb-${channel.channel_id}.jpg`
        : '/images/channelthumb-default.jpg';

    return (
        <Card
            style={{
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
                onClick={isPendingAddition ? undefined : onNavigate}
                data-testid={`channel-card-${channel.channel_id || channel.url}`}
                disabled={isPendingAddition}
                style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    cursor: isPendingAddition ? 'not-allowed' : 'pointer',
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%',
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
                            bottom: 8,
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
                        <TitleFilterChip
                            titleFilterRegex={channel.title_filter_regex}
                            onRegexClick={onRegexClick}
                            isMobile={isMobile}
                        />
                    </div>

                    <Tooltip title="Remove channel">
                        <button
                            type="button"
                            aria-label="Remove channel"
                            style={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
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
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete();
                            }}
                        >
                            <DeleteIcon size={16} data-testid="DeleteIcon" />
                        </button>
                    </Tooltip>
                </div>

                <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', flexGrow: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', minWidth: 0 }}>
                            <div style={{ minWidth: 0, flexGrow: 1 }}>
                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                    {channel.uploader || 'Unknown Channel'}
                                </Typography>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <DownloadFormatConfigIndicator audioFormat={channel.audio_format} />
                <AutoDownloadChips
                    availableTabs={channel.available_tabs}
                    autoDownloadTabs={channel.auto_download_enabled_tabs}
                    isMobile={isMobile}
                />
            </div>
        </div>
    );
};

export default ChannelCard;
