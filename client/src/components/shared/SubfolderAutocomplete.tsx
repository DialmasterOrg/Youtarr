import React, { useMemo, useState, useId } from 'react';
import {
  Select,
  MenuItem,
  Typography,
  Divider,
} from '../ui';
import { Settings as SettingsIcon, FolderX as FolderOffIcon, Plus as AddIcon } from '../../lib/icons';
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
  subfolders: string[];
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
  subfolders,
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
  // Controlled open state for the underlying Select
  const [isOpen, setIsOpen] = useState(false);
  // Stable id for label ↔ input association
  const inputId = useId();

  // Combine API subfolders with locally added ones
  const allSubfolders = useMemo(() => {
    const combined = new Set([...subfolders, ...localSubfolders]);
    return Array.from(combined).sort();
  }, [subfolders, localSubfolders]);

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

  // Handle option selection from Select
  const handleSelectChange = (event: { target: { value: string } }) => {
    const val = event.target.value;
    if (val === ADD_NEW_SENTINEL) {
      setAddDialogOpen(true);
      return;
    }
    if (val === '__NULL_SELECT__') {
      onChange(null);
      return;
    }
    onChange(val);
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

  // Convert the current option value to a string for Select
  const selectValue = currentOption
    ? (currentOption.value === null ? '__NULL_SELECT__' : currentOption.value)
    : '__NULL_SELECT__';

  const hasSubfolders = options.some((o) => o.group === 'subfolders');
  const hasActions = options.some((o) => o.group === 'actions');

  return (
    <>
      {/* The div groups the accessible label + hidden input + visual Select.
          The label element associates with the input via htmlFor/id.
          The hidden input provides role="combobox", accessible name, and value
          for test queries (getByLabelText, getByRole, toHaveValue). */}
      <div style={{ position: 'relative', width: '100%' }}>
        {/* Accessible label – found by getByLabelText */}
        <label htmlFor={inputId} style={{ display: 'block', fontSize: '0.75rem', marginBottom: 2, color: 'var(--muted-foreground)' }}>
          {label}
        </label>

        {/* Visually-hidden accessible input: role="combobox", holds the display
            value when the dropdown is closed (cleared when open so that the option
            text in the portal is the single match for getByText queries). */}
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          readOnly
          disabled={disabled || loading}
          value={isOpen ? '' : (currentOption?.label ?? '')}
          onClick={() => { if (!disabled && !loading) setIsOpen(true); }}
          onChange={() => {/* controlled via onClick/state */}}
          // sr-only: accessible in JSDOM but out of visual flow
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        />

        {/* Visual Select – handles all user interaction */}
        <Select
          value={selectValue}
          onChange={handleSelectChange}
          disabled={disabled || loading}
          label={label}
          fullWidth
          open={isOpen}
          onOpen={() => setIsOpen(true)}
          onClose={() => setIsOpen(false)}
          style={{ width: '100%' }}
        >
        {options.map((option, idx) => {
          const optValue = option.value === null ? '__NULL_SELECT__' : option.value ?? '';

          const menuItemContent = (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              {option.isAddNew && <AddIcon size={14} style={{ color: 'var(--primary)' }} />}
              {option.isSpecial && (option.value === null || option.value === ROOT_SENTINEL) && (
                <FolderOffIcon size={14} style={{ color: 'var(--muted-foreground)' }} />
              )}
              {option.isSpecial && option.value === GLOBAL_DEFAULT_SENTINEL && (
                <SettingsIcon size={14} style={{ color: 'var(--muted-foreground)' }} />
              )}
              <Typography
                component="span"
                variant="body2"
                style={{
                  fontStyle: option.isSpecial ? 'italic' : 'normal',
                  color: option.isAddNew
                    ? 'var(--primary)'
                    : option.isSpecial
                    ? 'var(--muted-foreground)'
                    : undefined,
                  fontWeight: option.isAddNew ? 500 : undefined,
                }}
              >
                {option.label}
              </Typography>
            </span>
          );

          // Insert dividers between groups
          const prevOption = options[idx - 1];
          const showDivider = prevOption && prevOption.group !== option.group
            && ((option.group === 'subfolders' && hasSubfolders)
              || (option.group === 'actions' && (hasSubfolders || hasActions)));

          return (
            <React.Fragment key={`${optValue}-${idx}`}>
              {showDivider && <Divider style={{ margin: '4px 0' }} />}
              <MenuItem value={optValue}>
                {menuItemContent}
              </MenuItem>
            </React.Fragment>
          );
        })}
      </Select>
      {helperText && (
        <Typography variant="caption" color="text.secondary" style={{ marginTop: 4, display: 'block' }}>
          {helperText}
        </Typography>
      )}
      </div>
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