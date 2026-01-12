import React from 'react';
import { Chip, Tooltip, SxProps, Theme, Box, Typography } from '@mui/material';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';

interface RatingBadgeProps {
  rating: string | null | undefined;
  ratingSource?: string | null;
  size?: 'small' | 'medium';
  showNA?: boolean;
  variant?: 'pill' | 'text';
  sx?: SxProps<Theme>;
}

/**
 * Displays a content/parental rating badge
 * Examples: R, PG-13, TV-14, TV-MA, etc.
 */
const RatingBadge: React.FC<RatingBadgeProps> = ({ 
  rating, 
  ratingSource, 
  size = 'small', 
  showNA = false, 
  variant = 'pill',
  sx 
}) => {
  if (!rating && !showNA) {
    return null;
  }

  const displayRating = rating || 'NR';
  const label = variant === 'pill' ? `Rating: ${displayRating}` : displayRating;

  // Color coding based on rating type
  const getRatingColor = (rate: string): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    const lower = rate.toLowerCase();
    
    // TV ratings
    if (lower.includes('tv-y')) return 'info'; // Light blue - kids only
    if (lower.includes('tv-pg')) return 'primary'; // Blue - parental guidance
    if (lower.includes('tv-14')) return 'warning'; // Orange - 14+
    if (lower.includes('tv-ma')) return 'error'; // Red - mature audiences
    
    // MPAA ratings
    if (lower === 'g') return 'info'; // General audiences
    if (lower === 'pg') return 'primary'; // Parental guidance
    if (lower === 'pg-13') return 'warning'; // Parents strongly cautioned
    if (lower === 'r') return 'error'; // Restricted
    if (lower === 'nc-17') return 'error'; // No children under 17
    
    return 'default';
  };

  const tooltipText = ratingSource 
    ? `Content Rating: ${displayRating} (Source: ${ratingSource})`
    : `Content Rating: ${displayRating}`;

  if (variant === 'text') {
    const color = getRatingColor(displayRating);
    const resolvedColor = color === 'default' ? 'text.secondary' : `${color}.main`;

    return (
      <Tooltip title={tooltipText} placement="top">
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, ...sx }}>
          <EighteenUpRatingIcon sx={{ fontSize: size === 'small' ? 16 : 20, color: resolvedColor }} />
          <Typography 
            variant="caption" 
            sx={{ 
              fontWeight: 600, 
              color: resolvedColor,
              fontSize: size === 'small' ? '0.75rem' : '0.875rem'
            }}
          >
            {displayRating}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText} placement="top">
      <Chip
        label={label}
        size={size}
        color={getRatingColor(displayRating)}
        variant="outlined"
        sx={{
          fontWeight: 'bold',
          fontSize: size === 'small' ? '0.75rem' : '0.875rem',
          ...sx
        }}
      />
    </Tooltip>
  );
};

export default RatingBadge;
