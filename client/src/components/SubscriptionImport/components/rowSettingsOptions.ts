import { RESOLUTION_OPTIONS } from '../../../utils/downloadOptions';
import { RATING_OPTIONS as SHARED_RATING_OPTIONS } from '../../../utils/ratings';

const USE_GLOBAL_DEFAULT = { value: '', label: 'Use global default' };

// Resolution values come from the shared list (single source of truth); the
// compact row UI keeps its own bare "Np" labels, high -> low, with a leading
// "use global default" entry.
export const QUALITY_OPTIONS: Array<{ value: string; label: string }> = [
  USE_GLOBAL_DEFAULT,
  ...[...RESOLUTION_OPTIONS].reverse().map((option) => ({ value: option.value, label: `${option.value}p` })),
];

// Curated subset of the shared rating list for the import row UI (short codes).
const IMPORT_RATING_VALUES = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

export const RATING_OPTIONS: Array<{ value: string; label: string }> = [
  USE_GLOBAL_DEFAULT,
  ...SHARED_RATING_OPTIONS.filter((option) => IMPORT_RATING_VALUES.includes(option.value)).map(
    (option) => ({ value: option.value, label: option.shortLabel })
  ),
];
