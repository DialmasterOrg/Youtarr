import React, { useState } from 'react';
import { Chip, Tooltip, CircularProgress, Snackbar, Alert } from './ui';
import { Storage as StorageIcon } from '../lib/icons';
import { useMediaQuery } from '../hooks/useMediaQuery';
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
  const isMobile = useMediaQuery('(max-width: 599px)');

  if (!token || error) return null;

  const getChipColor = () => {
    if (!storageData) return 'default';
    if (storageData.percentFree > 25) return 'success';
    if (storageData.percentFree > 10) return 'warning';
    return 'error';
  };

  const getStatusIcon = () => {
    if (loading) {
      return <CircularProgress size={16} style={{ color: 'inherit', marginRight: 4 }} />;
    }
    return <StorageIcon size={16} style={{ marginRight: 4 }} />;
  };

  if (loading) {
    return (
      <Chip
        icon={getStatusIcon()}
        label="Loading..."
        size="small"
        style={{
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
      style={{
        position: 'absolute',
        top: isMobile ? 'auto' : 5,
        bottom: isMobile ? 5 : 'auto',
        left: isMobile ? 'auto' : 10,
        right: isMobile ? 10 : 'auto',
        fontSize: 'small',
        fontWeight: 500,
        borderWidth: 1.5,
        cursor: isMobile ? 'pointer' : 'default',
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
          style={{ width: '100%' }}
        >
          {`${storageData.availableGB} GB free of ${storageData.totalGB} GB total`}
        </Alert>
      </Snackbar>
    </>
  );
};

export default StorageStatus;