import React from 'react';
import { Chip, Tooltip } from '@mui/material';

interface RatingBadgeProps {
  rating: string | null | undefined;
  ratingSource?: string | null;
  size?: 'small' | 'medium';
}

/**
 * Displays a content/parental rating badge
 * Examples: R, PG-13, TV-14, TV-MA, etc.
 */
const RatingBadge: React.FC<RatingBadgeProps> = ({ rating, ratingSource, size = 'small' }) => {
  if (!rating) {
    return null;
  }

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
    ? `Content Rating: ${rating} (Source: ${ratingSource})`
    : `Content Rating: ${rating}`;

  return (
    <Tooltip title={tooltipText} placement="top">
      <Chip
        label={rating}
        size={size}
        color={getRatingColor(rating)}
        variant="outlined"
        sx={{
          fontWeight: 'bold',
          fontSize: size === 'small' ? '0.75rem' : '0.875rem',
        }}
      />
    </Tooltip>
  );
};

export default RatingBadge;
