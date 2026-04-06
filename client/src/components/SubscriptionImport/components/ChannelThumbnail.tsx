import React, { useState } from 'react';
import { Avatar } from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';

interface ChannelThumbnailProps {
  thumbnailUrl: string | null;
  title: string;
  size?: number;
}

const ChannelThumbnail: React.FC<ChannelThumbnailProps> = ({ thumbnailUrl, title, size = 40 }) => {
  const [hasError, setHasError] = useState(false);

  if (!thumbnailUrl || hasError) {
    return (
      <Avatar sx={{ width: size, height: size, bgcolor: 'grey.400' }} alt={title}>
        <PersonIcon />
      </Avatar>
    );
  }

  return (
    <Avatar
      src={thumbnailUrl}
      alt={title}
      sx={{ width: size, height: size }}
      onError={() => setHasError(true)}
    >
      <PersonIcon />
    </Avatar>
  );
};

export default ChannelThumbnail;
