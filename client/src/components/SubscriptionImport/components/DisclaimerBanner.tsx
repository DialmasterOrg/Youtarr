import React from 'react';
import { Alert } from '@mui/material';

const DisclaimerBanner: React.FC = () => (
  <Alert severity="info" sx={{ mb: 2 }}>
    Channel details like exact folder name and description are populated during import.
    Available tabs (Videos / Shorts / Streams) are detected when you first visit each
    channel&apos;s page after import.
  </Alert>
);

export default DisclaimerBanner;
