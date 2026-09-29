import React from 'react';
import { Box, Grid, Typography } from '../../ui';

/** Full-width "OR" separator between rule cards that apply independently. */
export const OrDivider: React.FC = () => (
  <Grid item xs={12}>
    <Box className="flex items-center gap-3">
      <Box className="flex-1 border-t border-border" />
      <Typography variant="body2" className="text-muted-foreground font-medium">
        OR
      </Typography>
      <Box className="flex-1 border-t border-border" />
    </Box>
  </Grid>
);

export default OrDivider;
