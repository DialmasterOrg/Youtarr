import React from 'react';
import {
  Box,
  Stack,
  TextField,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TableSortLabel,
  Typography,
} from '../../ui';
import {
  Filter as FilterListIcon,
} from 'lucide-react';
import { Shield as ShieldIcon } from '../../../lib/icons';
import { RATING_OPTIONS } from '../../../utils/ratings';
import FilterMenu from './FilterMenu';

export interface VideosFiltersProps {
  isMobile: boolean;
  showSortControls: boolean;
  channelFilter: string;
  uniqueChannels: string[];
  dateFrom: string;
  dateTo: string;
  maxRatingFilter: string;
  protectedFilter: boolean;
  orderBy: 'published' | 'added';
  sortOrder: 'asc' | 'desc';
  onChannelFilterChange: (channel: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearDates: () => void;
  onMaxRatingChange: (value: string) => void;
  onProtectedFilterChange: (value: boolean) => void;
  onSortChange: (newOrderBy: 'published' | 'added') => void;
}

function VideosFilters({
  isMobile,
  showSortControls,
  channelFilter,
  uniqueChannels,
  dateFrom,
  dateTo,
  maxRatingFilter,
  protectedFilter,
  orderBy,
  sortOrder,
  onChannelFilterChange,
  onDateFromChange,
  onDateToChange,
  onClearDates,
  onMaxRatingChange,
  onProtectedFilterChange,
  onSortChange,
}: VideosFiltersProps) {
  const [channelAnchorEl, setChannelAnchorEl] = React.useState<null | HTMLElement>(null);

  const openChannelMenu = (event: React.MouseEvent<HTMLElement>) => {
    setChannelAnchorEl(event.currentTarget);
  };

  const closeChannelMenu = () => setChannelAnchorEl(null);

  const handleChannelMenuItemClick = (
    _event: React.MouseEvent<HTMLElement>,
    value: string
  ) => {
    onChannelFilterChange(value);
    closeChannelMenu();
  };

  return (
    <Stack spacing={2} className="mb-6">
      {!isMobile && (
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="From Date"
            type="date"
            value={dateFrom}
            size="small"
            onChange={(e) => onDateFromChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            fullWidth
          />
          <TextField
            label="To Date"
            type="date"
            value={dateTo}
            size="small"
            onChange={(e) => onDateToChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            fullWidth
          />
          <Chip
            icon={<ShieldIcon size={16} />}
            label={protectedFilter ? 'Protected Only' : 'Protected'}
            variant={protectedFilter ? 'filled' : 'outlined'}
            color={protectedFilter ? 'primary' : 'default'}
            onClick={() => onProtectedFilterChange(!protectedFilter)}
            onDelete={protectedFilter ? () => onProtectedFilterChange(false) : undefined}
            style={{ cursor: 'pointer', height: 36 }}
          />
          {(dateFrom || dateTo) && (
            <Button variant="outlined" onClick={onClearDates}>
              Clear Dates
            </Button>
          )}
        </Stack>
      )}

      <FormControl fullWidth>
        <InputLabel>Max Rating</InputLabel>
        <Select
          value={maxRatingFilter}
          label="Max Rating"
          size="small"
          onChange={(event) => onMaxRatingChange(event.target.value as string)}
        >
          {RATING_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box className="flex flex-wrap items-center gap-2">
        <Button
          variant="outlined"
          size="small"
          startIcon={<FilterListIcon data-testid="FilterListIcon" size={16} />}
          onClick={openChannelMenu}
          className="text-foreground border-border hover:bg-muted hover:border-foreground"
        >
          {channelFilter ? `Channel: ${channelFilter}` : 'Filter by Channel'}
        </Button>
        {isMobile && (
          <Chip
            icon={<ShieldIcon size={16} />}
            label={protectedFilter ? 'Protected Only' : 'Protected'}
            variant={protectedFilter ? 'filled' : 'outlined'}
            color={protectedFilter ? 'primary' : 'default'}
            onClick={() => onProtectedFilterChange(!protectedFilter)}
            onDelete={protectedFilter ? () => onProtectedFilterChange(false) : undefined}
            style={{ cursor: 'pointer', height: 36 }}
          />
        )}
        {showSortControls && (
          <Box className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
            <Typography variant="caption" color="text.secondary">
              Sort:
            </Typography>
            <TableSortLabel
              active={orderBy === 'published'}
              direction={orderBy === 'published' ? sortOrder : 'asc'}
              onClick={() => onSortChange('published')}
            >
              Published
            </TableSortLabel>
            <TableSortLabel
              active={orderBy === 'added'}
              direction={orderBy === 'added' ? sortOrder : 'asc'}
              onClick={() => onSortChange('added')}
            >
              Downloaded
            </TableSortLabel>
          </Box>
        )}
      </Box>

      <FilterMenu
        anchorEl={channelAnchorEl}
        handleClose={closeChannelMenu}
        handleMenuItemClick={handleChannelMenuItemClick}
        filter={channelFilter}
        uniqueChannels={uniqueChannels}
      />
    </Stack>
  );
}

export default VideosFilters;
