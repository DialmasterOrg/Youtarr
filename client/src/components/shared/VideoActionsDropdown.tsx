import React, { useState } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';
import MoreVertIcon from '@mui/icons-material/MoreVert';

interface VideoActionsDropdownProps {
  selectedVideosCount: number;
  onContentRating: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

const VideoActionsDropdown: React.FC<VideoActionsDropdownProps> = ({
  selectedVideosCount,
  onContentRating,
  onDelete,
  disabled = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: () => void) => {
    handleClose();
    action();
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<MoreVertIcon />}
        onClick={handleOpen}
        disabled={disabled || selectedVideosCount === 0}
      >
        Actions
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => handleAction(onContentRating)}>
          <ListItemIcon>
            <EighteenUpRatingIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Change Rating" />
        </MenuItem>
        <MenuItem onClick={() => handleAction(onDelete)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Delete Selected" />
        </MenuItem>
      </Menu>
    </>
  );
};

export default VideoActionsDropdown;
