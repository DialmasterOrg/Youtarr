import React from 'react';
import { Alert } from '@mui/material';

const DisclaimerBanner: React.FC = () => (
  <Alert severity="info" sx={{ mb: 2 }}>
    Channel details (available tabs like Videos / Shorts / Streams, exact folder name, description)
    are detected when each channel is imported. Auto-download defaults to the channel&apos;s main
    video tab until import completes.
  </Alert>
);

export default DisclaimerBanner;
