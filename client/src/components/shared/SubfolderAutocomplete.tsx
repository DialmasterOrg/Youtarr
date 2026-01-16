import React, { useMemo, useState } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderOffIcon from '@mui/icons-material/FolderOff';
import AddIcon from '@mui/icons-material/Add';
import {
  GLOBAL_DEFAULT_SENTINEL,
  ROOT_SENTINEL,
  isUsingDefaultSubfolder,
  isExplicitlyNoSubfolder,
  isExplicitlyRoot,
} from '../../utils/channelHelpers';
import { AddSubfolderDialog } from './AddSubfolderDialog';

/**
 * Represents an option in the subfolder autocomplete
 */
interface SubfolderOption {
  label: string;
  value: string | null;
  isSpecial: boolean;
  isAddNew: boolean;
  group: 'special' | 'subfolders' | 'actions';
}

type SubfolderMode = 'global' | 'channel' | 'download';

interface SubfolderAutocompleteProps {
  /** Current value (clean, without __ prefix). null = root (backwards compat), ##USE_GLOBAL_DEFAULT## = use default */
  value: string | null | undefined;
  /** Callback when value changes */
  onChange: (value: string | null) => void;
  /** List of existing subfolders (with __ prefix from API) */
  subfolders?: string[];
  /** Global default subfolder for display purposes (without __ prefix) */
  defaultSubfolderDisplay?: string | null;
  /** Mode determines available options */
  mode: SubfolderMode;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether data is loading */
  loading?: boolean;
  /** Helper text to display below the input */
  helperText?: string;
  /** Label for the input */
  label?: string;
}

const ADD_NEW_SENTINEL = '__ADD_NEW__';

/**
 * Reusable subfolder autocomplete component
 * Supports three modes:
 * - 'global': For CoreSettingsSection - shows "No Subfolder (root)" + existing subfolders + Add
 * - 'channel': For channel settings - adds "Default Subfolder" and "No Subfolder" special options + Add
 * - 'download': For manual downloads - adds "No override" option plus channel options + Add
 */
