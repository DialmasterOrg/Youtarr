import React from 'react';
import { Grid, Skeleton, Typography } from '../../ui';

interface ChannelVideosLoadingSkeletonProps {
  // One placeholder per video the page will hold.
  count: number;
}

function ChannelVideosLoadingSkeleton({ count }: ChannelVideosLoadingSkeletonProps) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Loading and fetching/indexing new videos for this channel tab...
      </Typography>
      <Grid container spacing={2} style={{ marginTop: 16 }}>
        {[...Array(count)].map((_, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="text" style={{ marginTop: 8 }} />
            <Skeleton variant="text" width="60%" />
          </Grid>
        ))}
      </Grid>
    </div>
  );
}

export default ChannelVideosLoadingSkeleton;
