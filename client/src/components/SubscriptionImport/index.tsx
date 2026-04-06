import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ImportSubscriptionsPageProps {
  token: string;
}

const ImportSubscriptionsPage: React.FC<ImportSubscriptionsPageProps> = ({ token: _token }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/channels')} size="small">
          Back to channels
        </Button>
        <Typography variant="h5" sx={{ ml: 1 }}>Import Subscriptions</Typography>
      </Box>
      <Typography variant="body2">Import page - components coming in subsequent tasks.</Typography>
    </Box>
  );
};

export default ImportSubscriptionsPage;
