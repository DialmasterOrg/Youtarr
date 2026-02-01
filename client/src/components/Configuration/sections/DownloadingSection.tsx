import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { DownloadPerformanceSection } from './DownloadPerformanceSection';
import { AdvancedSettingsSection } from './AdvancedSettingsSection';
import { ConfigState } from '../types';
import { YtDlpVersionInfo, YtDlpUpdateStatus } from '../hooks/useYtDlpUpdate';

interface DownloadingSectionProps {
  config: ConfigState;
  onConfigChange: (updates: Partial<ConfigState>) => void;
  onMobileTooltipClick?: (text: string) => void;
  ytDlpVersionInfo?: YtDlpVersionInfo;
  ytDlpUpdateStatus?: YtDlpUpdateStatus;
  onYtDlpUpdate?: () => void;
}

export const DownloadingSection: React.FC<DownloadingSectionProps> = ({
  config,
  onConfigChange,
  onMobileTooltipClick,
  ytDlpVersionInfo,
  ytDlpUpdateStatus,
  onYtDlpUpdate,
}) => {
  const [showYtDlpUpdateDialog, setShowYtDlpUpdateDialog] = useState(false);

  return (
    <ConfigurationCard
      title="Downloading"
      subtitle="Settings for the yt-dlp backend."
    >
      {ytDlpVersionInfo?.currentVersion && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              yt-dlp:
            </Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {ytDlpVersionInfo.currentVersion}
            </Typography>
            {ytDlpVersionInfo.updateAvailable && ytDlpVersionInfo.latestVersion ? (
              <>
                <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="body1"
                  sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'warning.main' }}
                >
                  {ytDlpVersionInfo.latestVersion}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  color="warning"
                  startIcon={
                    ytDlpUpdateStatus === 'updating'
                      ? <CircularProgress size={16} />
                      : <SystemUpdateIcon />
                  }
                  onClick={() => setShowYtDlpUpdateDialog(true)}
                  disabled={ytDlpUpdateStatus === 'updating'}
                >
                  {ytDlpUpdateStatus === 'updating' ? 'Updating...' : 'Update'}
                </Button>
              </>
            ) : (
              <CheckCircleIcon color="success" fontSize="small" />
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            yt-dlp is the video download engine. If downloads are failing, try updating yt-dlp to the latest version.
          </Typography>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
        <DownloadPerformanceSection
          config={config}
          onConfigChange={onConfigChange}
          onMobileTooltipClick={onMobileTooltipClick}
        />
        <AdvancedSettingsSection
          config={config}
          onConfigChange={onConfigChange}
          onMobileTooltipClick={onMobileTooltipClick}
        />
      </Box>

      <Dialog
        open={showYtDlpUpdateDialog}
        onClose={() => setShowYtDlpUpdateDialog(false)}
        aria-labelledby="ytdlp-update-dialog-title"
        aria-describedby="ytdlp-update-dialog-description"
      >
        <DialogTitle id="ytdlp-update-dialog-title">Update yt-dlp?</DialogTitle>
        <DialogContent>
          <DialogContentText id="ytdlp-update-dialog-description">
            This will update yt-dlp from <strong>{ytDlpVersionInfo?.currentVersion || 'current version'}</strong> to <strong>{ytDlpVersionInfo?.latestVersion || 'latest version'}</strong>.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2 }}>
            Newer versions are not guaranteed to be fully compatible with Youtarr. Updating is only recommended if you are experiencing issues with downloading videos.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowYtDlpUpdateDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setShowYtDlpUpdateDialog(false);
              onYtDlpUpdate?.();
            }}
            variant="contained"
            color="primary"
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </ConfigurationCard>
  );
};
