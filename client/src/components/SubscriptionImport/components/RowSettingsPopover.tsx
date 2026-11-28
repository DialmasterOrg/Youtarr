import React from 'react';
import { Popover, Typography } from '../../ui';
import RowSettingsFields, { RowSettingsFieldsProps } from './RowSettingsFields';

interface RowSettingsPopoverProps extends RowSettingsFieldsProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

const RowSettingsPopover: React.FC<RowSettingsPopoverProps> = ({
  anchorEl, open, onClose, ...fieldProps
}) => (
  <Popover
    open={open}
    anchorEl={anchorEl}
    onClose={onClose}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
  >
    <div className="flex min-w-[280px] flex-col gap-3 p-4">
      <Typography variant="subtitle2">Channel Settings</Typography>
      <RowSettingsFields {...fieldProps} />
    </div>
  </Popover>
);

export default RowSettingsPopover;
