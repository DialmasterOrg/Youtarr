import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';
import DeleteIcon from '@mui/icons-material/Delete';

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

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMenuItemClick = (callback: () => void) => {
    callback();
    handleClose();
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        endIcon={<MoreVertIcon />}
        onClick={handleClick}
        disabled={disabled || selectedVideosCount === 0}
        aria-label={`Actions for ${selectedVideosCount} selected video${selectedVideosCount !== 1 ? 's' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Actions ({selectedVideosCount})
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleMenuItemClick(onContentRating)}>
          <ListItemIcon>
            <EighteenUpRatingIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Update Content Rating</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => handleMenuItemClick(onDelete)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Selected</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default VideoActionsDropdown;
