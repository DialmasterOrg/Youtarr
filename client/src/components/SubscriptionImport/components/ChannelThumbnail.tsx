import React, { useState } from 'react';
import { Avatar } from '../../ui';
import { User as PersonIcon } from '../../../lib/icons';

interface ChannelThumbnailProps {
  thumbnailUrl: string | null;
  title: string;
  size?: number;
}

const ChannelThumbnail: React.FC<ChannelThumbnailProps> = ({ thumbnailUrl, title, size = 40 }) => {
  const [hasError, setHasError] = useState(false);
  const avatarSize = size <= 36 ? 'small' : size >= 48 ? 'large' : 'medium';

  if (!thumbnailUrl || hasError) {
    return (
      <Avatar size={avatarSize} alt={title} style={{ width: size, height: size }}>
        <PersonIcon size={size * 0.45} />
      </Avatar>
    );
  }

  return (
    <Avatar
      size={avatarSize}
      src={thumbnailUrl}
      alt={title}
      style={{ width: size, height: size }}
      imgProps={{ onError: () => setHasError(true) }}
    >
      <PersonIcon size={size * 0.45} />
    </Avatar>
  );
};

export default ChannelThumbnail;
