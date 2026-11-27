import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '../../ui';
import RowSettingsFields, { RowSettingsFieldsProps } from './RowSettingsFields';

interface RowSettingsSheetProps extends RowSettingsFieldsProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

const RowSettingsSheet: React.FC<RowSettingsSheetProps> = ({
  open, onClose, onOpen: _onOpen, ...fieldProps
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle onClose={onClose}>Channel Settings</DialogTitle>
    <DialogContent className="space-y-4">
      <RowSettingsFields {...fieldProps} />
    </DialogContent>
    <DialogActions>
      <Button variant="contained" onClick={onClose}>Done</Button>
    </DialogActions>
  </Dialog>
);

export default RowSettingsSheet;
