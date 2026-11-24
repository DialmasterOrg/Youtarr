import React, { ChangeEvent, KeyboardEvent, useId, useState } from 'react';
import { Box, Button, TextField, Typography } from '../../../ui';
import { SubfolderAutocomplete } from '../../../shared/SubfolderAutocomplete';
import { useSubfolders } from '../../../../hooks/useSubfolders';
import {
  ArrCategory,
  MAX_ARR_CATEGORIES,
  categoryRowLabel,
  getCategoriesError,
  hasOnlyDefaultCategories,
} from '../../utils/arrBridgeSetup';

const NO_SUBFOLDER_LABEL = "Youtarr's normal download location";

interface ArrBridgeCategoriesProps {
  token: string | null;
  categories: ArrCategory[];
  onChange: (categories: ArrCategory[]) => void;
}

/**
 * Where grabs are saved. Behind that sits a SABnzbd category per row: a
 * category is one Sonarr or Radarr instance, so adding and removing them only
 * matters to someone running a second instance and stays folded away until
 * then. A name is not editable once added: the grabs already made carry it.
 */
export const ArrBridgeCategories: React.FC<ArrBridgeCategoriesProps> = ({ token, categories, onChange }) => {
  const { subfolders, loading: subfoldersLoading, createSubfolder } = useSubfolders(token);
  const [newName, setNewName] = useState('');
  const [managing, setManaging] = useState(() => !hasOnlyDefaultCategories(categories));
  const managePanelId = useId();

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
      <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Where grabs are saved">
        {categories.map((category) => (
          <li key={category.name} className="grid items-center gap-3 md:grid-cols-[1fr_auto]">
            <SubfolderAutocomplete
              mode="download"
              label={categoryRowLabel(category.name)}
              noOverrideLabel={NO_SUBFOLDER_LABEL}
              value={category.subfolder}
              onChange={(value) => setSubfolder(category.name, value)}
              subfolders={subfolders}
              loading={subfoldersLoading}
              createSubfolder={createSubfolder}
            />
            {managing && (
              <Button
                variant="outlined"
                disabled={categories.length <= 1}
                aria-label={`Remove ${category.name}`}
                onClick={() => onChange(categories.filter((entry) => entry.name !== category.name))}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Box>
        <Button
          variant="text"
          aria-expanded={managing}
          aria-controls={managePanelId}
          onClick={() => setManaging((open) => !open)}
        >
          I run more than one Sonarr or Radarr
        </Button>
      </Box>

      {managing && (
        <Box id={managePanelId} className="flex flex-col gap-3">
          <Typography variant="body2" color="text.secondary">
            Each row above is a category, the name a Sonarr or Radarr gives its download client: <code>tv</code>{' '}
            and <code>movies</code> to begin with. Two instances that share a category import each other&apos;s
            downloads, so add a category for a second instance (for example <code>tv-4k</code>) and enter it as
            the Category of that instance&apos;s download client.
          </Typography>
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
      )}
    </Box>
  );
};

export default ArrBridgeCategories;
