import React from 'react';
import { Alert, Box, Slide, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface PendingSaveBannerProps {
  show: boolean;
}

const PendingSaveBanner: React.FC<PendingSaveBannerProps> = ({ show }) => {
  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          pb: { xs: 0, sm: 2 },
          px: { xs: 0, sm: 2 },
          zIndex: (theme) => theme.zIndex.snackbar,
          pointerEvents: 'none',
          minHeight: { xs: 60, sm: 64 },
        }}
      >
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="small" />}
          variant="outlined"
          sx={{
            alignItems: 'center',
            gap: 1,
            px: { xs: 1, sm: 2 },
            py: { xs: 0, sm: 1 },
            maxWidth: { xs: '90%', sm: 560 },
            maxHeight: '48px',
            width: '100%',
            pointerEvents: 'auto',
            borderRadius: 2,
            boxShadow: (theme) => theme.shadows[6],
            bgcolor: 'background.paper',
            borderColor: 'warning.light',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              textAlign: 'center',
              py: { xs: 0, sm: 1 },
            }}
          >
            You have pending changes. Save to apply them.
          </Typography>
        </Alert>
      </Box>
    </Slide>
  );
};

export default PendingSaveBanner;
