import React, { useState } from 'react';
import { Chip, Tooltip, CircularProgress, useTheme, useMediaQuery, Snackbar, Alert } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import { useStorageStatus } from '../hooks/useStorageStatus';

interface StorageStatusProps {
  token: string | null;
}

const StorageStatus: React.FC<StorageStatusProps> = ({ token }) => {
  const { data: storageData, loading, error } = useStorageStatus(token, {
    poll: true,
    pollInterval: 120000
  });
  const [mobileSnackbar, setMobileSnackbar] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!token || error) return null;

  const getChipColor = () => {
    if (!storageData) return 'default';
    if (storageData.percentFree > 25) return 'success';
    if (storageData.percentFree > 10) return 'warning';
    return 'error';
  };

  const getStatusIcon = () => {
    if (loading) {
      return <CircularProgress size={16} sx={{ color: 'inherit', mr: 0.5 }} />;
    }
    return <StorageIcon sx={{ fontSize: 16, mr: 0.5 }} />;
  };

  if (loading) {
    return (
      <Chip
        icon={getStatusIcon()}
        label="Loading..."
        size="small"
        sx={{
          position: 'absolute',
          top: isMobile ? 'auto' : 5,
          bottom: isMobile ? 5 : 'auto',
          left: isMobile ? 'auto' : 10,
          right: isMobile ? 10 : 'auto',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'inherit',
          fontSize: 'small',
        }}
      />
    );
  }

  if (!storageData) return null;

  const handleChipClick = () => {
    if (isMobile) {
      setMobileSnackbar(true);
    }
  };

  const chip = (
    <Chip
      icon={getStatusIcon()}
      label={isMobile ? `${storageData.availableGB}GB` : `${storageData.availableGB} GB free`}
      size="small"
      color={getChipColor()}
      variant="outlined"
      onClick={handleChipClick}
      sx={{
        position: 'absolute',
        top: isMobile ? 'auto' : 5,
        bottom: isMobile ? 5 : 'auto',
        left: isMobile ? 'auto' : 10,
        right: isMobile ? 10 : 'auto',
        fontSize: 'small',
        fontWeight: 500,
        borderWidth: 1.5,
        cursor: isMobile ? 'pointer' : 'default',
        '& .MuiChip-icon': {
          marginLeft: '4px',
          marginRight: '-2px',
        },
      }}
    />
  );

  return (
    <>
      {isMobile ? (
        chip
      ) : (
        <Tooltip
          title={`${storageData.availableGB} GB free of ${storageData.totalGB} GB total`}
          arrow
          placement="bottom"
        >
          {chip}
        </Tooltip>
      )}

      <Snackbar
        open={mobileSnackbar}
        autoHideDuration={6000}
        onClose={() => setMobileSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setMobileSnackbar(false)}
          severity="info"
          sx={{ width: '100%' }}
        >
          {`${storageData.availableGB} GB free of ${storageData.totalGB} GB total`}
        </Alert>
      </Snackbar>
    </>
  );
};

export default StorageStatus;