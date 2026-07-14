import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Typography } from '../../ui';
import { Plus } from '../../../lib/icons';

interface ChannelNameDisplayProps {
  channelName: string;
  enabledChannelId: string | null;
  videoChannelId?: string | null;
  variant: 'caption' | 'body2';
  className?: string;
  style?: React.CSSProperties;
  onAddChannel: (channelName: string, channelUrl: string) => void;
}

export default function ChannelNameDisplay({
  channelName,
  enabledChannelId,
  videoChannelId,
  variant,
  className,
  style,
  onAddChannel,
}: ChannelNameDisplayProps) {
  if (enabledChannelId) {
    return (
      <Typography
        component={RouterLink}
        to={`/channel/${enabledChannelId}`}
        variant={variant}
        className={`text-primary no-underline hover:underline ${className || ''}`}
        style={style}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {channelName}
      </Typography>
    );
  }

  if (videoChannelId) {
    const channelUrl = `https://www.youtube.com/channel/${videoChannelId}`;
    const activate = (e: React.SyntheticEvent) => {
      e.stopPropagation();
      onAddChannel(channelName, channelUrl);
    };
    return (
      <Typography
        variant={variant}
        className={`text-primary cursor-pointer hover:underline ${className || ''}`}
        style={style}
        role="button"
        tabIndex={0}
        title={`Add ${channelName} to your channels`}
        onClick={activate}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate(e);
          }
        }}
      >
        {/* Leading so it survives name truncation in the mobile list. */}
        <Plus
          size={12}
          className="mr-0.5 inline-block align-[-2px]"
          data-testid="add-channel-icon"
          aria-hidden
        />
        {channelName}
      </Typography>
    );
  }

  return (
    <Typography variant={variant} color="text.secondary" className={className} style={style}>
      {channelName}
    </Typography>
  );
}
