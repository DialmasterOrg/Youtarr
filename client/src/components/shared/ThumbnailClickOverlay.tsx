import React from 'react';
import { Box } from '../ui';

interface ThumbnailClickOverlayProps {
  onClick: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

const ThumbnailClickOverlay: React.FC<ThumbnailClickOverlayProps> = ({ onClick, style }) => (
  <Box
    onClick={onClick}
    style={{
      position: 'absolute',
      top: '25%',
      left: '25%',
      width: '50%',
      height: '50%',
      cursor: 'pointer',
      zIndex: 1,
      ...style,
    }}
  />
);

export default ThumbnailClickOverlay;
