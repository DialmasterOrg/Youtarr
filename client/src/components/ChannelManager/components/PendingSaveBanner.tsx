import React from 'react';
import { Alert, Slide, Typography } from '../../../components/ui';
import { WarningAmber as WarningAmberIcon } from '../../../lib/icons';

interface PendingSaveBannerProps {
  show: boolean;
}

const PendingSaveBanner: React.FC<PendingSaveBannerProps> = ({ show }) => {
  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: 16,
          paddingLeft: 16,
          paddingRight: 16,
          zIndex: 1400,
          pointerEvents: 'none',
          minHeight: 60,
        }}
      >
        <Alert
          severity="warning"
          icon={<WarningAmberIcon fontSize="small" data-testid="WarningAmberIcon" />}
          variant="outlined"
          style={{
            alignItems: 'center',
            gap: 8,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            maxWidth: 560,
            maxHeight: 48,
            width: '100%',
            pointerEvents: 'auto',
            borderRadius: 'var(--radius-ui)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            backgroundColor: 'var(--card)',
            borderColor: 'var(--warning)',
          }}
        >
          <Typography
            variant="body2"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              textAlign: 'center',
              paddingTop: 8,
              paddingBottom: 8,
            }}>
            You have pending changes. Save to apply them.
          </Typography>
        </Alert>
      </div>
    </Slide>
  );
};

export default PendingSaveBanner;
