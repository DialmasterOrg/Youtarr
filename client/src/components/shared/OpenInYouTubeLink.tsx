import React from 'react';
import { Youtube as YoutubeIcon } from 'lucide-react';
import { Button, Tooltip } from '../ui';

const YOUTUBE_BASE_URL = 'https://www.youtube.com';

export function youtubeChannelUrl(channelId: string): string {
  return `${YOUTUBE_BASE_URL}/channel/${encodeURIComponent(channelId)}`;
}

export function youtubePlaylistUrl(playlistId: string): string {
  return `${YOUTUBE_BASE_URL}/playlist?list=${encodeURIComponent(playlistId)}`;
}

interface OpenInYouTubeLinkProps {
  href: string;
  ariaLabel?: string;
}

const OpenInYouTubeLink: React.FC<OpenInYouTubeLinkProps> = ({ href, ariaLabel = 'Open in YouTube' }) => (
  <Tooltip title="Open in YouTube">
    <Button
      asChild
      size="small"
      variant="outlined"
      color="inherit"
      style={{ textTransform: 'none', flexShrink: 0 }}
    >
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>
        Open in
        <YoutubeIcon size={18} />
      </a>
    </Button>
  </Tooltip>
);

export default OpenInYouTubeLink;
