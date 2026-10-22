import React, { useState } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from '../../ui';
import {
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Check as CheckIcon,
} from '../../../lib/icons';
import { SortConfig } from './types';

export interface VideoListSortButtonProps {
  sort: SortConfig;
}

function DirectionIcon({ direction }: { direction: 'asc' | 'desc' }) {
  const Icon = direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return <Icon size={14} data-testid={`sort-direction-${direction}`} />;
}

function VideoListSortButton({ sort }: VideoListSortButtonProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const active = sort.options.find((o) => o.key === sort.activeKey);
  const label = active ? active.label : 'Sort';
  const activeIsDirected = !active?.undirected;

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        className="hover:border-foreground"
        endIcon={activeIsDirected ? <DirectionIcon direction={sort.direction} /> : undefined}
        data-testid="video-list-sort-button"
      >
        Sort: {label}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {sort.options.map((option) => {
          const isActive = option.key === sort.activeKey;
          return (
            <MenuItem
              key={option.key}
              onClick={() => {
                if (!isActive) {
                  sort.onChange(option.key, 'desc');
                } else if (!option.undirected) {
                  sort.onChange(option.key, sort.direction === 'asc' ? 'desc' : 'asc');
                }
                setAnchorEl(null);
              }}
            >
              <ListItemText>{option.label}</ListItemText>
              <ListItemIcon style={{ marginLeft: 8, minWidth: 'auto', opacity: isActive ? 1 : 0 }}>
                {isActive && !option.undirected ? (
                  <DirectionIcon direction={sort.direction} />
                ) : (
                  <CheckIcon size={14} />
                )}
              </ListItemIcon>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export default VideoListSortButton;
