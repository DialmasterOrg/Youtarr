import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
} from '../ui';
import { FileDownload as FileDownloadIcon, Folder as FolderIcon, Settings as SettingsIcon } from '../../lib/icons';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

function HelpDialog({ open, onClose, isMobile }: HelpDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby='help-dialog-title'
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle className="sr-only p-0 border-0">Channel Display Guide</DialogTitle>
      <DialogContent>
        <DialogContentText
          id='help-dialog-title'
          style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', marginBottom: '16px' }}
        >
          Channel Display Guide
        </DialogContentText>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="h6" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                1
              </Typography>
            </div>
            <div>
              <DialogContentText style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                Channel Column
              </DialogContentText>
              <DialogContentText style={{ fontSize: isMobile ? '13px' : '15px' }}>
                Shows the channel thumbnail and name. Click to open channel details/videos page.
              </DialogContentText>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="h6" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                2
              </Typography>
            </div>
            <div>
              <DialogContentText style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                Content Types Column
              </DialogContentText>
              <DialogContentText style={{ fontSize: isMobile ? '13px' : '15px' }}>
                Lists available content types (Videos, Shorts, Live). Download icon <FileDownloadIcon size={14} style={{ verticalAlign: 'middle' }} color="var(--success)" /> = auto-download enabled.
              </DialogContentText>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="h6" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                3
              </Typography>
            </div>
            <div>
              <DialogContentText style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                Settings Column
              </DialogContentText>
              <DialogContentText style={{ fontSize: isMobile ? '13px' : '15px' }}>
                <FolderIcon size={14} style={{ verticalAlign: 'middle' }} /> Download folder ("default" places channel directory in the root for Youtarr)
                <br />
                Green chip with <SettingsIcon size={13} style={{ verticalAlign: 'middle' }} /> = channel-specific quality override. Gray = global default.
              </DialogContentText>
            </div>
          </div>
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='primary' autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default HelpDialog;
