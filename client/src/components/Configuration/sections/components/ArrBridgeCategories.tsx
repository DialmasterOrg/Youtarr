import React, { ChangeEvent, KeyboardEvent, useState } from 'react';
import { Box, Button, TextField, Typography } from '../../../ui';
import { SubfolderAutocomplete } from '../../../shared/SubfolderAutocomplete';
import { useSubfolders } from '../../../../hooks/useSubfolders';
import { ArrCategory, MAX_ARR_CATEGORIES, getCategoriesError } from '../../utils/arrBridgeSetup';

interface ArrBridgeCategoriesProps {
  token: string | null;
  categories: ArrCategory[];
  onChange: (categories: ArrCategory[]) => void;
}

/**
 * The SABnzbd categories Youtarr answers to. A category is one Sonarr or
 * Radarr instance, and decides where that instance's downloads go. A name is
 * not editable once added: the grabs already made carry it.
 */
export const ArrBridgeCategories: React.FC<ArrBridgeCategoriesProps> = ({ token, categories, onChange }) => {
  const { subfolders, loading: subfoldersLoading, createSubfolder } = useSubfolders(token);
  const [newName, setNewName] = useState('');

  const trimmedName = newName.trim();
  const atLimit = categories.length >= MAX_ARR_CATEGORIES;
  const newNameError = trimmedName ? getCategoriesError([...categories, { name: trimmedName, subfolder: null }]) : null;
  const canAdd = trimmedName.length > 0 && !atLimit && newNameError === null;

  const addCategory = () => {
    if (!canAdd) return;
    onChange([...categories, { name: trimmedName, subfolder: null }]);
    setNewName('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCategory();
  };

  const setSubfolder = (name: string, subfolder: string | null) => {
    onChange(categories.map((category) => (category.name === name ? { ...category, subfolder } : category)));
  };

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="body2" color="text.secondary">
        Each Sonarr or Radarr instance uses one category. Two instances that share a category import each
        other&apos;s downloads, so give a second instance its own (for example tv-4k).
      </Typography>

      <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Categories">
        {categories.map((category) => (
          <li
            key={category.name}
            className="grid items-center gap-3 rounded-[var(--radius-ui)] border border-[var(--border)] p-3 md:grid-cols-[minmax(6rem,auto)_1fr_auto]"
          >
            <Typography variant="subtitle2" className="break-all font-mono">
              {category.name}
            </Typography>
            <SubfolderAutocomplete
              mode="download"
              label={`Download ${category.name} to`}
              value={category.subfolder}
              onChange={(value) => setSubfolder(category.name, value)}
              subfolders={subfolders}
              loading={subfoldersLoading}
              createSubfolder={createSubfolder}
            />
            <Button
              variant="outlined"
              disabled={categories.length <= 1}
              aria-label={`Remove ${category.name}`}
              onClick={() => onChange(categories.filter((entry) => entry.name !== category.name))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <Box className="flex flex-wrap items-start gap-2">
        <TextField
          size="small"
          label="New category name"
          value={newName}
          disabled={atLimit}
          error={newNameError !== null}
          helperText={
            newNameError ?? (atLimit ? `At most ${MAX_ARR_CATEGORIES} categories.` : 'Letters, digits, - and _.')
          }
          onChange={(event: ChangeEvent<HTMLInputElement>) => setNewName(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button variant="outlined" disabled={!canAdd} onClick={addCategory}>
          Add category
        </Button>
      </Box>
    </Box>
  );
};

export default ArrBridgeCategories;
