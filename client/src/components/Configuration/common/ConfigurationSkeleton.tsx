import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Skeleton,
  Card,
  CardContent,
  Grid,
} from '@mui/material';

function ConfigurationSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <CircularProgress size={20} sx={{ mr: 2 }} />
        <Typography variant="h6">Loading configuration...</Typography>
      </Box>

      {/* Loading skeleton for Core Settings */}
      <Card elevation={2} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
        <CardContent>
          <Skeleton variant="text" width={150} height={32} sx={{ mb: 1 }} />
          <Skeleton variant="text" width={250} height={20} sx={{ mb: 2 }} />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Skeleton variant="rectangular" height={56} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={42} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={56} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={56} />
            </Grid>
            <Grid item xs={12} md={6}>
              <Skeleton variant="rectangular" height={56} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading skeleton for Accordions */}
      {[1, 2, 3, 4, 5].map((index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          height={48}
          sx={{ mb: 3, borderRadius: 1 }}
        />
      ))}

      {/* Loading skeleton for Account & Security */}
      <Card elevation={2} sx={{ mb: 3, border: 1, borderColor: 'divider' }}>
        <CardContent>
          <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width={130} height={36} />
        </CardContent>
      </Card>

      {/* Loading skeleton for Save button */}
      <Box sx={{ height: 88 }} />
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          p: 2,
          zIndex: (theme) => theme.zIndex.drawer + 2,
        }}
      >
        <Skeleton
          variant="rectangular"
          height={48}
          sx={{
            width: { xs: '100%', sm: '500px' },
            mx: 'auto',
            borderRadius: 1
          }}
        />
      </Box>
    </Box>
  );
}

export default ConfigurationSkeleton;
