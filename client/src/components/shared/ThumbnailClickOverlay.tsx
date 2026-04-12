import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';

interface ThumbnailClickOverlayProps {
  onClick: (e: React.MouseEvent) => void;
  sx?: SxProps<Theme>;
}

const ThumbnailClickOverlay: React.FC<ThumbnailClickOverlayProps> = ({ onClick, sx }) => (
  <Box
    onClick={onClick}
    sx={{
      position: 'absolute',
      top: '25%',
      left: '25%',
      width: '50%',
      height: '50%',
      cursor: 'pointer',
      zIndex: 1,
      ...sx as object,
    }}
  />
);

export default ThumbnailClickOverlay;
