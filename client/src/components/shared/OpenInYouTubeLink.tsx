import React from 'react';
import { Youtube as YoutubeIcon } from 'lucide-react';
import { Button, Tooltip } from '../ui';

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
