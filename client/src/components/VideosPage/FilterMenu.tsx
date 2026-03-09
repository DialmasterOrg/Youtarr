import React, { useState, useEffect } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Typography,
  Divider,
} from '../ui';
import { Check as CheckIcon, Search as SearchIcon } from '../../lib/icons';

interface FilterMenuProps {
  anchorEl: null | HTMLElement;
  handleClose: () => void;
  handleMenuItemClick: (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
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
      <div style={{ padding: '8px 16px', position: 'sticky', top: 0, backgroundColor: 'var(--card)', zIndex: 1 }}>
        <TextField
          type="text"
          size="small"
          fullWidth
          placeholder="Search channels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          InputProps={{
            startAdornment: <SearchIcon size={16} data-testid="SearchIcon" style={{ marginRight: 4, color: 'var(--muted-foreground)' }} />,
          }}
          autoFocus
        />
      </div>
      <Divider />

      <MenuItem
        onClick={(event) => handleMenuItemClick(event, '')}
        key='All'
        data-testid="filter-menu-all"
      >
        All
        {filter === '' && (
          <ListItemIcon>
            <CheckIcon data-testid="CheckIcon" />
          </ListItemIcon>
        )}
      </MenuItem>

      {filteredChannels.length === 0 ? (
        <div style={{ padding: '8px 16px' }}>
          <Typography variant="body2" color="text.secondary">
            No channels found
          </Typography>
        </div>
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
                <CheckIcon data-testid="CheckIcon" />
              </ListItemIcon>
            )}
          </MenuItem>
        ))
      )}
    </Menu>
  );
};

export default FilterMenu;
