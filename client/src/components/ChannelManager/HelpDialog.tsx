import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';

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
      <DialogContent>
        <DialogContentText
          id='help-dialog-title'
          style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', marginBottom: '16px' }}
        >
          Channel Display Guide
        </DialogContentText>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                1
              </Typography>
            </Box>
            <Box>
              <DialogContentText style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                Channel Column
              </DialogContentText>
              <DialogContentText style={{ fontSize: isMobile ? '13px' : '15px' }}>
                Shows the channel thumbnail and name. Click to open channel details/videos page.
              </DialogContentText>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                2
              </Typography>
            </Box>
            <Box>
              <DialogContentText style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                Content Types Column
              </DialogContentText>
              <DialogContentText style={{ fontSize: isMobile ? '13px' : '15px' }}>
                Lists available content types (Videos, Shorts, Live). Download icon <FileDownloadIcon sx={{ fontSize: '0.85rem', verticalAlign: 'middle', color: 'success.main' }} /> = auto-download enabled.
              </DialogContentText>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <Box sx={{ minWidth: '40px', display: 'flex', justifyContent: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                3
              </Typography>
            </Box>
            <Box>
              <DialogContentText style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                Settings Column
              </DialogContentText>
              <DialogContentText style={{ fontSize: isMobile ? '13px' : '15px' }}>
                <FolderIcon sx={{ fontSize: '0.85rem', verticalAlign: 'middle' }} /> Download folder (&quot;default&quot; places channel directory in the root for Youtarr)
                <br />
                Green chip with <SettingsIcon sx={{ fontSize: '0.8rem', verticalAlign: 'middle' }} /> = channel-specific quality override. Gray = global default.
              </DialogContentText>
            </Box>
          </Box>
        </Box>
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
