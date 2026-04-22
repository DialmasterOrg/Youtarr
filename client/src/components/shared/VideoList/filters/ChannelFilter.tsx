import React, { useEffect, useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Typography,
  Divider,
} from '../../../ui';
import {
  Check as CheckIcon,
  Search as SearchIcon,
  ListFilter as FilterListIcon,
} from '../../../../lib/icons';

export interface ChannelFilterProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  buttonLabel?: string;
}

function ChannelFilter({ value, options, onChange, buttonLabel }: ChannelFilterProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!anchorEl) setSearchTerm('');
  }, [anchorEl]);

  const filtered = options.filter((channel) =>
    channel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const label = value ? `Channel: ${value}` : (buttonLabel ?? 'Filter by Channel');

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<FilterListIcon size={16} data-testid="FilterListIcon" />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        className="text-foreground border-border hover:bg-muted hover:border-foreground"
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{ style: { maxHeight: 400, width: 300 } }}
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
              startAdornment: (
                <SearchIcon
                  size={16}
                  data-testid="SearchIcon"
                  style={{ marginRight: 4, color: 'var(--muted-foreground)' }}
                />
              ),
            }}
            autoFocus
          />
        </div>
        <Divider />

        <MenuItem
          onClick={() => {
            onChange('');
            setAnchorEl(null);
          }}
          data-testid="filter-menu-all"
        >
          All
          {value === '' && (
            <ListItemIcon>
              <CheckIcon data-testid="CheckIcon" />
            </ListItemIcon>
          )}
        </MenuItem>

        {filtered.length === 0 ? (
          <div style={{ padding: '8px 16px' }}>
            <Typography variant="body2" color="text.secondary">
              No channels found
            </Typography>
          </div>
        ) : (
          filtered.map((channel) => (
            <MenuItem
              onClick={() => {
                onChange(channel);
                setAnchorEl(null);
              }}
              key={channel}
              data-testid={`filter-menu-${channel}`}
            >
              {channel}
              {value === channel && (
                <ListItemIcon>
                  <CheckIcon data-testid="CheckIcon" />
                </ListItemIcon>
              )}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

export default ChannelFilter;
