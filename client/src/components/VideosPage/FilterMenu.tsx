import React from 'react';
import { Menu, MenuItem, ListItemIcon } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

interface FilterMenuProps {
  anchorEl: null | HTMLElement;
  handleClose: () => void;
  handleMenuItemClick: (
    event: React.MouseEvent<HTMLLIElement, MouseEvent>,
    channel: string
  ) => void;
  filter: string;
  uniqueChannels: string[];
}

const FilterMenu: React.FC<FilterMenuProps> = ({
  anchorEl,
  handleClose,
  handleMenuItemClick,
  filter,
  uniqueChannels,
}) => (
  <Menu
    anchorEl={anchorEl}
    keepMounted
    open={Boolean(anchorEl)}
    onClose={handleClose}
  >
    <MenuItem onClick={(event) => handleMenuItemClick(event, '')} key='All'>
      All
      {filter === '' && (
        <ListItemIcon>
          <CheckIcon />
        </ListItemIcon>
      )}
    </MenuItem>
    {uniqueChannels.map((channel) => (
      <MenuItem
        onClick={(event) => handleMenuItemClick(event, channel)}
        key={channel}
      >
        {channel}
        {filter === channel && (
          <ListItemIcon>
            <CheckIcon />
          </ListItemIcon>
        )}
      </MenuItem>
    ))}
  </Menu>
);

export default FilterMenu;
