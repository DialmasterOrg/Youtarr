import React, { useState, useEffect } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Box,
  Typography,
  Divider
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import SearchIcon from '@mui/icons-material/Search';

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
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Reset search when menu opens/closes
  useEffect(() => {
    if (!anchorEl) {
      setSearchTerm('');
    }
  }, [anchorEl]);

  // Filter channels based on search term (case insensitive)
  const filteredChannels = uniqueChannels.filter(channel =>
    channel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Menu
      anchorEl={anchorEl}
      keepMounted
      open={Boolean(anchorEl)}
      onClose={handleClose}
      PaperProps={{
        style: {
          maxHeight: 400,
          width: '300px',
        },
      }}
    >
      <Box sx={{ px: 2, py: 1, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search channels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          autoFocus
        />
      </Box>
      <Divider />

      <MenuItem
        onClick={(event) => handleMenuItemClick(event, '')}
        key='All'
        data-testid="filter-menu-all"
      >
        All
        {filter === '' && (
          <ListItemIcon>
            <CheckIcon />
          </ListItemIcon>
        )}
      </MenuItem>

      {filteredChannels.length === 0 ? (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="body2" color="text.secondary">
            No channels found
          </Typography>
        </Box>
      ) : (
        filteredChannels.map((channel) => (
          <MenuItem
            onClick={(event) => handleMenuItemClick(event, channel)}
            key={channel}
            data-testid={`filter-menu-${channel}`}
          >
            {channel}
            {filter === channel && (
              <ListItemIcon>
                <CheckIcon />
              </ListItemIcon>
            )}
          </MenuItem>
        ))
      )}
    </Menu>
  );
};

export default FilterMenu;