export function SubfolderAutocomplete({
  value,
  onChange,
  subfolders = [],
  defaultSubfolderDisplay,
  mode,
  disabled = false,
  loading = false,
  helperText,
  label = 'Subfolder',
}: SubfolderAutocompleteProps) {
  // State for the Add Subfolder dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  // Track locally added subfolders (not yet on filesystem)
  const [localSubfolders, setLocalSubfolders] = useState<string[]>([]);

  // Ensure subfolders is always an array
  const safeSubfolders = Array.isArray(subfolders) ? subfolders : [];

  // Combine API subfolders with locally added ones
  const allSubfolders = useMemo(() => {
    const combined = new Set([...safeSubfolders, ...localSubfolders]);
    return Array.from(combined).sort();
  }, [safeSubfolders, localSubfolders]);

  // Build options based on mode
  const options = useMemo((): SubfolderOption[] => {
    const opts: SubfolderOption[] = [];

    // Add special options based on mode
    if (mode === 'global') {
      // "No Subfolder" option - maps to null (root directory)
      opts.push({
        label: 'No Subfolder (root)',
        value: null,
        isSpecial: true,
        isAddNew: false,
        group: 'special',
      });
    } else if (mode === 'channel') {
      // "No Subfolder" option - maps to null (backwards compatible root)
      opts.push({
        label: 'No Subfolder (root)',
        value: null,
        isSpecial: true,
        isAddNew: false,
        group: 'special',
      });

      // "Default Subfolder" option - maps to ##USE_GLOBAL_DEFAULT##
      const defaultLabel = defaultSubfolderDisplay
        ? `Default Subfolder (__${defaultSubfolderDisplay})`
        : 'Default Subfolder (root)';
      opts.push({
        label: defaultLabel,
        value: GLOBAL_DEFAULT_SENTINEL,
        isSpecial: true,
        isAddNew: false,
        group: 'special',
      });
    } else if (mode === 'download') {
      // "No override" option - maps to null (no override)
      opts.push({
        label: 'No override (use channel settings)',
        value: null,
        isSpecial: true,
        isAddNew: false,
        group: 'special',
      });

      // "Root directory" option - explicitly download to root (no subfolder)
      opts.push({
        label: 'Root directory (no subfolder)',
        value: ROOT_SENTINEL,
        isSpecial: true,
        isAddNew: false,
        group: 'special',
      });

      // "Use Global Default" option - uses global default subfolder
      opts.push({
        label: 'Use Global Default Subfolder',
        value: GLOBAL_DEFAULT_SENTINEL,
        isSpecial: true,
        isAddNew: false,
        group: 'special',
      });
    }

    // Add existing subfolders (strip __ prefix from display, store clean value)
    allSubfolders.forEach((folder) => {
      const cleanValue = folder.replace(/^__/, '');
      const displayLabel = folder.startsWith('__') ? folder : `__${folder}`;
      opts.push({
        label: displayLabel,
        value: cleanValue,
        isSpecial: false,
        isAddNew: false,
        group: 'subfolders',
      });
    });

    // Add "Add Subfolder" option at the end
    opts.push({
      label: 'Add Subfolder',
      value: ADD_NEW_SENTINEL,
      isSpecial: false,
      isAddNew: true,
      group: 'actions',
    });

    return opts;
  }, [mode, allSubfolders, defaultSubfolderDisplay]);

  // Find the current option based on value
  const currentOption = useMemo((): SubfolderOption | null => {
    if (mode === 'global') {
      // For global mode, null/empty means root
      if (!value) {
        return options.find((o) => o.value === null && o.isSpecial) || null;
      }
      // Find existing subfolder option
      const existingOption = options.find((o) => o.value === value && !o.isAddNew);
      if (existingOption) return existingOption;
      // Custom value (shouldn't happen without freeSolo, but handle gracefully)
      return {
        label: `__${value}`,
        value: value as string,
        isSpecial: false,
        isAddNew: false,
        group: 'subfolders',
      };
    }

    if (mode === 'channel') {
      if (isExplicitlyNoSubfolder(value)) {
        // null/empty = root (backwards compatible)
        return options.find((o) => o.value === null && o.isSpecial) || null;
      }
      if (isUsingDefaultSubfolder(value)) {
        // ##USE_GLOBAL_DEFAULT## = use global default
        return options.find((o) => o.value === GLOBAL_DEFAULT_SENTINEL) || null;
      }
      // Specific subfolder
      const existingOption = options.find((o) => o.value === value && !o.isAddNew);
      if (existingOption) return existingOption;
      // Custom value
      return {
        label: `__${value}`,
        value: value as string,
        isSpecial: false,
        isAddNew: false,
        group: 'subfolders',
      };
    }

    if (mode === 'download') {
      if (value === null || value === undefined) {
        return options.find((o) => o.value === null && o.isSpecial) || null;
      }
      if (isExplicitlyRoot(value)) {
        return options.find((o) => o.value === ROOT_SENTINEL) || null;
      }
      if (isUsingDefaultSubfolder(value)) {
        return options.find((o) => o.value === GLOBAL_DEFAULT_SENTINEL) || null;
      }
      // Specific subfolder
      const existingOption = options.find((o) => o.value === value && !o.isAddNew);
      if (existingOption) return existingOption;
      // Custom value
      return {
        label: `__${value}`,
        value: value as string,
        isSpecial: false,
        isAddNew: false,
        group: 'subfolders',
      };
    }

    return null;
  }, [value, options, mode]);

  // Handle option selection
  const handleChange = (
    _event: React.SyntheticEvent,
    newValue: SubfolderOption | null
  ) => {
    if (newValue === null) {
      // Cleared the field - use null for root
      onChange(null);
      return;
    }

    // Check if "Add Subfolder" was clicked
    if (newValue.isAddNew) {
      setAddDialogOpen(true);
      return; // Don't change the current selection
    }

    // Selected a regular option
    onChange(newValue.value);
  };

  // Handle new subfolder addition from dialog
  const handleAddSubfolder = (newName: string) => {
    // Add to local list with __ prefix
    setLocalSubfolders((prev) => [...prev, `__${newName}`]);
    // Set as the selected value
    onChange(newName);
    // Close dialog
    setAddDialogOpen(false);
  };

  // Render option with icons for special options
  // eslint-disable-next-line react/prop-types
  const renderOption = (
    props: React.HTMLAttributes<HTMLLIElement>,
    option: SubfolderOption
  ) => {
    // eslint-disable-next-line react/prop-types
    const { key, ...otherProps } = props as { key?: string } & React.HTMLAttributes<HTMLLIElement>;

    // Render "Add Subfolder" distinctly
    if (option.isAddNew) {
      return (
        <li key={key} {...otherProps}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', color: 'primary.main' }}>
            <AddIcon fontSize="small" sx={{ mr: 1 }} />
            <Typography sx={{ fontWeight: 500 }}>
              {option.label}
            </Typography>
          </Box>
        </li>
      );
    }

    return (
      <li key={key} {...otherProps}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {option.isSpecial && option.value === null && (
            <FolderOffIcon
              fontSize="small"
              sx={{ mr: 1, color: 'text.secondary' }}
            />
          )}
          {option.isSpecial && option.value === ROOT_SENTINEL && (
            <FolderOffIcon
              fontSize="small"
              sx={{ mr: 1, color: 'text.secondary' }}
            />
          )}
          {option.isSpecial && option.value === GLOBAL_DEFAULT_SENTINEL && (
            <SettingsIcon
              fontSize="small"
              sx={{ mr: 1, color: 'text.secondary' }}
            />
          )}
          <Typography
            sx={{
              fontStyle: option.isSpecial ? 'italic' : 'normal',
              color: option.isSpecial ? 'text.secondary' : 'text.primary',
            }}
          >
            {option.label}
          </Typography>
        </Box>
      </li>
    );
  };

  // Group options with divider
  const groupBy = (option: SubfolderOption) => option.group;

  const renderGroup = (params: {
    key: string;
    group: string;
    children?: React.ReactNode;
  }) => {
    const hasSubfolders = options.some((o) => o.group === 'subfolders');
    const hasActions = options.some((o) => o.group === 'actions');

    return (
      <React.Fragment key={params.key}>
        {params.children}
        {/* Divider after special options if there are subfolders or actions */}
        {params.group === 'special' && (hasSubfolders || hasActions) && (
          <Divider sx={{ my: 0.5 }} component="li" />
        )}
        {/* Divider after subfolders if there are actions */}
        {params.group === 'subfolders' && hasActions && (
          <Divider sx={{ my: 0.5 }} component="li" />
        )}
      </React.Fragment>
    );
  };

  // Filter out the "Add Subfolder" option from being the selected value displayed in the input
  const filterOptions = (opts: SubfolderOption[]) => opts;

  return (
    <>
      <Autocomplete
        options={options}
        value={currentOption}
        onChange={handleChange}
        disabled={disabled}
        loading={loading}
        groupBy={groupBy}
        renderGroup={renderGroup}
        renderOption={renderOption}
        filterOptions={filterOptions}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          // Don't show "Add Subfolder" label in the input field
          if (option.isAddNew) return '';
          return option.label;
        }}
        isOptionEqualToValue={(option, val) => {
          // Never match the "Add Subfolder" option as selected
          if (option.isAddNew) return false;
          return option.value === val.value;
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            helperText={helperText}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
          />
        )}
        sx={{ width: '100%' }}
      />
      <AddSubfolderDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onAdd={handleAddSubfolder}
        existingSubfolders={allSubfolders}
      />
    </>
  );
}

export default SubfolderAutocomplete;
